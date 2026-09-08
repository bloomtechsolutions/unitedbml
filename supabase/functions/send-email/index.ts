import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}
function utf8Base64(value:string){const bytes=new TextEncoder().encode(value);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary)}
function encodeHeader(value:string){return `=?UTF-8?B?${utf8Base64(value)}?=`}
function base64Url(value:string){return utf8Base64(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')}
function wrapBase64(value:string){const clean=String(value||'').replace(/^data:[^;]+;base64,/,'').replace(/\s/g,'');return clean.match(/.{1,76}/g)?.join('\r\n')||''}
function recipients(input:unknown){if(Array.isArray(input))return input.filter(Boolean).join(', ');return String(input||'').replace(/;/g,',')}
function response(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  let stage='request'
  try{
    stage='authentication'
    const auth=req.headers.get('Authorization')||''
    if(!auth.startsWith('Bearer '))throw new Error('Authentication required')
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const bearer=auth.slice(7)
    const serviceCall=bearer===service
    const admin=createClient(url,service)
    let user:any=null
    if(!serviceCall){
      const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}})
      const userResult=await userClient.auth.getUser();user=userResult.data.user
      if(userResult.error||!user)throw new Error('Invalid or expired UnitedBML session')
      const {data:profile,error:profileError}=await admin.from('profiles').select('role,status').eq('id',user.id).single()
      if(profileError||!profile)throw new Error('UnitedBML profile not found')
      if(String(profile.status||'Active').toLowerCase()==='inactive')throw new Error('Your UnitedBML account is inactive')
      if(String(profile.role||'').toLowerCase()==='staff member')throw new Error('Your role is not authorized to send workflow email')
    }

    const p=await req.json()
    const clientId=Deno.env.get('GMAIL_CLIENT_ID'),clientSecret=Deno.env.get('GMAIL_CLIENT_SECRET'),refreshToken=Deno.env.get('GMAIL_REFRESH_TOKEN'),from=Deno.env.get('GMAIL_FROM_EMAIL')
    const configured=!!(clientId&&clientSecret&&refreshToken&&from)
    if(p?.action==='health')return response({ok:true,configured,from:configured?from:null})
    if(!configured)throw new Error('Gmail configuration is incomplete. Check Edge Function secrets.')

    const to=recipients(p.to),cc=recipients(p.cc),subject=String(p.subject||''),html=String(p.html||''),text=String(p.text||''),attachments=Array.isArray(p.attachments)?p.attachments:[]
    if(!to||!subject||(!html&&!text))throw new Error('Recipient, subject and email body are required')

    stage='gmail_token'
    const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId!,client_secret:clientSecret!,refresh_token:refreshToken!,grant_type:'refresh_token'})})
    const token=await tokenRes.json()
    if(!tokenRes.ok||!token.access_token)throw new Error(token?.error_description||token?.error||'Unable to obtain Gmail access token')

    stage='mime'
    const mixed=`unitedbml_mixed_${crypto.randomUUID()}`,alt=`unitedbml_alt_${crypto.randomUUID()}`
    const mime=[`From: UnitedBML <${from}>`,`To: ${to}`]
    if(cc)mime.push(`Cc: ${cc}`)
    mime.push(`Subject: ${encodeHeader(subject)}`,'MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${mixed}"`,'',`--${mixed}`,`Content-Type: multipart/alternative; boundary="${alt}"`,'')
    if(text)mime.push(`--${alt}`,'Content-Type: text/plain; charset="UTF-8"','Content-Transfer-Encoding: base64','',wrapBase64(utf8Base64(text)),'')
    if(html)mime.push(`--${alt}`,'Content-Type: text/html; charset="UTF-8"','Content-Transfer-Encoding: base64','',wrapBase64(utf8Base64(html)),'')
    mime.push(`--${alt}--`,'')
    let attachmentCount=0;const names:string[]=[]
    for(const a of attachments){
      const filename=String(a?.filename||a?.name||''),contentType=String(a?.contentType||a?.type||'application/octet-stream'),content=String(a?.content||a?.base64||'')
      if(!filename||!content)continue
      mime.push(`--${mixed}`,`Content-Type: ${contentType}; name="${encodeHeader(filename)}"`,'Content-Transfer-Encoding: base64',`Content-Disposition: attachment; filename="${encodeHeader(filename)}"`,'',wrapBase64(content),'')
      attachmentCount++;names.push(filename)
    }
    mime.push(`--${mixed}--`,'')

    stage='gmail_send'
    const gmailRes=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({raw:base64Url(mime.join('\r\n'))})})
    const gmail=await gmailRes.json()
    if(!gmailRes.ok)throw new Error(gmail?.error?.message||'Gmail rejected the email')

    // Email delivery must not be reported as failed merely because audit logging has a schema/RLS issue.
    let logWarning=''
    stage='email_log'
    const {error:logError}=await admin.from('email_log').insert({
      email_type:p.emailType||'General',related_type:p.relatedType||null,related_id:p.relatedId?String(p.relatedId):null,
      to_email:to,cc_email:cc||null,subject,status:'Sent',provider:'Gmail',provider_message_id:gmail.id,sent_by:user?.id||null,sent_at:new Date().toISOString(),
      metadata:{provider:'Gmail',thread_id:gmail.threadId||null,attachment_count:attachmentCount,attachment_names:names}
    })
    if(logError){logWarning=`Email sent, but email_log could not be updated: ${logError.message}`;console.error(logWarning)}

    return response({ok:true,messageId:gmail.id,threadId:gmail.threadId||null,attachments:attachmentCount,sentAt:new Date().toISOString(),logWarning})
  }catch(e){
    console.error('send-email error',stage,e)
    return response({ok:false,stage,error:e instanceof Error?e.message:String(e)},400)
  }
})
