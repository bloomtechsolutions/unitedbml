import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}})
const fail=(message:string,status=400)=>json({ok:false,error:message},status)
const token256=()=>{const a=new Uint8Array(32);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}
const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'} as any)[ch])
const money=(v:any)=>`MVR ${Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  try{
    const p=await req.json(),action=String(p.action||''),id=String(p.id||''),token=String(p.token||'').trim()
    if(!action||!id)return fail('Action and expense request ID are required',400)
    if(action!=='send-president'&&!token)return fail('Secure approval token is required',401)
    const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!
    const admin=createClient(url,service,{auth:{persistSession:false}})

    // Authenticated server-issued President link.
    // The browser never owns the approval token. This action generates the token,
    // writes it to Supabase, verifies it, and sends the same value in one server path.
    if(action==='send-president'){
      const auth=req.headers.get('Authorization')||''
      if(!auth.startsWith('Bearer '))return fail('Authentication required',401)
      const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}})
      const {data:{user},error:userError}=await userClient.auth.getUser()
      if(userError||!user)return fail('Invalid or expired UnitedBML session',401)
      const {data:profile,error:profileError}=await admin.from('profiles').select('role,status').eq('id',user.id).single()
      if(profileError||!profile)return fail('UnitedBML profile not found',403)
      if(String(profile.status||'Active').toLowerCase()==='inactive')return fail('Your UnitedBML account is inactive',403)
      // Any active authenticated UnitedBML user may submit operational finance work.
      // President and final approval decisions remain protected by their dedicated approval stages.

      const {data:reqRow,error:reqErr}=await admin.from('expense_requests').select(`
        id,request_number,title,event_name,request_date,category,purpose,requested_by,requester_role,
        prepared_by_name,prepared_by_role,status,subtotal,contingency_amount,total_amount,over_budget,
        overrun_amount,overrun_justification,data
      `).eq('id',id).single()
      if(reqErr||!reqRow)return fail('Expense request not found',404)
      if(reqRow.status!=='Pending President Recommendation')
        return fail('Expense is not awaiting President recommendation',409)

      const {data:president,error:presErr}=await admin.from('committee_members')
        .select('name,email,role,status,availability')
        .ilike('role','President')
        .eq('status','Active')
        .maybeSingle()
      if(presErr)return fail('Could not resolve President from Committee',500)
      if(!president?.email)return fail('Active President email is not configured in Committee Management',409)

      const {data:lineRows,error:lineErr}=await admin.from('expense_lines')
        .select('line_no,description,quantity,rate,line_total,reimbursement_required')
        .eq('expense_request_id',id).order('line_no')
      if(lineErr)return fail('Could not load expense lines',500)
      const snapshot=Array.isArray(reqRow.data?.lines)?reqRow.data.lines:[]
      const sendLines=(lineRows&&lineRows.length)?lineRows.map((x:any)=>({
        description:x.description||'',
        quantity:Number(x.quantity||0),
        rate:Number(x.rate||0),
        lineTotal:Number(x.line_total||0),
        reimbursementRequired:!!x.reimbursement_required
      })):snapshot.map((x:any)=>({
        description:x.description||'',
        quantity:Number(x.qty??x.quantity??0),
        rate:Number(x.rate||0),
        lineTotal:Number(x.total??x.lineTotal??(Number(x.qty??x.quantity??0)*Number(x.rate||0))),
        reimbursementRequired:!!x.reimbursementRequired
      }))

      const presidentToken=token256()
      const presidentExpiry=new Date(Date.now()+7*86400000).toISOString()
      const now=new Date().toISOString()

      const nextData={
        ...(reqRow.data||{}),
        presidentEmail:president.email,
        presidentName:president.name||'President',
        presidentApprovalToken:presidentToken,
        presidentApprovalTokenExpiresAt:presidentExpiry,
        presidentApprovalTokenUsedAt:'',
        presidentApprovalEmailStatus:'Preparing Secure Link'
      }

      const {data:written,error:writeErr}=await admin.from('expense_requests').update({
        president_email:president.email,
        president_approval_token:presidentToken,
        president_approval_token_expires_at:presidentExpiry,
        president_approval_token_used_at:null,
        president_approval_email_status:'Preparing Secure Link',
        president_approval_email_error:null,
        data:nextData,
        updated_at:now
      }).eq('id',id).eq('status','Pending President Recommendation')
        .select('id,status,president_approval_token,president_approval_token_expires_at')
        .maybeSingle()
      if(writeErr)return fail('Could not save secure President approval token',500)
      if(!written||written.president_approval_token!==presidentToken)
        return fail('Secure President approval token could not be verified after saving',500)

      const baseUrl=String(p.baseUrl||req.headers.get('origin')||'').replace(/\/$/,'')
      if(!baseUrl)return fail('Application URL is missing',400)
      const link=`${baseUrl}/?approval=expense&id=${encodeURIComponent(id)}&token=${encodeURIComponent(presidentToken)}&stage=president`

      const rows=sendLines.map((x:any,i:number)=>`<tr>
        <td style="padding:7px;border:1px solid #e5e7eb;text-align:center">${i+1}</td>
        <td style="padding:7px;border:1px solid #e5e7eb">${esc(x.description)}</td>
        <td style="padding:7px;border:1px solid #e5e7eb;text-align:center">${x.quantity}</td>
        <td style="padding:7px;border:1px solid #e5e7eb;text-align:right">${money(x.rate)}</td>
        <td style="padding:7px;border:1px solid #e5e7eb;text-align:right">${money(x.lineTotal)}</td>
        <td style="padding:7px;border:1px solid #e5e7eb;text-align:center">${x.reimbursementRequired?'Yes':'No'}</td>
      </tr>`).join('')

      const body=`<div style="font-family:Arial,sans-serif;max-width:760px;margin:auto;color:#172033">
        <div style="background:#17233d;color:#fff;padding:22px 26px;border-radius:14px 14px 0 0">
          <div style="font-size:12px;opacity:.8">UnitedBML Finance</div>
          <h2 style="margin:5px 0 0">President Expense Recommendation</h2>
          <div style="font-size:12px;margin-top:6px">${esc(reqRow.request_number||'')}</div>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 14px 14px">
          <p>Dear ${esc(president.name||'President')},</p>
          <p>The following expense requires your recommendation before final approval.</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Title</td><td style="padding:8px;border:1px solid #e5e7eb">${esc(reqRow.title||'-')}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Event / Activity</td><td style="padding:8px;border:1px solid #e5e7eb">${esc(reqRow.event_name||'General Club Expense')}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Purpose</td><td style="padding:8px;border:1px solid #e5e7eb">${esc(reqRow.purpose||'-')}</td></tr>
          </table>
          <h3>Expense Details</h3>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Total</th><th>Reimbursement</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="text-align:right"><b>Subtotal: ${money(reqRow.subtotal)}</b><br>
          Contingency (5%): ${money(reqRow.contingency_amount)}<br>
          <b>Total: ${money(reqRow.total_amount)}</b></p>
          ${reqRow.over_budget?`<p style="background:#fff8e7;padding:12px"><b>Budget Overrun: ${money(reqRow.overrun_amount)}</b><br>${esc(reqRow.overrun_justification||'-')}</p>`:''}
          <p><a href="${link}" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#5b61f6;color:#fff;text-decoration:none;font-weight:bold">Secure Review & Recommend</a></p>
          <p style="font-size:12px;color:#667085">No sign-in is required. This one-time secure link expires automatically and becomes unusable after the first decision.</p>
        </div>
      </div>`

      const emailRes=await fetch(`${url}/functions/v1/send-email`,{
        method:'POST',
        headers:{Authorization:`Bearer ${service}`,'apikey':service,'Content-Type':'application/json'},
        body:JSON.stringify({
          to:president.email,
          subject:`President recommendation required: ${reqRow.request_number} - ${reqRow.title}`,
          html:body,
          emailType:'Expense President Recommendation',
          relatedType:'expense_request',
          relatedId:id
        })
      })
      const email=await emailRes.json()
      if(!emailRes.ok||!email?.ok){
        const errText=email?.error||'President email could not be sent'
        await admin.from('expense_requests').update({
          president_approval_email_status:'Failed',
          president_approval_email_error:errText,
          data:{...nextData,presidentApprovalEmailStatus:'Failed',presidentApprovalEmailError:errText}
        }).eq('id',id)
        return fail(errText,500)
      }

      const sentAt=new Date().toISOString()
      await admin.from('expense_requests').update({
        president_approval_email_status:'Sent',
        president_approval_email_sent_at:sentAt,
        president_approval_email_error:null,
        president_approval_email_message_id:email.messageId||null,
        data:{
          ...nextData,
          presidentApprovalEmailStatus:'Sent',
          presidentApprovalEmailSentAt:sentAt,
          presidentApprovalEmailMessageId:email.messageId||''
        }
      }).eq('id',id)

      return json({
        ok:true,
        stage:'president',
        status:'Pending President Recommendation',
        sent:true,
        sentAt,
        expiresAt:presidentExpiry,
        messageId:email.messageId||null
      })
    }

    const {data:r,error:e}=await admin.from('expense_requests').select(`
      id,request_number,title,event_name,request_date,category,purpose,requested_by,requester_role,
      prepared_by_name,prepared_by_role,prepared_at,submitted_at,status,subtotal,contingency_amount,total_amount,
      president_recommendation,president_comment,recommended_by_name,recommended_by_role,president_email,
      president_approval_token,president_approval_token_expires_at,president_approval_token_used_at,
      final_approver_name,final_approver_role,final_approver_email,
      final_approval_token,final_approval_token_expires_at,final_approval_token_used_at,
      over_budget,overrun_amount,overrun_justification,data
    `).eq('id',id).single()
    if(e||!r)return fail('Approval link is invalid or unavailable',404)

    const normalize=(v:any)=>String(v||'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ')

    async function resolveFinalApprover(){
      let email=String(r.final_approver_email||'').trim()
      let name=String(r.final_approver_name||'').trim()
      let role=String(r.final_approver_role||'').trim()

      // Prefer the live Committee record over a stale/blank value stored on the expense.
      const {data:members,error:memberErr}=await admin.from('committee_members')
        .select('id,name,role,email,uid,status')
        .eq('status','Active')
      if(memberErr)throw new Error('Could not read Committee final approver details')

      const sameNameRole=(members||[]).find((m:any)=>
        normalize(m.name)===normalize(name) && normalize(m.role)===normalize(role)
      )
      const sameName=(members||[]).find((m:any)=>
        normalize(m.name)===normalize(name) && !!String(m.email||'').trim()
      )
      const sameRole=(members||[]).find((m:any)=>
        normalize(m.role)===normalize(role) && !!String(m.email||'').trim()
      )
      const member=sameNameRole||sameName||sameRole

      if(member){
        name=String(member.name||name).trim()
        role=String(member.role||role).trim()
        email=String(member.email||email).trim()

        // If Committee email is blank but this Committee UID maps to a login profile,
        // use that profile's email as a safe fallback.
        if(!email && member.uid){
          const {data:profile}=await admin.from('profiles')
            .select('email,full_name,role,status')
            .eq('status','Active')
            .or(`committee_slot.eq.${member.id},full_name.eq.${String(member.name||'').replace(/,/g,'')}`)
            .limit(1)
            .maybeSingle()
          if(profile?.email)email=String(profile.email).trim()
        }
      }

      // Final fallback by selected approver's name/role in profiles.
      if(!email && (name||role)){
        const {data:profiles}=await admin.from('profiles')
          .select('email,full_name,role,status')
          .eq('status','Active')
        const profile=(profiles||[]).find((p:any)=>
          (name && normalize(p.full_name)===normalize(name)) ||
          (role && normalize(p.role)===normalize(role))
        )
        if(profile?.email)email=String(profile.email).trim()
      }

      return {email,name,role}
    }

    const presidentStored=String(r.president_approval_token||r.data?.presidentApprovalToken||'').trim()
    const finalStored=String(r.final_approval_token||r.data?.finalApprovalToken||'').trim()
    const presidentMatch=!!presidentStored&&presidentStored===token
    const finalMatch=!!finalStored&&finalStored===token
    const stage=presidentMatch?'president':finalMatch?'final':''
    if(!stage)return fail('Approval link is invalid. The token does not match the current approval token stored for this expense.',401)
    const expiresAt=stage==='president'?(r.president_approval_token_expires_at||r.data?.presidentApprovalTokenExpiresAt):(r.final_approval_token_expires_at||r.data?.finalApprovalTokenExpiresAt)
    const usedAt=stage==='president'?(r.president_approval_token_used_at||r.data?.presidentApprovalTokenUsedAt):(r.final_approval_token_used_at||r.data?.finalApprovalTokenUsedAt)
    if(usedAt)return fail('This approval link has already been used',410)
    if(!expiresAt||new Date(expiresAt)<=new Date())return fail('This approval link has expired',410)
    if(stage==='president'&&!r.president_approval_token&&presidentMatch){await admin.from('expense_requests').update({president_approval_token:presidentStored,president_approval_token_expires_at:expiresAt}).eq('id',id);r.president_approval_token=presidentStored}
    if(stage==='final'&&!r.final_approval_token&&finalMatch){await admin.from('expense_requests').update({final_approval_token:finalStored,final_approval_token_expires_at:expiresAt}).eq('id',id);r.final_approval_token=finalStored}
    if(stage==='president'&&r.status!=='Pending President Recommendation')return fail('This expense is no longer awaiting President recommendation',409)
    if(stage==='final'&&r.status!=='Pending Final Approval')return fail('This expense is no longer awaiting final approval',409)

    const {data:lr,error:le}=await admin.from('expense_lines').select('line_no,description,quantity,rate,line_total,reimbursement_required').eq('expense_request_id',id).order('line_no')
    if(le)return fail('Could not load expense lines',500)
    const snapshot=Array.isArray(r.data?.lines)?r.data.lines:[]
    const lines=(lr&&lr.length)?lr.map((x:any)=>({description:x.description,quantity:Number(x.quantity||0),rate:Number(x.rate||0),lineTotal:Number(x.line_total||0),reimbursementRequired:!!x.reimbursement_required})):snapshot.map((x:any)=>({description:x.description||'',quantity:Number(x.qty??x.quantity??0),rate:Number(x.rate||0),lineTotal:Number(x.total??x.lineTotal??0),reimbursementRequired:!!x.reimbursementRequired}))

    if(action==='view')return json({ok:true,stage,request:{
      id:r.id,number:r.request_number,title:r.title,eventName:r.event_name,requestDate:r.request_date,category:r.category,purpose:r.purpose,
      requestedBy:r.requested_by,requesterRole:r.requester_role,preparedByName:r.prepared_by_name,preparedByRole:r.prepared_by_role,
      preparedAt:r.prepared_at,submittedAt:r.submitted_at,status:r.status,subtotal:Number(r.subtotal||0),contingency:Number(r.contingency_amount||0),
      total:Number(r.total_amount||0),presidentRecommendation:r.president_recommendation,presidentComment:r.president_comment,
      recommendedByName:r.recommended_by_name,recommendedByRole:r.recommended_by_role,recommendedAt:r.data?.presidentRecommendedAt||null,
      finalApproverName:r.final_approver_name,finalApproverRole:r.final_approver_role,overBudget:!!r.over_budget,
      overrunAmount:Number(r.overrun_amount||0),overrunJustification:r.overrun_justification,tokenExpiresAt:expiresAt,lines
    }})

    if(action!=='decide')return fail('Unsupported action')
    const decision=String(p.decision||''),comment=String(p.comment||'').trim(),now=new Date().toISOString()
    if(decision==='Reject'&&!comment)return fail('Rejection reason is required')

    if(stage==='president'){
      if(!['Recommend','Reject'].includes(decision))return fail('President decision must be Recommend or Reject')
      if(decision==='Reject'){
        const {data:u,error:ue}=await admin.from('expense_requests').update({
          status:'Rejected',president_recommendation:comment,president_comment:comment,recommended_by_name:'President',recommended_by_role:'President',
          president_approval_token_used_at:now,president_approval_token:null,updated_at:now,
          data:{...(r.data||{}),status:'Rejected',presidentRecommendation:comment,presidentComment:comment,presidentApprovalToken:'',presidentApprovalTokenUsedAt:now}
        }).eq('id',id).eq('status','Pending President Recommendation').eq('president_approval_token',token).is('president_approval_token_used_at',null).select('id,status').maybeSingle()
        if(ue)return fail('Could not save President rejection',500);if(!u)return fail('This approval link was already used or the request changed',409)
        await admin.from('expense_approvals').insert({expense_request_id:id,stage:'President Recommendation',decision:'Rejected',approver_name:'President',approver_role:'President',comment,channel:'Secure Email Approval Link',decided_at:now,data:{token_authorized:true}})
        return json({ok:true,stage,status:'Rejected',message:`${r.request_number||'Expense request'} was rejected by the President.`})
      }

      const finalToken=token256(),finalExpiry=new Date(Date.now()+7*86400000).toISOString()
      const rec=comment||'Recommended'
      const {data:u,error:ue}=await admin.from('expense_requests').update({
        status:'Pending Final Approval',president_recommendation:rec,president_comment:rec,recommended_by_name:'President',recommended_by_role:'President',
        president_approval_token_used_at:now,president_approval_token:null,
        final_approval_token:finalToken,final_approval_token_expires_at:finalExpiry,final_approval_token_used_at:null,
        final_approval_email_status:'Sending',updated_at:now,
        data:{...(r.data||{}),status:'Pending Final Approval',presidentRecommendation:rec,presidentComment:rec,recommendedByName:'President',recommendedByRole:'President',presidentRecommendedAt:now,presidentApprovalToken:'',presidentApprovalTokenUsedAt:now,finalApprovalToken:finalToken,finalApprovalTokenExpiresAt:finalExpiry,finalApprovalTokenUsedAt:'',finalApprovalEmailStatus:'Sending'}
      }).eq('id',id).eq('status','Pending President Recommendation').eq('president_approval_token',token).is('president_approval_token_used_at',null).select('id,status').maybeSingle()
      if(ue)return fail('Could not save President recommendation',500);if(!u)return fail('This approval link was already used or the request changed',409)
      await admin.from('expense_approvals').insert({expense_request_id:id,stage:'President Recommendation',decision:'Recommended',approver_name:'President',approver_role:'President',comment:rec,channel:'Secure Email Approval Link',decided_at:now,data:{token_authorized:true}})

      let emailSent=false,emailError=''
      let finalApprover:{email:string,name:string,role:string}
      try{
        finalApprover=await resolveFinalApprover()
      }catch(resolveErr){
        finalApprover={email:'',name:String(r.final_approver_name||''),role:String(r.final_approver_role||'')}
        emailError=resolveErr instanceof Error?resolveErr.message:String(resolveErr)
      }

      if(finalApprover.email){
        // Persist the live resolved Committee email so the request remains self-contained.
        await admin.from('expense_requests').update({
          final_approver_email:finalApprover.email,
          final_approver_name:finalApprover.name||r.final_approver_name,
          final_approver_role:finalApprover.role||r.final_approver_role,
          data:{
            ...(r.data||{}),
            status:'Pending Final Approval',
            presidentRecommendation:rec,
            presidentComment:rec,
            recommendedByName:'President',
            recommendedByRole:'President',
            presidentRecommendedAt:now,
            presidentApprovalToken:'',
            presidentApprovalTokenUsedAt:now,
            finalApprovalToken:finalToken,
            finalApprovalTokenExpiresAt:finalExpiry,
            finalApprovalTokenUsedAt:'',
            finalApprovalEmailStatus:'Sending',
            finalApproverEmail:finalApprover.email,
            finalApproverName:finalApprover.name||r.final_approver_name,
            finalApproverRole:finalApprover.role||r.final_approver_role
          }
        }).eq('id',id)

        const origin=String(p.baseUrl||req.headers.get('origin')||'').replace(/\/$/,'')
        const link=`${origin}/?approval=expense&id=${encodeURIComponent(id)}&token=${encodeURIComponent(finalToken)}&stage=final`
        const rows=lines.map((x:any,i:number)=>`<tr><td style="padding:7px;border:1px solid #ddd">${i+1}</td><td style="padding:7px;border:1px solid #ddd">${esc(x.description)}</td><td style="padding:7px;border:1px solid #ddd;text-align:center">${x.quantity}</td><td style="padding:7px;border:1px solid #ddd;text-align:right">${money(x.rate)}</td><td style="padding:7px;border:1px solid #ddd;text-align:right">${money(x.lineTotal)}</td></tr>`).join('')
        const body=`<div style="font-family:Arial,sans-serif;max-width:760px;margin:auto"><h2>Final Expense Approval Required</h2><p>Dear ${esc(finalApprover.name||r.final_approver_name||'Final Approver')},</p><p>The President has recommended <b>${esc(r.request_number)}</b> for final approval.</p><p><b>${esc(r.title)}</b><br>${esc(r.purpose||'')}</p><table style="width:100%;border-collapse:collapse"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><p style="text-align:right"><b>Subtotal: ${money(r.subtotal)}</b><br>Contingency (5%): ${money(r.contingency_amount)}<br><b>Total: ${money(r.total_amount)}</b></p><p><b>President comments:</b> ${esc(rec)}</p><p><a href="${link}" style="display:inline-block;background:#5b61f6;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Secure Review & Final Approval</a></p><p>No sign-in is required. This one-time link expires automatically.</p></div>`
        try{
          const er=await fetch(`${url}/functions/v1/send-email`,{method:'POST',headers:{Authorization:`Bearer ${service}`,'apikey':service,'Content-Type':'application/json'},body:JSON.stringify({to:finalApprover.email,subject:`Final approval required: ${r.request_number} - ${r.title}`,html:body,emailType:'Expense Final Approval',relatedType:'expense_request',relatedId:id})})
          const ej=await er.json();if(!er.ok||!ej?.ok)throw new Error(ej?.error||'Final approval email failed')
          emailSent=true
          await admin.from('expense_requests').update({final_approval_email_status:'Sent',final_approval_email_sent_at:new Date().toISOString(),final_approval_email_error:null}).eq('id',id)
        }catch(err){emailError=err instanceof Error?err.message:String(err);await admin.from('expense_requests').update({final_approval_email_status:'Failed',final_approval_email_error:emailError}).eq('id',id)}
      } else {
        emailError=emailError||`Final approver email could not be resolved for ${r.final_approver_name||'selected approver'} (${r.final_approver_role||'role not set'}). Check the active Committee member record.`
        await admin.from('expense_requests').update({
          final_approval_email_status:'Failed',
          final_approval_email_error:emailError
        }).eq('id',id)
      }
      return json({ok:true,stage,status:'Pending Final Approval',nextEmailSent:emailSent,nextEmailError:emailError,message:emailSent?`${r.request_number} was recommended and the final approver email was sent automatically.`:`${r.request_number} was recommended. Final approval email could not be sent: ${emailError}`})
    }

    if(!['Approve','Reject'].includes(decision))return fail('Final decision must be Approve or Reject')
    let before:number|null=null,after:number|null=null
    if(decision==='Approve'){
      const year=Number(String(r.request_date||new Date().toISOString()).slice(0,4))||new Date().getFullYear()
      const {data:b}=await admin.from('budgets').select('approved_amount').eq('budget_year',year).maybeSingle(),budget=Number(b?.approved_amount||0)
      const {data:a,error:ae}=await admin.from('expense_requests').select('total_amount').eq('status','Approved').neq('id',id);if(ae)return fail('Could not verify available budget',500)
      before=Math.max(0,budget-(a||[]).reduce((s:number,x:any)=>s+Number(x.total_amount||0),0))
      if(Number(r.total_amount||0)>before+0.001)return fail(`Insufficient available budget. Available: ${money(before)}`,409)
      after=Math.max(0,before-Number(r.total_amount||0))
    }
    const status=decision==='Approve'?'Approved':'Rejected',fc=comment||(decision==='Approve'?'Approved via secure link':''),name=r.final_approver_name||'Selected Final Approver',role=r.final_approver_role||'Final Approver'
    const update:any={status,final_approver_comment:fc,approved_by_name:name,approved_by_role:role,approved_at:now,final_approval_channel:'Secure Email Approval Link',final_approval_token_used_at:now,final_approval_token:null,updated_at:now,data:{...(r.data||{}),status,finalApproverComment:fc,approvedByName:name,approvedByRole:role,approvedAt:now,finalApprovalChannel:'Secure Email Approval Link',finalApprovalToken:'',finalApprovalTokenUsedAt:now}}
    if(decision==='Approve'){update.budget_available_before_approval=before;update.budget_available_after_approval=after}
    const {data:u,error:ue}=await admin.from('expense_requests').update(update).eq('id',id).eq('status','Pending Final Approval').eq('final_approval_token',token).is('final_approval_token_used_at',null).select('id,status,approved_at').maybeSingle()
    if(ue)return fail('Could not save final approval',500);if(!u)return fail('This approval link was already used or the request changed',409)
    await admin.from('expense_approvals').insert({expense_request_id:id,stage:'Final Approval',decision:status,approver_name:name,approver_role:role,comment:fc,channel:'Secure Email Approval Link',decided_at:now,data:{token_authorized:true}})
    return json({ok:true,stage,status,approvedAt:u.approved_at,message:`${r.request_number||'Expense request'} has been ${decision==='Approve'?'approved':'rejected'} successfully.`})
  }catch(err){console.error('expense-approval error',err);return fail(err instanceof Error?err.message:String(err),500)}
})
