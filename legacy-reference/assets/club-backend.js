(function(){
  'use strict';
  const nativeSet=localStorage.setItem.bind(localStorage);
  const nativeRemove=localStorage.removeItem.bind(localStorage);
  const SYNC_KEYS=new Set([
    'clubEventTypesV1','clubEventsV2','clubStaffRegistryV1','clubMeetingsV1','clubBudgetV1','clubFinanceV1',
    'clubReimbursementPreApprovalsV1','clubCommitteeV1','clubProcurementManagerEmailV1','clubProcurementHeadEmailV1',
    'clubAccountsPayableEmailV1','clubDashboardViewV1','clubCommitteeTermV1'
  ]);
  const ORDER=['clubEventTypesV1','clubCommitteeV1','clubStaffRegistryV1','clubEventsV2','clubMeetingsV1','clubFinanceV1','clubReimbursementPreApprovalsV1','clubBudgetV1','clubProcurementManagerEmailV1','clubProcurementHeadEmailV1','clubAccountsPayableEmailV1','clubDashboardViewV1','clubCommitteeTermV1'];
  let client=null,ready=false,flushTimer=null,flushing=false;
  const pending=new Set();
  const parse=v=>{try{return JSON.parse(v)}catch{return v}};
  const num=v=>Number(v||0);
  const str=v=>v===undefined||v===null?'':String(v);
  const nullable=v=>v===undefined||v===null||v===''?null:v;
  const date=v=>v?String(v).slice(0,10):null;
  const time=v=>v?String(v).slice(0,8):null;
  const iso=v=>v?new Date(v).toISOString():null;
  const now=()=>new Date().toISOString();
  const bool=v=>!!v;

  function status(state,message=''){
    window.dispatchEvent(new CustomEvent('club-sync-status',{detail:{status:state,message}}));
  }
  async function config(){
    const r=await fetch('/api/config',{cache:'no-store'});
    if(!r.ok)throw new Error('Vercel Supabase configuration is missing');
    return r.json();
  }
  async function ensureClient(){
    if(client)return client;
    const c=await config();
    if(!c.supabaseUrl||!c.supabaseAnonKey)throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel');
    client=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return client;
  }
  async function upsert(table,rows,onConflict='id'){
    if(!rows||!rows.length)return;
    const {error}=await client.from(table).upsert(rows,{onConflict});
    if(error)throw new Error(`${table}: ${error.message}`);
  }
  async function delEq(table,col,value){
    const {error}=await client.from(table).delete().eq(col,value);
    if(error)throw new Error(`${table}: ${error.message}`);
  }
  async function removeMissing(table,ids){
    const {data,error}=await client.from(table).select('id');
    if(error)throw new Error(`${table}: ${error.message}`);
    const keep=new Set((ids||[]).map(String));
    for(const r of data||[]){
      if(!keep.has(String(r.id))){
        const {error:e}=await client.from(table).delete().eq('id',r.id);
        if(e)throw new Error(`${table}: ${e.message}`);
      }
    }
  }
  async function replaceRows(table,col,value,rows,onConflict='id'){
    await delEq(table,col,value);
    await upsert(table,rows,onConflict);
  }

  async function syncEventTypes(arr){
    arr=Array.isArray(arr)?arr:[];
    const {data,error}=await client.from('event_types').select('id,name');
    if(error)throw error;
    const keep=new Set(arr.map(String));
    for(const r of data||[])if(!keep.has(r.name)){
      const {error:e}=await client.from('event_types').delete().eq('id',r.id);if(e)throw e;
    }
    await upsert('event_types',arr.map((name,i)=>({name,sort_order:i+1,is_active:true})),'name');
  }

  async function syncCommittee(arr){
    arr=Array.isArray(arr)?arr:[];
    await upsert('committee_members',arr.map(x=>({
      id:str(x.id),role:x.role||'',group_name:nullable(x.group),icon:nullable(x.icon),
      user_id:nullable(x.userId),staff_uid:nullable(x.staffUid||x.uid),
      name:nullable(x.name),uid:nullable(x.uid),contact:nullable(x.contact),email:nullable(x.email),
      term_start:date(x.start),term_end:date(x.end),status:x.status||'Active',availability:x.availability||'Available',leave_from:date(x.leaveFrom),leave_to:date(x.leaveTo),notes:nullable(x.notes),
      data:{...x,jobTitle:undefined,division:undefined,department:undefined,unit:undefined,audienceCategory:undefined},updated_at:now()
    })));
    await removeMissing('committee_members',arr.map(x=>str(x.id)));
  }

  async function syncStaff(arr){
    arr=Array.isArray(arr)?arr:[];
    const mapped=arr.map((x,i)=>({uid:str(x.uid||x.UID||`row-${i}`),full_name:x.name||x.Name||'',contact_no:nullable(x.contactNo||x.ContactNo||x.contact),email:nullable(x.email),status:x.status||'Active',data:x,updated_at:now()}));
    if(mapped.length)await upsert('staff',mapped,'uid');
    const {data,error}=await client.from('staff').select('id,uid');if(error)throw error;
    const keep=new Set(mapped.map(x=>x.uid));
    for(const r of data||[])if(!keep.has(String(r.uid||''))){const {error:e}=await client.from('staff').delete().eq('id',r.id);if(e)throw e;}
  }

  async function syncEvents(arr){
    arr=Array.isArray(arr)?arr:[];
    await upsert('events',arr.map(e=>({
      id:str(e.id),name:e.name||'',event_type:nullable(e.type),status:nullable(e.status),auto_status:nullable(e.autoStatus),manual_state:nullable(e.manualState),
      event_date:date(e.date),event_time:time(e.time),venue:nullable(e.venue),audience_type:e.audienceType||'ALL_STAFF',coordinator:nullable(e.coordinator),coordinator_role:nullable(e.coordinatorRole),coordinator_committee_id:nullable(e.coordinatorCommitteeId),
      expected_participants:num(e.participants),attendance_count:num(e.attendance),planned_budget:num(e.budget),description:nullable(e.description),
      archived:bool(e.archived),archived_at:iso(e.archivedAt),archive_reason:nullable(e.archiveReason),cancelled_at:iso(e.cancelledAt),
      finance_settlement_status:nullable(e.financeSettlementStatus),settlement_reference:nullable(e.settlementReference),actual_expense_total:num(e.actualExpenseTotal),actual_expense_remarks:nullable(e.actualExpenseRemarks),
      actual_entered_by:nullable(e.actualEnteredBy),actual_entered_at:iso(e.actualEnteredAt),finance_closed_at:iso(e.financeClosedAt),attendance_updated_at:iso(e.attendanceUpdatedAt),
      source_meeting_id:nullable(e.sourceMeetingId),source_meeting_title:nullable(e.sourceMeetingTitle),source_meeting_date:date(e.sourceMeetingDate),source_agenda_id:nullable(e.sourceAgendaId),source_agenda_title:nullable(e.sourceAgendaTitle),source_agenda_outcome:nullable(e.sourceAgendaOutcome),
      data:e,created_at:iso(e.createdAt)||now(),updated_at:now()
    })));
    await removeMissing('events',arr.map(e=>str(e.id)));

    for(const e of arr){
      const eid=str(e.id);
      const tasks=(e.tasks||[]).map((t,i)=>({
        event_id:eid,source_key:str(t.id??t.meetingActionId??i),task_text:t.text||t.task||t.title||'',owner:nullable(t.owner||t.assignedTo),owner_role:nullable(t.role),owner_committee_id:nullable(t.committeeId),
        due_date:date(t.dueDate),priority:nullable(t.priority),status:t.status||(t.done?'Completed':'Open'),done:bool(t.done),notes:nullable(t.notes),remarks:nullable(t.remarks||t.progressNote),availability:nullable(t.availability),
        source_meeting_id:nullable(t.meetingId),source_meeting_action_id:nullable(t.meetingActionId),source_meeting_action_status:nullable(t.meetingActionStatus),data:t,created_at:iso(t.createdAt)||now(),updated_at:iso(t.updatedAt)||now()
      }));
      await replaceRows('event_tasks','event_id',eid,tasks,'event_id,source_key');
      const {data:taskRows,error:te}=await client.from('event_tasks').select('id,source_key').eq('event_id',eid);if(te)throw te;
      const taskMap=new Map((taskRows||[]).map(x=>[String(x.source_key),x.id]));
      for(let i=0;i<(e.tasks||[]).length;i++){
        const t=e.tasks[i],tk=str(t.id??t.meetingActionId??i),tid=taskMap.get(tk);if(!tid)continue;
        await delEq('event_task_history','event_task_id',tid);
        await upsert('event_task_history',(t.history||[]).map(h=>({event_task_id:tid,action:nullable(h.action),remarks:nullable(h.detail||h.remarks||h.note),actor_name:nullable(h.by||h.actor),created_at:iso(h.at||h.date)||now(),data:h})));
      }
      const attendance=(e.attendanceRoster||[]).map((a,i)=>({
        event_id:eid,staff_uid:str(a.uid||a.UID||`row-${i}`),staff_name:a.name||a.Name||'',contact_no:nullable(a.contact||a.contactNo||a.ContactNo),attendance_status:a.status||(a.attended===false?'Absent':'Present'),attended:a.attended!==false,marked_at:iso(a.markedAt),data:a
      }));
      await replaceRows('event_attendance','event_id',eid,attendance,'event_id,staff_uid');

      const actual=[];
      (e.actualExpenseLines||[]).forEach((x,i)=>actual.push({event_id:eid,line_type:'Summary',source_key:x.sourceKey||`S:${i}`,expense_item:x.description||x.expenseItem||x.item||'',approved_amount:num(x.approvedAmount),actual_amount:num(x.amount||x.actualAmount),variance_amount:num(x.variance),vendor_number:null,vendor_name:null,reference:nullable((x.reimbursementRefs||[]).join(', ')||x.reference),source_type:nullable(x.sourceType),expense_request_id:nullable(x.expenseRequestId),expense_line_no:x.lineIndex===null||x.lineIndex===undefined?null:num(x.lineIndex)+1,reimbursement_reference:nullable((x.reimbursementRefs||[]).join(', ')),ap_status:nullable(x.sourceStatus),is_reimbursement:bool(x.reimbursementRequired),manual_entered:bool(x.manualEntered),data:x}));
      (e.actualVendorRows||[]).forEach((x,i)=>actual.push({event_id:eid,line_type:'Vendor',source_key:`V:${i}`,expense_item:x.expenseItem||x.description||'',approved_amount:num(x.approvedAmount),actual_amount:num(x.actualAmount||x.amount),variance_amount:num(x.variance),vendor_number:nullable(x.vendorNumber),vendor_name:nullable(x.vendorName||x.vendor),reference:nullable(x.reference),data:x}));
      await replaceRows('event_actual_expenses','event_id',eid,actual,'event_id,source_key');
    }
  }

  async function syncMeetings(arr){
    arr=Array.isArray(arr)?arr:[];
    await upsert('meetings',arr.map(m=>({
      id:str(m.id),title:m.title||'',meeting_type:nullable(m.type),meeting_date:date(m.date),meeting_time:time(m.time),location:nullable(m.location),chair:nullable(m.chair),secretary:nullable(m.secretary),purpose:nullable(m.purpose),
      status:m.cancelled?'Cancelled':m.minutesFinalized?'Completed':nullable(m.status),minutes_finalized:bool(m.minutesFinalized),minutes_finalized_at:iso(m.minutesFinalizedAt),cancelled:bool(m.cancelled),cancelled_at:iso(m.cancelledAt),minutes:nullable(m.minutes),data:m,created_at:iso(m.createdAt)||now(),updated_at:now()
    })));
    await removeMissing('meetings',arr.map(m=>str(m.id)));
    for(const m of arr){
      const mid=str(m.id);
      await replaceRows('meeting_attendees','meeting_id',mid,(m.attendance||[]).map((a,i)=>({meeting_id:mid,source_key:str(a.committeeId||a.uid||i),committee_id:nullable(a.committeeId),attendee_name:a.name||'',attendee_uid:nullable(a.uid),attendee_role:nullable(a.role),attendance_status:nullable(a.status),data:a})),'meeting_id,source_key');
      const agendas=(m.agenda||[]).map((a,i)=>({id:`${mid}:A:${a.id??i}`,source_key:str(a.id??i),meeting_id:mid,sort_order:i+1,title:a.title||'',owner:nullable(a.owner),minutes_allocated:num(a.minutes),outcome:nullable(a.outcome),details:nullable(a.description),discussion:nullable(a.discussion),event_id:nullable(a.eventId),finance_id:nullable(a.financeId),created_event_id:nullable(a.createdEventId),carry_forward:bool(a.carryForward),source_meeting_id:nullable(a.sourceMeetingId),source_meeting_title:nullable(a.sourceMeetingTitle),source_agenda_id:nullable(a.sourceAgendaId),source_agenda_title:nullable(a.sourceAgendaTitle),source_action_id:nullable(a.sourceActionId),source_action_text:nullable(a.sourceActionText),created_at:iso(a.createdAt)||now(),data:a}));
      await replaceRows('meeting_agenda','meeting_id',mid,agendas);
      const agendaMap=new Map((m.agenda||[]).map((a,i)=>[String(a.id??i),`${mid}:A:${a.id??i}`]));
      await replaceRows('meeting_decisions','meeting_id',mid,(m.decisions||[]).map((d,i)=>({id:`${mid}:D:${d.id??i}`,source_key:str(d.id??i),meeting_id:mid,agenda_id:d.agendaId!==undefined&&d.agendaId!==''?agendaMap.get(String(d.agendaId))||null:null,decision_text:d.text||d.decision||'',outcome:nullable(d.outcome),owner:nullable(d.owner),event_id:nullable(d.eventId),created_at:iso(d.createdAt)||now(),data:d})));
      const actions=(m.actions||[]).map((a,i)=>({id:`${mid}:X:${a.id??i}`,source_key:str(a.id??i),meeting_id:mid,agenda_id:a.agendaId!==undefined&&a.agendaId!==''?agendaMap.get(String(a.agendaId))||null:null,action_text:a.text||a.action||'',assigned_to:nullable(a.owner||a.assignedTo),assigned_role:nullable(a.role),due_date:date(a.dueDate),priority:nullable(a.priority),status:a.status||(a.done?'Completed':'Open'),done:bool(a.done),event_id:nullable(a.eventId),remarks:nullable(a.remarks),progress_note:nullable(a.progressNote),carried_forward_from:nullable(a.carriedForwardFrom),data:a,created_at:iso(a.createdAt)||now(),updated_at:iso(a.updatedAt)||now()}));
      await replaceRows('meeting_actions','meeting_id',mid,actions);
      for(let i=0;i<(m.actions||[]).length;i++){
        const a=m.actions[i],aid=`${mid}:X:${a.id??i}`;
        await delEq('meeting_action_history','meeting_action_id',aid);
        await upsert('meeting_action_history',(a.history||[]).map(h=>({meeting_action_id:aid,action:nullable(h.action),old_status:nullable(h.oldStatus),new_status:nullable(h.newStatus),remarks:nullable(h.detail||h.remarks||h.note),actor_name:nullable(h.by||h.actor),changed_at:iso(h.at||h.date)||now(),data:h})));
      }
    }
  }

  async function syncFinance(arr){
    arr=Array.isArray(arr)?arr:[];

    // A secure-link final decision is written directly by the server.
    // Never let an older browser copy rewind Approved/Rejected back to Pending Final Approval.
    if(arr.length){
      const ids=arr.map(r=>str(r.id)).filter(Boolean);
      const {data:serverRows,error:serverError}=await client.from('expense_requests')
        .select('id,status,president_recommendation,president_comment,recommended_by_name,recommended_by_role,president_approval_token,president_approval_token_expires_at,president_approval_token_used_at,president_approval_email_status,president_approval_email_sent_at,president_approval_email_error,final_approver_comment,approved_by_name,approved_by_role,approved_at,final_approval_channel,final_approval_token,final_approval_token_expires_at,final_approval_token_used_at,final_approval_email_status,final_approval_email_sent_at,final_approval_email_error,budget_available_before_approval,budget_available_after_approval')
        .in('id',ids);
      if(serverError)throw serverError;
      const serverById=new Map((serverRows||[]).map(x=>[String(x.id),x]));
      let corrected=false;
      for(const r of arr){
        const s=serverById.get(String(r.id));
        const serverFinal=['Approved','Rejected'].includes(s?.status) && !!s?.final_approval_token_used_at;
        const serverPresidentAdvanced=s?.status==='Pending Final Approval' && !!s?.president_approval_token_used_at;
        const localBehindPresident=r.status==='Pending President Recommendation';
        const localBehindFinal=r.status==='Pending Final Approval'||localBehindPresident;
        if((serverFinal&&localBehindFinal)||(serverPresidentAdvanced&&localBehindPresident)){
          r.status=s.status;
          r.presidentRecommendation=s.president_recommendation||r.presidentRecommendation||'';
          r.presidentComment=s.president_comment||r.presidentComment||'';
          r.recommendedByName=s.recommended_by_name||r.recommendedByName||'';
          r.recommendedByRole=s.recommended_by_role||r.recommendedByRole||'';
          r.presidentApprovalToken=s.president_approval_token||'';
          r.presidentApprovalTokenExpiresAt=s.president_approval_token_expires_at||'';
          r.presidentApprovalTokenUsedAt=s.president_approval_token_used_at||'';
          r.presidentApprovalEmailStatus=s.president_approval_email_status||r.presidentApprovalEmailStatus||'';
          r.presidentApprovalEmailSentAt=s.president_approval_email_sent_at||r.presidentApprovalEmailSentAt||'';
          r.presidentApprovalEmailError=s.president_approval_email_error||'';
          r.finalApprovalEmailStatus=s.final_approval_email_status||r.finalApprovalEmailStatus||'';
          r.finalApprovalEmailSentAt=s.final_approval_email_sent_at||r.finalApprovalEmailSentAt||'';
          r.finalApprovalEmailError=s.final_approval_email_error||'';

          r.finalApproverComment=s.final_approver_comment||r.finalApproverComment||'';
          r.approvedByName=s.approved_by_name||r.approvedByName||'';
          r.approvedByRole=s.approved_by_role||r.approvedByRole||'';
          r.approvedAt=s.approved_at||r.approvedAt||'';
          r.finalApprovalChannel=s.final_approval_channel||r.finalApprovalChannel||'';
          r.finalApprovalToken=s.final_approval_token||'';
          r.finalApprovalTokenExpiresAt=s.final_approval_token_expires_at||'';
          r.finalApprovalTokenUsedAt=s.final_approval_token_used_at||'';
          r.budgetAvailableBeforeApproval=s.budget_available_before_approval;
          r.budgetAvailableAfterApproval=s.budget_available_after_approval;
          corrected=true;
        }
      }
      if(corrected){
        nativeSet('clubFinanceV1',JSON.stringify(arr));
        window.dispatchEvent(new CustomEvent('club-finance-server-update',{detail:{reason:'terminal-status-protected'}}));
      }
    }

    await upsert('expense_requests',arr.map(r=>({
      id:str(r.id),request_number:nullable(r.number),title:nullable(r.title),event_id:nullable(r.eventId),event_name:nullable(r.eventName),request_date:date(r.date),category:nullable(r.category),purpose:nullable(r.purpose),requested_by:nullable(r.requestedBy),requester_role:nullable(r.requesterRole),
      prepared_by_name:nullable(r.preparedByName),prepared_by_role:nullable(r.preparedByRole),prepared_at:iso(r.preparedAt),submitted_at:iso(r.submittedAt),status:r.status||'Draft',subtotal:num(r.subtotal),contingency_percent:r.subtotal?num(r.contingency)/num(r.subtotal)*100:5,contingency_amount:num(r.contingency),total_amount:num(r.total),
      president_availability:nullable(r.presidentAvailability),president_recommendation:nullable(r.presidentRecommendation),president_comment:nullable(r.presidentComment),recommended_by_name:nullable(r.recommendedByName),recommended_by_role:nullable(r.recommendedByRole),president_email:nullable(r.presidentEmail),president_approval_token:nullable(r.presidentApprovalToken),president_approval_token_expires_at:iso(r.presidentApprovalTokenExpiresAt),president_approval_token_used_at:iso(r.presidentApprovalTokenUsedAt),president_approval_email_sent_at:iso(r.presidentApprovalEmailSentAt),president_approval_email_status:nullable(r.presidentApprovalEmailStatus),president_approval_email_error:nullable(r.presidentApprovalEmailError),president_approval_email_message_id:nullable(r.presidentApprovalEmailMessageId),
      final_approver_name:nullable(r.finalApproverName),final_approver_role:nullable(r.finalApproverRole),final_approver_email:nullable(r.finalApproverEmail),final_approver_comment:nullable(r.finalApproverComment||r.viceChairComment),final_approval_token:nullable(r.finalApprovalToken),final_approval_token_expires_at:iso(r.finalApprovalTokenExpiresAt),final_approval_token_used_at:iso(r.finalApprovalTokenUsedAt),final_approval_email_sent_at:iso(r.finalApprovalEmailSentAt),final_approval_email_sent_by:nullable(r.finalApprovalEmailSentBy),final_approval_email_status:nullable(r.finalApprovalEmailStatus),final_approval_email_attempted_at:iso(r.finalApprovalEmailAttemptedAt),final_approval_email_error:nullable(r.finalApprovalEmailError),final_approval_email_automatic:bool(r.finalApprovalEmailAutomatic),final_approval_channel:nullable(r.finalApprovalChannel),
      approved_by_name:nullable(r.approvedByName),approved_by_role:nullable(r.approvedByRole),approved_at:iso(r.approvedAt),planned_event_budget:num(r.plannedEventBudget),previous_approved_event_spend:num(r.previousApprovedEventSpend),projected_event_spend:num(r.projectedEventSpend),over_budget:bool(r.overBudget),overrun_amount:num(r.overrunAmount),overrun_justification:nullable(r.overrunJustification),
      budget_available_before_approval:r.budgetAvailableBeforeApproval===undefined?null:num(r.budgetAvailableBeforeApproval),budget_available_after_approval:r.budgetAvailableAfterApproval===undefined?null:num(r.budgetAvailableAfterApproval),reversal_status:nullable(r.reversalStatus),reversal_reason:nullable(r.reversalReason),reversal_requested_by:nullable(r.reversalRequestedBy),reversal_requested_at:iso(r.reversalRequestedAt),reversal_president_comment:nullable(r.reversalPresidentComment),reversed_by:nullable(r.reversedBy),reversed_at:iso(r.reversedAt),
      data:r,created_at:iso(r.createdAt)||now(),updated_at:now()
    })));
    await removeMissing('expense_requests',arr.map(r=>str(r.id)));
    for(const r of arr){
      const rid=str(r.id);
      // Never erase child expense lines during a generic Finance/status/email sync.
      // Lines are only replaced when this browser actually holds a non-empty line snapshot.
      // Expense creation/edit validation already prevents saving a request with zero lines.
      if(Array.isArray(r.lines) && r.lines.length){
        await replaceRows('expense_lines','expense_request_id',rid,r.lines.map((l,i)=>({
          expense_request_id:rid,
          line_no:i+1,
          description:l.description||'',
          quantity:num(l.qty!==undefined?l.qty:(l.quantity!==undefined?l.quantity:1)),
          rate:num(l.rate),
          line_total:num(l.total!==undefined?l.total:(l.lineTotal!==undefined?l.lineTotal:num(l.qty!==undefined?l.qty:(l.quantity!==undefined?l.quantity:1))*num(l.rate))),
          vendor_number:nullable(l.vendorNumber),
          vendor:nullable(l.vendor||l.vendorName),
          reimbursement_required:bool(l.reimbursementRequired),
          data:l
        })),'expense_request_id,line_no');
      }
      await delEq('expense_approvals','expense_request_id',rid);
      const approvals=[];
      if(r.presidentRecommendation||r.recommendedByName||r.presidentComment){approvals.push({expense_request_id:rid,stage:'President Recommendation',decision:r.presidentRecommendation||'Recorded',approver_name:nullable(r.recommendedByName),approver_role:nullable(r.recommendedByRole||'President'),comment:nullable(r.presidentComment),decided_at:iso(r.recommendedAt||r.presidentRecommendedAt||r.submittedAt)||now(),data:{recommendation:r.presidentRecommendation,comment:r.presidentComment}})}
      if(['Approved','Rejected'].includes(r.status)&&r.approvedByName){approvals.push({expense_request_id:rid,stage:'Final Approval',decision:r.status,approver_name:nullable(r.approvedByName),approver_role:nullable(r.approvedByRole),comment:nullable(r.finalApproverComment||r.viceChairComment),decided_at:iso(r.approvedAt)||now(),channel:nullable(r.finalApprovalChannel),data:{channel:r.finalApprovalChannel}})}
      await upsert('expense_approvals',approvals);
      await delEq('expense_reversals','expense_request_id',rid);
      if(r.reversalStatus&&r.reversalStatus!=='None')await upsert('expense_reversals',[{expense_request_id:rid,requested_by_name:nullable(r.reversalRequestedBy),reason:r.reversalReason||'',status:r.reversalStatus,president_comment:nullable(r.reversalPresidentComment),requested_at:iso(r.reversalRequestedAt)||now(),decided_at:iso(r.reversedAt),decided_by_name:nullable(r.reversedBy),data:{reversalRequestedBy:r.reversalRequestedBy,reversedBy:r.reversedBy}}]);
    }
  }

  async function syncReimbursements(arr){
    arr=Array.isArray(arr)?arr:[];
    await upsert('reimbursement_cases',arr.map(r=>({
      id:str(r.id),case_ref:nullable(r.caseRef||r.ref),reference_no:nullable(r.ref),expense_request_id:nullable(r.expenseRequestId),expense_request_number:nullable(r.expenseRequestNumber),expense_line_no:r.lineIndex===undefined?null:num(r.lineIndex)+1,event_id:nullable(r.eventId),event_name:nullable(r.eventName),expense_item:nullable(r.expenseItem),approved_item_amount:num(r.approvedItemAmount),route:r.route||'Standard',status:r.status||'Draft',reason:nullable(r.reason),expected_expense_date:date(r.expectedExpenseDate),notes:nullable(r.notes),requested_by:nullable(r.requestedBy),
      procurement_manager_email:nullable(r.managerEmail||r.procurementManagerEmail),procurement_head_email:nullable(r.headEmail||r.procurementHeadEmail),email_reference:nullable(r.emailReference),email_attachment_name:nullable(r.emailAttachmentName),email_prepared_at:iso(r.emailPreparedAt),email_sent_at:iso(r.emailSentAt),email_provider:nullable(r.emailProvider),email_provider_message_id:nullable(r.emailProviderMessageId),procurement_comment:nullable(r.procurementComment),procurement_response_by:nullable(r.responseBy),procurement_response_date:date(r.responseDate),
      exception_ref:nullable(r.exceptionRef),exception_reason:nullable(r.exceptionReason),exception_remarks:nullable(r.exceptionRemarks),exception_expense_date:date(r.exceptionExpenseDate),recorded_by:nullable(r.recordedBy),recorded_at:iso(r.recordedAt),data:r,created_at:iso(r.createdAt)||now(),updated_at:now()
    })));
    await removeMissing('reimbursement_cases',arr.map(r=>str(r.id)));
    for(const r of arr){
      const rid=str(r.id);
      await replaceRows('reimbursement_history','reimbursement_id',rid,(r.history||[]).map(h=>({reimbursement_id:rid,action:nullable(h.action||h.event),status:nullable(h.status),remarks:nullable(h.remarks||h.note||h.detail),actor_name:nullable(h.by||h.actor),created_at:iso(h.at||h.date)||now(),data:h})));
      const batches=r.apBatches||[];
      const {data:existing,error}=await client.from('ap_batches').select('id').eq('reimbursement_id',rid);if(error)throw error;
      const keep=new Set(batches.map((b,i)=>str(b.id||`${rid}-B${i+1}`)));
      for(const x of existing||[])if(!keep.has(str(x.id))){const {error:e}=await client.from('ap_batches').delete().eq('id',x.id);if(e)throw e;}
      for(let i=0;i<batches.length;i++){
        const b=batches[i],bid=str(b.id||`${rid}-B${i+1}`);
        await upsert('ap_batches',[{id:bid,reimbursement_id:rid,submission_ref:nullable(b.ref||b.apSubmissionRef),submission_date:date(b.submissionDate),status:b.status||'Draft',ap_email:nullable(b.apEmail),email_remarks:nullable(b.emailRemarks),bills_attachment_name:nullable(b.billsAttachmentName),bills_attachment_type:nullable(b.billsAttachmentType),bills_attachment_stored:bool(b.billsAttachmentStored),sent_at:iso(b.sentAt||b.apSentAt),status_date:date(b.statusDate),status_remarks:nullable(b.statusRemarks),updated_at:iso(b.updatedAt)||now(),data:b}]);
        await replaceRows('ap_bills','ap_batch_id',bid,(b.bills||[]).map((v,j)=>({ap_batch_id:bid,line_no:j+1,bill_date:date(v.billDate||v.date),vendor_number:nullable(v.vendorAccount||v.vendorNumber),vendor_name:nullable(v.vendorName||v.vendor),worker_id:nullable(v.workerId),amount:num(v.amount||v.billAmount),data:v})),'ap_batch_id,line_no');
      }
    }
  }

  async function syncBudget(v){
    const year=new Date().getFullYear();
    await upsert('budgets',[{budget_year:year,category:'UnitedBML',approved_amount:num(v),updated_at:now()}],'budget_year');
  }
  async function syncSetting(key,v){await upsert('app_settings',[{setting_key:key,setting_value:parse(v),updated_at:now()}],'setting_key');}

  async function syncKey(key,value){
    const v=parse(value);
    if(key==='clubEventTypesV1')return syncEventTypes(v);
    if(key==='clubCommitteeV1')return syncCommittee(v);
    if(key==='clubStaffRegistryV1')return syncStaff(v);
    if(key==='clubEventsV2')return syncEvents(v);
    if(key==='clubMeetingsV1')return syncMeetings(v);
    if(key==='clubFinanceV1')return syncFinance(v);
    if(key==='clubReimbursementPreApprovalsV1')return syncReimbursements(v);
    if(key==='clubBudgetV1')return syncBudget(v);
    return syncSetting(key,value);
  }

  function enqueue(key){
    if(!ready||!SYNC_KEYS.has(key)||!client)return;
    pending.add(key);
    clearTimeout(flushTimer);
    flushTimer=setTimeout(flush,180);
  }
  async function flush(){
    if(flushing||!ready||!pending.size)return;
    flushing=true;status('syncing');
    const keys=ORDER.filter(k=>pending.has(k));keys.forEach(k=>pending.delete(k));
    try{
      for(const k of keys){const v=localStorage.getItem(k);if(v!==null)await syncKey(k,v);}
      status('synced');
    }catch(e){
      console.error('UnitedBML Supabase sync failed',e);keys.forEach(k=>pending.add(k));status('error',e.message||String(e));
      clearTimeout(flushTimer);flushTimer=setTimeout(flush,5000);
    }finally{flushing=false;if(pending.size&&!flushTimer)flushTimer=setTimeout(flush,250);}
  }
  localStorage.setItem=function(k,v){nativeSet(k,String(v));enqueue(k)};

  async function loadProfile(user){
    const {data,error}=await client.from('profiles').select('id,email,full_name,role,committee_slot,status,member_uid,contact_no,avatar_url,updated_at').eq('id',user.id).single();
    if(error)throw new Error('Your UnitedBML profile is not configured. Run the schema migration or assign your user profile.');
    if(data.status==='Inactive')throw new Error('Your UnitedBML account is inactive.');
    const roleAliases={
      'administrator':'Administrator','admin':'Administrator','chairperson':'Chairperson','chair person':'Chairperson',
      'vice chairperson':'Vice Chairperson','vice chair person':'Vice Chairperson','vicechairperson':'Vice Chairperson',
      'president':'President','treasurer':'Treasurer','secretary':'Secretary',
      'male coordinator 1':'Male Coordinator 1','male coordinator1':'Male Coordinator 1',
      'male coordinator 2':'Male Coordinator 2','male coordinator2':'Male Coordinator 2',
      'communications coordinator':'Communications Coordinator','communication coordinator':'Communications Coordinator',
      'atoll coordinator':'Atoll Coordinator','atoll representative':'Atoll Representative',
      'head of total rewards & employee relations':'Head of Total Rewards & Employee Relations',
      'head of talent acquisition & people development':'Head of Talent Acquisition & People Development',
      'head of employee experience & hr business partnering':'Head of Employee Experience & HR Business Partnering',
      'external event official':'External Event Official','team manager':'Team Manager',
      'participant':'Staff Member','staff member':'Staff Member','staff':'Staff Member'
    };
    const roleKey=String(data.role||'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
    const profile={...data,role:roleAliases[roleKey]||data.role||'Staff Member',email:data.email||user.email};nativeSet('clubAuthProfileV1',JSON.stringify(profile));return profile;
  }
  function merge(base,over){return Object.assign({},base||{},over||{});}

  async function hydrate(){
    const q=await Promise.all([
      client.from('event_types').select('*').eq('is_active',true).order('sort_order'),client.from('committee_members').select('*').order('id'),client.from('staff').select('*').order('full_name'),
      client.from('events').select('*').order('event_date'),client.from('event_tasks').select('*'),client.from('event_task_history').select('*').order('created_at'),client.from('event_attendance').select('*'),client.from('event_actual_expenses').select('*'),
      client.from('meetings').select('*').order('meeting_date'),client.from('meeting_attendees').select('*'),client.from('meeting_agenda').select('*').order('sort_order'),client.from('meeting_decisions').select('*').order('created_at'),client.from('meeting_actions').select('*').order('created_at'),client.from('meeting_action_history').select('*').order('changed_at'),
      client.from('expense_requests').select('*').order('created_at'),client.from('expense_lines').select('*').order('line_no'),
      client.from('reimbursement_cases').select('*').order('created_at'),client.from('reimbursement_history').select('*').order('created_at'),client.from('ap_batches').select('*').order('created_at'),client.from('ap_bills').select('*').order('line_no'),client.from('vendor_master').select('*').order('name'),
      client.from('budgets').select('*').order('budget_year',{ascending:false}).limit(1),client.from('app_settings').select('*')
    ]);
    for(const x of q)if(x.error)throw new Error(x.error.message);
    const [types,committee,staff,evs,tasks,taskHist,att,actuals,mts,mat,mag,mdec,mact,mhist,fin,flines,reimb,rhist,batches,bills,vendors,budget,settings]=q.map(x=>x.data||[]);

    const histByTask=new Map();for(const h of taskHist){if(!histByTask.has(h.event_task_id))histByTask.set(h.event_task_id,[]);histByTask.get(h.event_task_id).push(h.data&&Object.keys(h.data).length?h.data:{at:h.created_at,action:h.action,remarks:h.remarks,by:h.actor_name});}
    const tasksByEvent=new Map();for(const t of tasks){if(!tasksByEvent.has(t.event_id))tasksByEvent.set(t.event_id,[]);const x=merge(t.data,{text:t.task_text,owner:t.owner,role:t.owner_role,dueDate:t.due_date,priority:t.priority,status:t.status,done:t.done,notes:t.notes,remarks:t.remarks,availability:t.availability,meetingId:t.source_meeting_id,meetingActionId:t.source_meeting_action_id,meetingActionStatus:t.source_meeting_action_status,history:histByTask.get(t.id)||[]});tasksByEvent.get(t.event_id).push(x);}
    const attByEvent=new Map();for(const a of att){if(!attByEvent.has(a.event_id))attByEvent.set(a.event_id,[]);attByEvent.get(a.event_id).push(merge(a.data,{uid:a.staff_uid,name:a.staff_name,contact:a.contact_no,status:a.attendance_status,attended:a.attended,markedAt:a.marked_at}));}
    const actualByEvent=new Map();for(const a of actuals){if(!actualByEvent.has(a.event_id))actualByEvent.set(a.event_id,{summary:[],vendor:[]});const x=merge(a.data,{sourceKey:a.source_key,expenseItem:a.expense_item,approvedAmount:num(a.approved_amount),actualAmount:num(a.actual_amount),amount:num(a.actual_amount),variance:num(a.variance_amount),vendorNumber:a.vendor_number,vendorName:a.vendor_name,reference:a.reference,sourceType:a.source_type||a.data?.sourceType||'',expenseRequestId:a.expense_request_id||a.data?.expenseRequestId||'',lineIndex:a.expense_line_no?num(a.expense_line_no)-1:(a.data?.lineIndex??null),reimbursementRefs:a.reimbursement_reference?String(a.reimbursement_reference).split(',').map(x=>x.trim()).filter(Boolean):(a.data?.reimbursementRefs||[]),sourceStatus:a.ap_status||a.data?.sourceStatus||'',reimbursementRequired:!!a.is_reimbursement,manualEntered:!!a.manual_entered});actualByEvent.get(a.event_id)[a.line_type==='Vendor'?'vendor':'summary'].push(x);}
    const events=evs.map(e=>{const a=actualByEvent.get(e.id)||{summary:[],vendor:[]};return merge(e.data,{id:Number.isFinite(Number(e.id))?Number(e.id):e.id,name:e.name,type:e.event_type,status:e.status,autoStatus:e.auto_status,manualState:e.manual_state,date:e.event_date,time:e.event_time?String(e.event_time).slice(0,5):'',venue:e.venue,audienceType:e.audience_type||e.data?.audienceType||'ALL_STAFF',coordinator:e.coordinator,coordinatorRole:e.coordinator_role,coordinatorCommitteeId:e.coordinator_committee_id,participants:num(e.expected_participants),attendance:num(e.attendance_count),budget:num(e.planned_budget),description:e.description,archived:e.archived,archivedAt:e.archived_at||'',archiveReason:e.archive_reason||'',cancelledAt:e.cancelled_at||'',financeSettlementStatus:e.finance_settlement_status||'Pending Actuals',settlementReference:e.settlement_reference||'',actualExpenseTotal:num(e.actual_expense_total),actualExpenseRemarks:e.actual_expense_remarks||'',actualEnteredBy:e.actual_entered_by||'',actualEnteredAt:e.actual_entered_at||'',financeClosedAt:e.finance_closed_at||'',attendanceUpdatedAt:e.attendance_updated_at||'',sourceMeetingId:e.source_meeting_id||'',sourceMeetingTitle:e.source_meeting_title||'',sourceMeetingDate:e.source_meeting_date||'',sourceAgendaId:e.source_agenda_id||'',sourceAgendaTitle:e.source_agenda_title||'',sourceAgendaOutcome:e.source_agenda_outcome||'',createdAt:e.created_at,tasks:tasksByEvent.get(e.id)||[],attendanceRoster:attByEvent.get(e.id)||[],actualExpenseLines:a.summary,actualVendorRows:a.vendor});});

    const agendaByMeeting=new Map();for(const a of mag){if(!agendaByMeeting.has(a.meeting_id))agendaByMeeting.set(a.meeting_id,[]);agendaByMeeting.get(a.meeting_id).push(merge(a.data,{id:a.source_key,title:a.title,owner:a.owner,minutes:num(a.minutes_allocated),outcome:a.outcome,description:a.details,discussion:a.discussion,eventId:a.event_id||'',financeId:a.finance_id||'',createdEventId:a.created_event_id||'',carryForward:a.carry_forward,sourceMeetingId:a.source_meeting_id||'',sourceMeetingTitle:a.source_meeting_title||'',sourceAgendaId:a.source_agenda_id||'',sourceAgendaTitle:a.source_agenda_title||'',sourceActionId:a.source_action_id||'',sourceActionText:a.source_action_text||'',createdAt:a.created_at}));}
    const attendeesByMeeting=new Map();for(const a of mat){if(!attendeesByMeeting.has(a.meeting_id))attendeesByMeeting.set(a.meeting_id,[]);attendeesByMeeting.get(a.meeting_id).push(merge(a.data,{committeeId:a.committee_id||a.source_key,name:a.attendee_name,uid:a.attendee_uid,role:a.attendee_role,status:a.attendance_status}));}
    const decisionsByMeeting=new Map();for(const d of mdec){if(!decisionsByMeeting.has(d.meeting_id))decisionsByMeeting.set(d.meeting_id,[]);decisionsByMeeting.get(d.meeting_id).push(merge(d.data,{id:d.source_key,text:d.decision_text,outcome:d.outcome,owner:d.owner,eventId:d.event_id||'',createdAt:d.created_at}));}
    const histByAction=new Map();for(const h of mhist){if(!histByAction.has(h.meeting_action_id))histByAction.set(h.meeting_action_id,[]);histByAction.get(h.meeting_action_id).push(h.data&&Object.keys(h.data).length?h.data:{at:h.changed_at,action:h.action,detail:h.remarks,by:h.actor_name,oldStatus:h.old_status,newStatus:h.new_status});}
    const actionsByMeeting=new Map();for(const a of mact){if(!actionsByMeeting.has(a.meeting_id))actionsByMeeting.set(a.meeting_id,[]);actionsByMeeting.get(a.meeting_id).push(merge(a.data,{id:a.source_key,text:a.action_text,owner:a.assigned_to,role:a.assigned_role,dueDate:a.due_date,priority:a.priority,status:a.status,done:a.done,eventId:a.event_id||'',remarks:a.remarks,progressNote:a.progress_note,carriedForwardFrom:a.carried_forward_from,createdAt:a.created_at,updatedAt:a.updated_at,history:histByAction.get(a.id)||[]}));}
    const meetings=mts.map(m=>merge(m.data,{id:Number.isFinite(Number(m.id))?Number(m.id):m.id,title:m.title,type:m.meeting_type,date:m.meeting_date,time:m.meeting_time?String(m.meeting_time).slice(0,5):'',location:m.location,chair:m.chair,secretary:m.secretary,purpose:m.purpose,status:m.status,minutesFinalized:m.minutes_finalized,minutesFinalizedAt:m.minutes_finalized_at||'',cancelled:m.cancelled,cancelledAt:m.cancelled_at||'',createdAt:m.created_at,agenda:agendaByMeeting.get(m.id)||[],attendance:attendeesByMeeting.get(m.id)||[],decisions:decisionsByMeeting.get(m.id)||[],actions:actionsByMeeting.get(m.id)||[]}));

    const normalizeExpenseLine=l=>merge(l?.data||l||{},{
      description:l?.description??l?.data?.description??'',
      qty:num(l?.quantity!==undefined?l.quantity:(l?.qty!==undefined?l.qty:(l?.data?.qty!==undefined?l.data.qty:l?.data?.quantity))),
      rate:num(l?.rate!==undefined?l.rate:l?.data?.rate),
      total:num(l?.line_total!==undefined?l.line_total:(l?.total!==undefined?l.total:(l?.lineTotal!==undefined?l.lineTotal:l?.data?.total))),
      vendorNumber:l?.vendor_number??l?.vendorNumber??l?.data?.vendorNumber??null,
      vendor:l?.vendor??l?.data?.vendor??l?.data?.vendorName??null,
      reimbursementRequired:bool(l?.reimbursement_required!==undefined?l.reimbursement_required:(l?.reimbursementRequired!==undefined?l.reimbursementRequired:l?.data?.reimbursementRequired))
    });
    const linesByRequest=new Map();
    for(const l of flines){
      const key=String(l.expense_request_id);
      if(!linesByRequest.has(key))linesByRequest.set(key,[]);
      linesByRequest.get(key).push(normalizeExpenseLine(l));
    }
    const finance=fin.map(r=>{
      const dbLines=linesByRequest.get(String(r.id))||[];
      const snapshotLines=Array.isArray(r.data?.lines)?r.data.lines.map(normalizeExpenseLine):[];
      return merge(r.data,{id:Number.isFinite(Number(r.id))?Number(r.id):r.id,number:r.request_number,title:r.title,eventId:r.event_id?Number(r.event_id)||r.event_id:'',eventName:r.event_name||'',date:r.request_date,category:r.category||'',purpose:r.purpose||'',requestedBy:r.requested_by||'',requesterRole:r.requester_role||'',preparedByName:r.prepared_by_name||'',preparedByRole:r.prepared_by_role||'',preparedAt:r.prepared_at||'',submittedAt:r.submitted_at||'',status:r.status,subtotal:num(r.subtotal),contingency:num(r.contingency_amount),total:num(r.total_amount),presidentAvailability:r.president_availability||'Available',presidentRecommendation:r.president_recommendation||'',presidentComment:r.president_comment||'',recommendedByName:r.recommended_by_name||'',recommendedByRole:r.recommended_by_role||'',presidentEmail:r.president_email||'',presidentApprovalToken:r.president_approval_token||'',presidentApprovalTokenExpiresAt:r.president_approval_token_expires_at||'',presidentApprovalTokenUsedAt:r.president_approval_token_used_at||'',presidentApprovalEmailSentAt:r.president_approval_email_sent_at||'',presidentApprovalEmailStatus:r.president_approval_email_status||'',presidentApprovalEmailError:r.president_approval_email_error||'',presidentApprovalEmailMessageId:r.president_approval_email_message_id||'',finalApproverName:r.final_approver_name||'',finalApproverRole:r.final_approver_role||'',finalApproverEmail:r.final_approver_email||'',finalApproverComment:r.final_approver_comment||'',finalApprovalToken:r.final_approval_token||'',finalApprovalTokenExpiresAt:r.final_approval_token_expires_at||'',finalApprovalTokenUsedAt:r.final_approval_token_used_at||'',finalApprovalEmailSentAt:r.final_approval_email_sent_at||'',finalApprovalEmailSentBy:r.final_approval_email_sent_by||'',finalApprovalEmailStatus:r.final_approval_email_status||r.data?.finalApprovalEmailStatus||'',finalApprovalEmailAttemptedAt:r.final_approval_email_attempted_at||r.data?.finalApprovalEmailAttemptedAt||'',finalApprovalEmailError:r.final_approval_email_error||r.data?.finalApprovalEmailError||'',finalApprovalEmailAutomatic:!!r.final_approval_email_automatic||!!r.data?.finalApprovalEmailAutomatic,finalApprovalChannel:r.final_approval_channel||'',approvedByName:r.approved_by_name||'',approvedByRole:r.approved_by_role||'',approvedAt:r.approved_at||'',plannedEventBudget:num(r.planned_event_budget),previousApprovedEventSpend:num(r.previous_approved_event_spend),projectedEventSpend:num(r.projected_event_spend),overBudget:r.over_budget,overrunAmount:num(r.overrun_amount),overrunJustification:r.overrun_justification||'',budgetAvailableBeforeApproval:r.budget_available_before_approval,budgetAvailableAfterApproval:r.budget_available_after_approval,reversalStatus:r.reversal_status||'None',reversalReason:r.reversal_reason||'',reversalRequestedBy:r.reversal_requested_by||'',reversalRequestedAt:r.reversal_requested_at||'',reversalPresidentComment:r.reversal_president_comment||'',reversedBy:r.reversed_by||'',reversedAt:r.reversed_at||'',createdAt:r.created_at,lines:dbLines.length?dbLines:snapshotLines});
    });

    const histByReimb=new Map();for(const h of rhist){if(!histByReimb.has(h.reimbursement_id))histByReimb.set(h.reimbursement_id,[]);histByReimb.get(h.reimbursement_id).push(h.data&&Object.keys(h.data).length?h.data:{at:h.created_at,action:h.action,status:h.status,remarks:h.remarks,by:h.actor_name});}
    const billsByBatch=new Map();for(const b of bills){if(!billsByBatch.has(b.ap_batch_id))billsByBatch.set(b.ap_batch_id,[]);billsByBatch.get(b.ap_batch_id).push(merge(b.data,{billDate:b.bill_date,vendorAccount:b.vendor_number,vendorNumber:b.vendor_number,vendorName:b.vendor_name,workerId:b.worker_id||'',amount:num(b.amount)}));}
    const batchByReimb=new Map();for(const b of batches){if(!batchByReimb.has(b.reimbursement_id))batchByReimb.set(b.reimbursement_id,[]);batchByReimb.get(b.reimbursement_id).push(merge(b.data,{id:b.id,ref:b.submission_ref,submissionDate:b.submission_date,status:b.status,apEmail:b.ap_email,emailRemarks:b.email_remarks,billsAttachmentName:b.bills_attachment_name,billsAttachmentType:b.bills_attachment_type,billsAttachmentStored:b.bills_attachment_stored,sentAt:b.sent_at,statusDate:b.status_date,statusRemarks:b.status_remarks,updatedAt:b.updated_at,bills:billsByBatch.get(b.id)||[]}));}
    const reimbursements=reimb.map(r=>merge(r.data,{id:Number.isFinite(Number(r.id))?Number(r.id):r.id,caseRef:r.case_ref||'',ref:r.reference_no||r.case_ref||'',expenseRequestId:r.expense_request_id?Number(r.expense_request_id)||r.expense_request_id:'',expenseRequestNumber:r.expense_request_number||'',lineIndex:r.expense_line_no?Number(r.expense_line_no)-1:0,eventId:r.event_id?Number(r.event_id)||r.event_id:'',eventName:r.event_name||'',expenseItem:r.expense_item||'',approvedItemAmount:num(r.approved_item_amount),route:r.route,status:r.status,reason:r.reason||'',expectedExpenseDate:r.expected_expense_date||'',notes:r.notes||'',requestedBy:r.requested_by||'',managerEmail:r.procurement_manager_email||'',headEmail:r.procurement_head_email||'',emailReference:r.email_reference||'',emailAttachmentName:r.email_attachment_name||'',emailPreparedAt:r.email_prepared_at||'',emailSentAt:r.email_sent_at||'',emailProvider:r.email_provider||'',emailProviderMessageId:r.email_provider_message_id||'',procurementComment:r.procurement_comment||'',responseBy:r.procurement_response_by||'',responseDate:r.procurement_response_date||'',exceptionRef:r.exception_ref||'',exceptionReason:r.exception_reason||'',exceptionRemarks:r.exception_remarks||'',exceptionExpenseDate:r.exception_expense_date||'',recordedBy:r.recorded_by||'',recordedAt:r.recorded_at||'',history:histByReimb.get(r.id)||[],apBatches:batchByReimb.get(r.id)||[]}));

    const committeeState=committee.map(x=>{
      const staffRow=staff.find(s=>String(s.uid||'')===String(x.staff_uid||x.uid||''))||staff.find(s=>x.email&&String(s.email||'').toLowerCase()===String(x.email||'').toLowerCase())||{};
      return merge(x.data,{
        id:x.id,role:x.role,group:x.group_name,icon:x.icon,userId:x.user_id||'',staffUid:x.staff_uid||x.uid||'',
        name:x.name||staffRow.full_name||'',uid:x.staff_uid||x.uid||staffRow.uid||'',contact:x.contact||staffRow.contact_no||'',email:x.email||staffRow.email||'',
        jobTitle:staffRow.job_title||'',division:staffRow.division||'',department:staffRow.department||'',unit:staffRow.unit||'',
        start:x.term_start||'',end:x.term_end||'',status:x.status,availability:x.availability,leaveFrom:x.leave_from||'',leaveTo:x.leave_to||'',notes:x.notes||''
      });
    });
    const staffState=staff.map(x=>merge(x.data,{uid:x.uid,name:x.full_name,contactNo:x.contact_no||'',email:x.email||'',status:x.status}));
    const put=(k,v)=>nativeSet(k,typeof v==='string'?v:JSON.stringify(v));
    put('clubEventTypesV1',types.map(x=>x.name));put('clubCommitteeV1',committeeState);put('clubStaffRegistryV1',staffState);put('clubEventsV2',events);put('clubMeetingsV1',meetings);put('clubFinanceV1',finance);put('clubReimbursementPreApprovalsV1',reimbursements);put('clubVendorMasterV1',vendors.map(v=>({vendorAccount:v.vendor_account,name:v.name,workerId:v.worker_id||'',status:v.status||'Active'})));put('clubBudgetV1',budget.length?String(budget[0].approved_amount):'0');
    for(const x of settings)if(SYNC_KEYS.has(x.setting_key))put(x.setting_key,x.setting_value);
  }

  function showError(msg){const e=document.getElementById('clubLoginError');if(e){e.textContent=msg;e.style.display='block'}showLoginForm();}
  function setSync(msg){const q=document.getElementById('clubSyncMessage');if(q)q.textContent=msg||'Secure staff access';}
  function showLoadingState(subtext='Preparing your workspace'){const login=document.getElementById('clubLoginState'),loading=document.getElementById('clubLoadingState'),sub=document.getElementById('clubLoadingSubtext');if(login)login.style.display='none';if(loading)loading.style.display='block';if(sub)sub.textContent=subtext;}
  function showLoginForm(){const login=document.getElementById('clubLoginState'),loading=document.getElementById('clubLoadingState');if(login)login.style.display='block';if(loading)loading.style.display='none';const b=document.getElementById('clubLoginButton');if(b){b.disabled=false;b.textContent='Sign in'}}
  function hideOverlay(){const o=document.getElementById('clubAuthOverlay');if(o)o.style.display='none';}
  function showOverlay(){const o=document.getElementById('clubAuthOverlay');if(o)o.style.display='flex';}
  async function bootstrap(){
    try{
      await ensureClient();
      const params=new URLSearchParams(location.search);
      const publicApproval=params.get('approval')==='expense'&&params.get('id')&&params.get('token');
      if(publicApproval){
        hideOverlay();setSync('');window.dispatchEvent(new CustomEvent('club-public-approval-ready'));return;
      }

      const {data:{session},error:sessionError}=await client.auth.getSession();
      if(sessionError)throw sessionError;
      if(!session){
        showOverlay();showLoginForm();setSync('Secure staff access');return;
      }

      // Authentication/profile is the access gate.
      showOverlay();
      showLoadingState('Verifying your UnitedBML account');
      await loadProfile(session.user);

      // Operational hydration is deliberately isolated from authentication.
      // A schema/module problem must not masquerade as a login failure.
      let hydrationError=null;
      showLoadingState('Loading Management HUB');
      try{
        await hydrate();
        setupFinanceRealtime();
      }catch(e){
        hydrationError=e;
        console.error('UnitedBML operational data hydration failed:',e);
      }

      const stamp=`${session.user.id}:normalized-v2`;
      if(!hydrationError && sessionStorage.getItem('clubHydrated')!==stamp){
        sessionStorage.setItem('clubHydrated',stamp);
        location.reload();
        return;
      }

      ready=true;
      hideOverlay();

      if(hydrationError){
        setSync('Signed in · data sync issue');
        status('warning',hydrationError.message||String(hydrationError));
        window.dispatchEvent(new CustomEvent('club-backend-ready',{
          detail:{degraded:true,error:hydrationError.message||String(hydrationError)}
        }));
        window.dispatchEvent(new CustomEvent('club-backend-sync-warning',{
          detail:{error:hydrationError.message||String(hydrationError)}
        }));
      }else{
        setSync('');
        status('synced');
        window.dispatchEvent(new CustomEvent('club-backend-ready',{detail:{degraded:false}}));
      }
    }catch(e){
      console.error('UnitedBML authentication/bootstrap failed:',e);
      showOverlay();
      showLoginForm();
      showError(e.message||'Could not sign in to UnitedBML');
      status('error',e.message||String(e));
    }
  }
  async function signIn(email,password){
    await ensureClient();
    const cleanEmail=String(email||'').trim();
    if(!cleanEmail||!password)throw new Error('Enter your email and password');
    const {data,error}=await client.auth.signInWithPassword({email:cleanEmail,password:String(password)});
    if(error)throw error;
    if(!data?.session)throw new Error('Sign in completed without an active session');
    sessionStorage.removeItem('clubHydrated');
    location.reload();
    return data.session;
  }
  async function signOut(){try{await flush();await ensureClient();await client.auth.signOut();}finally{nativeRemove('clubAuthProfileV1');sessionStorage.removeItem('clubHydrated');location.reload();}}
  async function getMyAccount(){
    await ensureClient();
    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError)throw userError;
    if(!user)throw new Error('No authenticated user session');

    const {data:profile,error:profileError}=await client.from('profiles')
      .select('id,email,full_name,role,committee_slot,status,member_uid,contact_no,avatar_url,updated_at')
      .eq('id',user.id)
      .single();
    if(profileError)throw profileError;

    return {
      id:user.id,
      email:user.email||profile.email||'',
      fullName:profile.full_name||'',
      role:profile.role||'Staff Member',
      status:profile.status||'Active',
      memberUid:profile.member_uid||'',
      contactNo:profile.contact_no||'',
      avatarUrl:profile.avatar_url||'',
      committeeSlot:profile.committee_slot||'',
      createdAt:user.created_at||'',
      lastSignInAt:user.last_sign_in_at||'',
      provider:user.app_metadata?.provider||'email',
      emailConfirmedAt:user.email_confirmed_at||''
    };
  }

  async function updateMyProfile({fullName,memberUid,contactNo,avatarUrl}){
    await ensureClient();
    const {data,error}=await client.rpc('update_my_profile',{
      p_full_name:String(fullName||'').trim(),
      p_member_uid:String(memberUid||'').trim()||null,
      p_contact_no:String(contactNo||'').trim()||null,
      p_avatar_url:String(avatarUrl||'').trim()||null
    });
    if(error)throw error;

    const {data:{user}}=await client.auth.getUser();
    if(user)await loadProfile(user);
    return data;
  }


  async function getMyCommitteeLeave(){
    await ensureClient();
    const {data,error}=await client.rpc('get_my_committee_leave');
    if(error)throw error;
    return data||{isCommitteeMember:false};
  }

  async function updateMyCommitteeLeave(leaveFrom,leaveTo){
    await ensureClient();
    const {data,error}=await client.rpc('update_my_committee_leave',{
      p_leave_from:leaveFrom||null,
      p_leave_to:leaveTo||null
    });
    if(error)throw error;
    return data;
  }

  async function clearMyCommitteeLeave(){
    await ensureClient();
    const {data,error}=await client.rpc('clear_my_committee_leave');
    if(error)throw error;
    return data;
  }

  async function changeMyPassword(currentPassword,newPassword){
    await ensureClient();
    if(String(newPassword||'').length<8)throw new Error('New password must be at least 8 characters');

    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError)throw userError;
    if(!user?.email)throw new Error('Could not determine your account email');

    const {error:reauthError}=await client.auth.signInWithPassword({
      email:user.email,
      password:String(currentPassword||'')
    });
    if(reauthError)throw new Error('Current password is incorrect');

    const {error:updateError}=await client.auth.updateUser({password:String(newPassword)});
    if(updateError)throw updateError;
    return {ok:true};
  }

  async function signOutOtherSessions(){
    await ensureClient();
    const {error}=await client.auth.signOut({scope:'others'});
    if(error)throw error;
    return {ok:true};
  }

  async function invokeEmail(body){
    await ensureClient();
    const {data,error}=await client.functions.invoke('send-email',{body});
    if(error){
      let detail=error.message||'Email function failed';
      try{
        const res=error.context;
        if(res && typeof res.clone==='function'){
          const copy=res.clone();
          const ct=copy.headers?.get?.('content-type')||'';
          if(ct.includes('application/json')){const x=await copy.json();detail=x?.error||x?.message||detail}
          else {const x=await copy.text();if(x)detail=x}
        }
      }catch(_){}
      throw new Error(detail);
    }
    if(!data?.ok)throw new Error(data?.error||'Email failed');
    return data;
  }
  async function expenseApproval(payload){
    await ensureClient();
    const {data,error}=await client.functions.invoke('expense-approval',{body:payload});
    if(error){
      let detail=error.message||'Expense approval service failed';
      try{
        const res=error.context;
        if(res && typeof res.clone==='function'){
          const copy=res.clone();
          const ct=copy.headers?.get?.('content-type')||'';
          if(ct.includes('application/json')){const x=await copy.json();detail=x?.error||x?.message||detail}
          else {const x=await copy.text();if(x)detail=x}
        }
      }catch(_){}
      throw new Error(detail);
    }
    if(!data?.ok)throw new Error(data?.error||'Expense approval service failed');
    return data;
  }

  function applyFinanceServerRow(row){
    if(!row||row.id===undefined||row.id===null)return;
    const cached=parse(localStorage.getItem('clubFinanceV1'))||[];
    if(!Array.isArray(cached))return;
    const idx=cached.findIndex(x=>String(x.id)===String(row.id));
    if(idx<0)return;
    const r=cached[idx];
    Object.assign(r,{
      status:row.status||r.status,
      presidentRecommendation:row.president_recommendation??r.presidentRecommendation??'',
      presidentComment:row.president_comment??r.presidentComment??'',
      recommendedByName:row.recommended_by_name??r.recommendedByName??'',
      recommendedByRole:row.recommended_by_role??r.recommendedByRole??'',
      presidentApprovalToken:row.president_approval_token||'',
      presidentApprovalTokenExpiresAt:row.president_approval_token_expires_at||'',
      presidentApprovalTokenUsedAt:row.president_approval_token_used_at||'',
      presidentApprovalEmailStatus:row.president_approval_email_status??r.presidentApprovalEmailStatus??'',
      presidentApprovalEmailSentAt:row.president_approval_email_sent_at??r.presidentApprovalEmailSentAt??'',
      presidentApprovalEmailError:row.president_approval_email_error??r.presidentApprovalEmailError??'',
      finalApproverComment:row.final_approver_comment??r.finalApproverComment??'',
      approvedByName:row.approved_by_name??r.approvedByName??'',
      approvedByRole:row.approved_by_role??r.approvedByRole??'',
      approvedAt:row.approved_at??r.approvedAt??'',
      finalApprovalChannel:row.final_approval_channel??r.finalApprovalChannel??'',
      finalApprovalToken:row.final_approval_token||'',
      finalApprovalTokenExpiresAt:row.final_approval_token_expires_at||'',
      finalApprovalTokenUsedAt:row.final_approval_token_used_at||'',
      budgetAvailableBeforeApproval:row.budget_available_before_approval,
      budgetAvailableAfterApproval:row.budget_available_after_approval,
      reversalStatus:row.reversal_status??r.reversalStatus,
      reversalReason:row.reversal_reason??r.reversalReason
    });
    nativeSet('clubFinanceV1',JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('club-finance-server-update',{
      detail:{id:String(row.id),status:row.status||'',row}
    }));
  }

  async function refreshFinanceRequest(id){
    await ensureClient();
    const [{data,error},{data:lineRows,error:lineError}]=await Promise.all([
      client.from('expense_requests').select('*').eq('id',String(id)).maybeSingle(),
      client.from('expense_lines').select('*').eq('expense_request_id',String(id)).order('line_no')
    ]);
    if(error)throw error;
    if(lineError)throw lineError;
    if(data){
      applyFinanceServerRow(data);
      const cached=parse(localStorage.getItem('clubFinanceV1'))||[];
      if(Array.isArray(cached)){
        const idx=cached.findIndex(x=>String(x.id)===String(id));
        if(idx>=0){
          const dbLines=(lineRows||[]).map(l=>merge(l.data,{
            description:l.description||'',
            qty:num(l.quantity),
            rate:num(l.rate),
            total:num(l.line_total),
            vendorNumber:l.vendor_number,
            vendor:l.vendor,
            reimbursementRequired:bool(l.reimbursement_required)
          }));
          const fallback=Array.isArray(data.data?.lines)?data.data.lines:[];
          cached[idx].lines=dbLines.length?dbLines:fallback;
          nativeSet('clubFinanceV1',JSON.stringify(cached));
          window.dispatchEvent(new CustomEvent('club-finance-server-update',{
            detail:{id:String(id),status:data.status||'',row:data,linesRefreshed:true}
          }));
        }
      }
    }
    return data;
  }

  let financeRealtimeChannel=null;
  function setupFinanceRealtime(){
    if(!client||financeRealtimeChannel)return;
    financeRealtimeChannel=client.channel('unitedbml-expense-request-status')
      .on('postgres_changes',{
        event:'UPDATE',
        schema:'public',
        table:'expense_requests'
      },payload=>{
        try{applyFinanceServerRow(payload.new)}catch(err){console.error('Finance realtime merge failed',err)}
      })
      .subscribe(statusValue=>{
        if(statusValue==='SUBSCRIBED')status('synced');
      });
  }

  async function getCommitteeUserDirectory(){
    await ensureClient();
    const [{data:profiles,error:profileError},{data:staffRows,error:staffError},{data:classifications,error:classError}]=await Promise.all([
      client.from('profiles').select('id,email,full_name,role,committee_slot,status,member_uid,contact_no,avatar_url,committee_term_start,committee_term_end').eq('status','Active').order('full_name'),
      client.from('staff').select('uid,full_name,job_title,division,department,unit,contact_no,email,status').order('full_name'),
      client.from('staff_location_classification').select('match_type,match_value,audience_category,active').eq('active',true)
    ]);
    if(profileError)throw profileError;if(staffError)throw staffError;if(classError)throw classError;

    const normalize=v=>String(v||'').trim().toLowerCase();
    const staffByUid=new Map((staffRows||[]).filter(x=>x.uid).map(x=>[String(x.uid),x]));
    const staffByEmail=new Map((staffRows||[]).filter(x=>x.email).map(x=>[normalize(x.email),x]));
    const unitMap=new Map((classifications||[]).filter(x=>x.match_type==='UNIT').map(x=>[normalize(x.match_value),x.audience_category]));
    const deptMap=new Map((classifications||[]).filter(x=>x.match_type==='DEPARTMENT').map(x=>[normalize(x.match_value),x.audience_category]));

    return (profiles||[]).map(p=>{
      const staff=staffByUid.get(String(p.member_uid||''))||staffByEmail.get(normalize(p.email))||{};
      const unit=staff.unit||'',department=staff.department||'';
      const audienceCategory=unitMap.get(normalize(unit))||deptMap.get(normalize(department))||'UNCLASSIFIED';
      return {
        id:String(p.id),userId:String(p.id),
        name:staff.full_name||p.full_name||p.email||'UnitedBML User',
        email:p.email||staff.email||'',
        uid:p.member_uid||staff.uid||'',staffUid:p.member_uid||staff.uid||'',
        contact:p.contact_no||staff.contact_no||'',
        role:p.role||'Staff Member',committeeSlot:p.committee_slot||'',
        photo_url:p.avatar_url||'',avatar_url:p.avatar_url||'',
        termStart:p.committee_term_start||'',termEnd:p.committee_term_end||'',
        jobTitle:staff.job_title||'',division:staff.division||'',
        department:staff.department||'',unit:staff.unit||'',
        audienceCategory,
        staffMatched:!!staff.uid
      };
    });
  }

  async function verifyPresidentApprovalToken(id,token){
    await ensureClient();
    const {data,error}=await client.from('expense_requests').select('id,status,president_approval_token,president_approval_token_expires_at,president_approval_token_used_at,data').eq('id',String(id)).maybeSingle();
    if(error)throw error;if(!data)throw new Error('Expense request was not found in Supabase after saving');
    const stored=String(data.president_approval_token||data.data?.presidentApprovalToken||'').trim();
    const expires=data.president_approval_token_expires_at||data.data?.presidentApprovalTokenExpiresAt||'';
    const used=data.president_approval_token_used_at||data.data?.presidentApprovalTokenUsedAt||'';
    return {ok:data.status==='Pending President Recommendation'&&stored===String(token||'').trim()&&!!expires&&!used&&new Date(expires)>new Date(),row:data};
  }

  async function verifyExpenseApprovalToken(id,token){
    await ensureClient();
    const {data,error}=await client.from('expense_requests')
      .select('id,status,final_approval_token,final_approval_token_expires_at,final_approval_token_used_at')
      .eq('id',String(id))
      .maybeSingle();
    if(error)throw error;
    if(!data)throw new Error('Expense request was not found in Supabase after saving');
    return {
      ok:data.status==='Pending Final Approval' &&
         data.final_approval_token===token &&
         !!data.final_approval_token_expires_at &&
         !data.final_approval_token_used_at,
      row:data
    };
  }

  async function tournamentCurrentIdentity(){
    await ensureClient();
    const {data:{user},error}=await client.auth.getUser();if(error)throw error;if(!user)throw new Error('Not signed in');
    const [{data:profile,error:pe},{data:staffRow,error:se}]=await Promise.all([
      client.from('profiles').select('id,email,full_name,role,member_uid,contact_no').eq('id',user.id).maybeSingle(),
      client.from('staff').select('uid,full_name,email,contact_no,job_title,division,department,unit,data').eq('email',user.email).limit(1).maybeSingle()
    ]);if(pe)throw pe;if(se)throw se;
    return {userId:user.id,email:user.email||profile?.email||staffRow?.email||'',name:profile?.full_name||staffRow?.full_name||user.email||'',uid:profile?.member_uid||staffRow?.uid||'',contact:profile?.contact_no||staffRow?.contact_no||'',department:staffRow?.department||staffRow?.data?.department||'',division:staffRow?.division||staffRow?.data?.division||'',unit:staffRow?.unit||staffRow?.data?.unit||'',role:profile?.role||'Staff Member'};
  }
  async function loadTournamentHub(tournamentId=''){
    await ensureClient();
    let tq=client.from('tournaments').select('*').order('start_date',{ascending:false});if(tournamentId)tq=tq.eq('id',String(tournamentId));
    const [{data:tournaments,error:te},{data:teams,error:tme},{data:regs,error:re},{data:updates,error:ue},{data:matches,error:me},{data:winners,error:we}]=await Promise.all([
      tq,client.from('tournament_teams').select('*').order('created_at'),client.from('tournament_registrations').select('*').order('requested_at'),client.from('tournament_updates').select('*').order('created_at',{ascending:false}),client.from('tournament_matches').select('*').order('match_date').order('match_time'),client.from('tournament_winners').select('*').order('created_at')
    ]);const err=te||tme||re||ue||me||we;if(err)throw err;
    const ids=new Set((tournaments||[]).map(x=>x.id));
    return {
      tournaments:tournaments||[],
      teams:(teams||[]).filter(x=>ids.has(x.tournament_id)),
      registrations:(regs||[]).filter(x=>ids.has(x.tournament_id)),
      updates:(updates||[]).filter(x=>ids.has(x.tournament_id)),
      matches:(matches||[]).filter(x=>ids.has(x.tournament_id)),
      winners:(winners||[]).filter(x=>ids.has(x.tournament_id))
    };
  }
  async function saveTournamentSetup(t){
    await ensureClient();
    const tournamentPayload={
      tournament_mode:t.mode,
      sport:t.sport||null,
      rules:t.rules||null,
      status:t.status,
      registration_open:t.registrationOpen||null,
      registration_close:t.registrationClose||null,
      start_date:t.startDate||null,
      end_date:t.endDate||null,
      venue:t.venue||null,
      max_participants:Number(t.maxParticipants||0)||null,
      max_teams:Number(t.maxTeams||0)||null,
      team_size:Number(t.teamSize||0)||null,
      updated_at:new Date().toISOString(),
      data:t.data||{}
    };
    const {data,error}=await client.from('tournaments')
      .update(tournamentPayload).eq('id',t.id).select().single();
    if(error)throw error;

    // The Event/Participant Portal and Tournament must share registration state.
    // Tournament dates are date-only, so keep precise Event timestamps if they
    // already exist unless the Tournament Setup explicitly supplies a date.
    const {data:eventExisting,error:eventReadError}=await client.from('events')
      .select('id,name,event_date,venue,registration_enabled,registration_mode,registration_open_at,registration_close_at,participant_rules,participant_capacity,team_size,data')
      .eq('id',data.event_id).single();
    if(eventReadError)throw eventReadError;

    const statusOpen=t.status==='Registration Open';
    const statusClosed=['Registration Closed','Scheduled','Live','Completed','Cancelled'].includes(t.status);
    const eventPayload={
      registration_enabled:statusOpen ? true : (statusClosed ? false : !!eventExisting.registration_enabled),
      registration_mode:t.mode||eventExisting.registration_mode||'None',
      participant_rules:t.rules||eventExisting.participant_rules||null,
      participant_capacity:Number(t.maxParticipants||0)||eventExisting.participant_capacity||null,
      team_size:Number(t.teamSize||0)||eventExisting.team_size||null,
      updated_at:new Date().toISOString()
    };

    if(t.registrationOpen){
      eventPayload.registration_open_at=`${t.registrationOpen}T00:00:00`;
    }else if(statusOpen){
      // Explicit "Registration Open" means open now when no future opening
      // date was supplied. This avoids stale Event timestamps blocking users.
      eventPayload.registration_open_at=null;
    }
    if(t.registrationClose){
      eventPayload.registration_close_at=`${t.registrationClose}T23:59:59`;
    }

    const {data:eventRow,error:eventUpdateError}=await client.from('events')
      .update(eventPayload).eq('id',data.event_id).select().single();
    if(eventUpdateError)throw eventUpdateError;
    return {...data,linkedEvent:eventRow};
  }
  async function selfRegisterTournament(tournamentId){
    await ensureClient();const me=await tournamentCurrentIdentity();
    const {data,error}=await client.from('tournament_registrations').insert({tournament_id:tournamentId,user_id:me.userId,staff_uid:me.uid||null,staff_name:me.name,email:me.email||null,contact_no:me.contact||null,department:me.department||null,registration_type:'Individual',status:'Approved'}).select().single();
    if(error){if(error.code==='23505')throw new Error('You are already registered for this tournament');throw error}return data;
  }
  async function createTournamentTeam(tournamentId,teamName){
    await ensureClient();
    const {data,error}=await client.rpc('create_tournament_team',{p_tournament_id:tournamentId,p_team_name:teamName});
    if(error)throw error;return data;
  }
  async function requestTournamentTeamJoin(tournamentId,teamId){
    await ensureClient();const me=await tournamentCurrentIdentity();
    const {data,error}=await client.from('tournament_registrations').insert({tournament_id:tournamentId,user_id:me.userId,staff_uid:me.uid||null,staff_name:me.name,email:me.email||null,contact_no:me.contact||null,department:me.department||null,registration_type:'Team',team_id:teamId,status:'Pending Leader Approval'}).select().single();if(error){if(error.code==='23505')throw new Error('You already have a registration for this tournament');throw error}return data;
  }
  async function decideTournamentTeamRequest(registrationId,decision){await ensureClient();const d=String(decision||'').toLowerCase().startsWith('approv')?'approve':String(decision||'').toLowerCase().startsWith('reject')?'reject':decision;const {data,error}=await client.rpc('approve_tournament_team_request',{p_registration_id:String(registrationId),p_decision:d});if(error)throw error;return data}
  async function removeTournamentTeamMember(registrationId,reason=''){await ensureClient();const {data,error}=await client.rpc('remove_tournament_team_member',{p_registration_id:String(registrationId),p_reason:reason||null});if(error)throw error;return data}
  async function loadTournamentTeamPage(teamId){
    await ensureClient();
    const [{data:team,error:te},{data:members,error:me},{data:messages,error:mse}]=await Promise.all([
      client.from('tournament_teams').select('*').eq('id',teamId).single(),client.from('tournament_registrations').select('*').eq('team_id',teamId).order('requested_at'),client.from('tournament_team_messages').select('*').eq('team_id',teamId).order('created_at')
    ]);const err=te||me||mse;if(err)throw err;return {team,members:members||[],messages:messages||[]};
  }
  async function postTournamentTeamMessage(tournamentId,teamId,message){await ensureClient();const me=await tournamentCurrentIdentity();const {data,error}=await client.from('tournament_team_messages').insert({tournament_id:tournamentId,team_id:teamId,user_id:me.userId,sender_name:me.name,message}).select().single();if(error)throw error;return data}
  async function addTournamentUpdate(row){await ensureClient();const me=await tournamentCurrentIdentity();const {data,error}=await client.from('tournament_updates').insert({tournament_id:row.tournamentId,update_type:row.type||'Update',title:row.title,message:row.message,is_pinned:!!row.pinned,created_by:me.userId,created_by_name:me.name}).select().single();if(error)throw error;return data}
  async function saveTournamentMatch(row){await ensureClient();const payload={id:row.id||`MATCH-${Date.now()}-${Math.floor(Math.random()*999)}`,tournament_id:row.tournamentId,match_no:Number(row.matchNo||0)||null,stage:row.stage||null,match_date:row.date||null,match_time:row.time||null,venue:row.venue||null,team_a:row.teamA||null,team_b:row.teamB||null,participant_a:row.participantA||null,participant_b:row.participantB||null,score_a:row.scoreA===''||row.scoreA==null?null:Number(row.scoreA),score_b:row.scoreB===''||row.scoreB==null?null:Number(row.scoreB),status:row.status||'Scheduled',remarks:row.remarks||null,updated_at:new Date().toISOString()};const {data,error}=await client.from('tournament_matches').upsert(payload,{onConflict:'id'}).select().single();if(error)throw error;return data}
  async function saveTournamentWinner(row){await ensureClient();const {data,error}=await client.from('tournament_winners').upsert({tournament_id:row.tournamentId,position:row.position,winner_name:row.winnerName,team_id:row.teamId||null,staff_uid:row.staffUid||null,remarks:row.remarks||null},{onConflict:'tournament_id,position'}).select().single();if(error)throw error;return data}
  async function getTournamentPublicStats(tournamentId){await ensureClient();const {data,error}=await client.rpc('get_tournament_public_stats',{p_tournament_id:tournamentId});if(error)throw error;return data||{registrations:0,pending:0,teams:0,completedMatches:0,departments:[]}}
  async function subscribeTournament(tournamentId,onChange){
    await ensureClient();const ch=client.channel(`unitedbml-tournament-${tournamentId}-${Date.now()}`);['tournament_updates','tournament_matches','tournament_registrations','tournament_team_messages','tournament_winners'].forEach(table=>ch.on('postgres_changes',{event:'*',schema:'public',table,filter:`tournament_id=eq.${tournamentId}`},payload=>onChange?.(table,payload)));return ch.subscribe();
  }


  async function loadParticipantPortal(){
    await ensureClient();
    const [{data:isCommittee},{data:myAudience,error:audienceError}]=await Promise.all([
      client.rpc('is_committee_user'),
      client.rpc('get_my_staff_audience')
    ]);
    if(audienceError)throw audienceError;
    const profileQuery=isCommittee
      ? client.from('profiles').select('id,email,full_name,role,member_uid,contact_no,status').eq('status','Active')
      : client.from('profiles').select('id,email,full_name,role,member_uid,contact_no,status').eq('id',(await client.auth.getUser()).data.user?.id||'00000000-0000-0000-0000-000000000000');
    const [eventsQ,teamsQ,regsQ,winnersQ,messagesQ,officialsQ,extReimbQ,casesQ,batchesQ,attendanceQ,profilesQ,linkedTournamentsQ,tournamentUpdatesQ,tournamentMatchesQ,tournamentWinnersQ,tournamentTeamsQ,tournamentRegistrationsQ,tournamentMessagesQ]=await Promise.all([
      client.from('events').select('id,name,event_type,status,event_date,event_time,venue,audience_type,expected_participants,description,registration_enabled,registration_mode,registration_open_at,registration_close_at,participant_rules,participant_capacity,team_size,participant_visibility,data').eq('archived',false).order('event_date'),
      client.from('event_teams').select('*').order('created_at'),
      client.from('event_registrations').select('*').order('requested_at'),
      client.from('event_winners').select('*').order('created_at'),
      client.from('event_team_messages').select('*').order('created_at'),
      client.from('external_event_officials').select('*').eq('status','Active').order('assigned_at'),
      client.from('external_event_reimbursements').select('*').order('created_at',{ascending:false}),
      client.from('reimbursement_cases').select('id,case_ref,reference_no,expense_request_id,expense_request_number,event_id,event_name,expense_item,approved_item_amount,route,status,reason,expected_expense_date,notes,requested_by,created_at,data').order('created_at',{ascending:false}),
      client.from('ap_batches').select('id,reimbursement_id,submission_ref,submission_date,status,created_at').order('created_at',{ascending:false}),
      client.from('event_attendance').select('event_id,staff_uid,staff_name,attendance_status,attended,marked_at'),
      profileQuery,
      client.from('tournaments').select('id,event_id,name,tournament_mode,sport,rules,status,registration_open,registration_close,start_date,end_date,venue,max_participants,max_teams,team_size,data').order('start_date'),
      client.from('tournament_updates').select('*').order('created_at',{ascending:false}),
      client.from('tournament_matches').select('*').order('match_date').order('match_time'),
      client.from('tournament_winners').select('*').order('created_at'),
      client.from('tournament_teams').select('*').order('created_at'),
      client.from('tournament_registrations').select('*').order('requested_at'),
      client.from('tournament_team_messages').select('*').order('created_at')
    ]);
    const arr=[eventsQ,teamsQ,regsQ,winnersQ,messagesQ,officialsQ,extReimbQ,casesQ,batchesQ,attendanceQ,profilesQ,linkedTournamentsQ,tournamentUpdatesQ,tournamentMatchesQ,tournamentWinnersQ,tournamentTeamsQ,tournamentRegistrationsQ,tournamentMessagesQ];
    for(const q of arr)if(q.error)throw q.error;
    return {
      events:eventsQ.data||[],teams:teamsQ.data||[],registrations:regsQ.data||[],winners:winnersQ.data||[],
      messages:messagesQ.data||[],officials:officialsQ.data||[],externalReimbursements:extReimbQ.data||[],
      reimbursementCases:casesQ.data||[],apBatches:batchesQ.data||[],attendance:attendanceQ.data||[],profiles:profilesQ.data||[],
      linkedTournaments:linkedTournamentsQ.data||[],tournamentUpdates:tournamentUpdatesQ.data||[],
      tournamentMatches:tournamentMatchesQ.data||[],tournamentWinners:tournamentWinnersQ.data||[],
      tournamentTeams:tournamentTeamsQ.data||[],tournamentRegistrations:tournamentRegistrationsQ.data||[],
      tournamentMessages:tournamentMessagesQ.data||[],myAudience:myAudience||{department:'',audienceCategory:'UNCLASSIFIED'}
    };
  }
  async function configureParticipantEvent(eventId,settings){
    await ensureClient();
    const enabled=!!settings.enabled;
    const mode=settings.mode||'None';
    const payload={
      registration_enabled:enabled,
      registration_mode:mode,
      registration_open_at:settings.openAt||null,
      registration_close_at:settings.closeAt||null,
      participant_rules:settings.rules||null,
      participant_capacity:Number(settings.capacity||0)||null,
      team_size:Number(settings.teamSize||0)||null,
      participant_visibility:settings.visibility||'All Staff',
      updated_at:new Date().toISOString()
    };
    const {data,error}=await client.from('events').update(payload).eq('id',eventId).select().single();
    if(error)throw error;

    // If this Event has a linked Tournament, keep its registration state in sync.
    const {data:tournaments,error:tournamentReadError}=await client.from('tournaments')
      .select('id,status').eq('event_id',String(eventId));
    if(tournamentReadError)throw tournamentReadError;

    if((tournaments||[]).length){
      const now=Date.now();
      const openTime=settings.openAt?new Date(settings.openAt).getTime():null;
      const closeTime=settings.closeAt?new Date(settings.closeAt).getTime():null;
      let status='Registration Open';
      if(!enabled)status='Registration Closed';
      else if(openTime&&now<openTime)status='Setup';
      else if(closeTime&&now>closeTime)status='Registration Closed';

      const tournamentPayload={
        tournament_mode:mode,
        rules:settings.rules||null,
        status,
        registration_open:settings.openAt?String(settings.openAt).slice(0,10):null,
        registration_close:settings.closeAt?String(settings.closeAt).slice(0,10):null,
        max_participants:Number(settings.capacity||0)||null,
        team_size:Number(settings.teamSize||0)||null,
        updated_at:new Date().toISOString()
      };
      const {error:tournamentUpdateError}=await client.from('tournaments')
        .update(tournamentPayload).eq('event_id',String(eventId));
      if(tournamentUpdateError)throw tournamentUpdateError;
    }
    return data;
  }
  async function selfRegisterEvent(eventId){
    await ensureClient();const {data,error}=await client.rpc('self_register_event',{p_event_id:String(eventId),p_registration_type:'Individual'});if(error)throw error;return data;
  }
  async function createEventTeam(eventId,teamName){
    await ensureClient();const {data,error}=await client.rpc('create_event_team',{p_event_id:String(eventId),p_team_name:teamName});if(error)throw error;return data;
  }
  async function requestJoinEventTeam(teamId){
    await ensureClient();const {data,error}=await client.rpc('request_join_event_team',{p_team_id:teamId});if(error)throw error;return data;
  }
  async function decideEventTeamJoin(registrationId,approve,comment=''){
    await ensureClient();const {data,error}=await client.rpc('approve_event_team_join',{p_registration_id:registrationId,p_approve:!!approve,p_comment:comment||null});if(error)throw error;return data;
  }
  async function postEventTeamMessage(eventId,teamId,message,senderName){
    await ensureClient();const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('Sign in required');
    const {data,error}=await client.from('event_team_messages').insert({event_id:String(eventId),team_id:teamId,user_id:user.id,sender_name:senderName||user.email,message}).select().single();
    if(error)throw error;return data;
  }
  async function saveEventWinner(row){
    await ensureClient();
    const payload={event_id:String(row.eventId),position:row.position,winner_name:row.winnerName,team_id:row.teamId||null,staff_uid:row.staffUid||null,remarks:row.remarks||null};
    const {data,error}=await client.from('event_winners').insert(payload).select().single();if(error)throw error;return data;
  }
  async function assignExternalEventOfficial(eventId,userId,officialRole='Team Manager',notes=''){
    await ensureClient();
    const {data,error}=await client.from('external_event_officials').upsert({event_id:String(eventId),user_id:userId,official_role:officialRole,notes:notes||null,status:'Active',assigned_by:(await client.auth.getUser()).data.user?.id||null},{onConflict:'event_id,user_id'}).select().single();
    if(error)throw error;return data;
  }
  async function submitExternalEventReimbursement(row){
    await ensureClient();
    const {data,error}=await client.rpc('submit_external_event_reimbursement',{
      p_event_id:String(row.eventId),p_title:row.title,p_description:row.description||null,
      p_expense_date:row.expenseDate,p_vendor_name:row.vendorName||null,p_reference_no:row.referenceNo||null,
      p_amount:Number(row.amount||0),p_supporting_document_name:row.supportingDocumentName||null
    });
    if(error)throw error;return data;
  }
  async function decideExternalEventReimbursement(id,approve,comment=''){
    await ensureClient();const {data,error}=await client.rpc('decide_external_event_reimbursement',{p_id:id,p_approve:!!approve,p_comment:comment||null});if(error)throw error;return data;
  }
  async function subscribeParticipantPortal(onChange){
    await ensureClient();
    const ch=client.channel(`unitedbml-participant-${Date.now()}`);
    ['events','event_teams','event_registrations','event_winners','event_team_messages','external_event_officials','external_event_reimbursements','reimbursement_cases','ap_batches','tournaments','tournament_teams','tournament_registrations','tournament_team_messages','tournament_updates','tournament_matches','tournament_winners'].forEach(table=>{
      ch.on('postgres_changes',{event:'*',schema:'public',table},payload=>onChange?.(table,payload));
    });
    return ch.subscribe();
  }


  async function loadStaffAudienceAdmin(){
    await ensureClient();
    const [{data:map,error:me},{data:staff,error:se}]=await Promise.all([
      client.from('staff_location_classification').select('*').order('match_type').order('match_value'),
      client.from('staff').select('uid,full_name,job_title,division,department,unit,email,contact_no,status,updated_at').order('full_name')
    ]);
    if(me)throw me;if(se)throw se;
    const active=(staff||[]).filter(s=>String(s.status||'Active').toLowerCase()!=='inactive');
    return {mappings:map||[],staff:staff||[],
      departments:[...new Set(active.map(s=>String(s.department||'').trim()).filter(Boolean))].sort(),
      units:[...new Set(active.map(s=>String(s.unit||'').trim()).filter(Boolean))].sort()};
  }
  async function saveStaffLocationClassification(row){
    await ensureClient();
    const {data:{user}}=await client.auth.getUser();
    const payload={
      match_type:row.matchType,
      match_value:String(row.matchValue||'').trim(),
      audience_category:row.audienceCategory,
      notes:row.notes||null,
      active:row.active!==false,
      updated_by:user?.id||null,
      updated_at:new Date().toISOString()
    };
    if(!payload.match_type||!payload.match_value)throw new Error('Unit / Department is required');

    if(row.id){
      const {data,error}=await client.from('staff_location_classification')
        .update(payload).eq('id',row.id).select().single();
      if(error)throw error;
      return data;
    }

    const {data:existing,error:lookupError}=await client.from('staff_location_classification')
      .select('id').eq('match_type',payload.match_type).ilike('match_value',payload.match_value).limit(1);
    if(lookupError)throw lookupError;

    if(existing?.length){
      const {data,error}=await client.from('staff_location_classification')
        .update(payload).eq('id',existing[0].id).select().single();
      if(error)throw error;
      return data;
    }

    const {data,error}=await client.from('staff_location_classification')
      .insert(payload).select().single();
    if(error)throw error;
    return data;
  }
  async function deleteStaffLocationClassification(id){await ensureClient();const {error}=await client.from('staff_location_classification').delete().eq('id',id);if(error)throw error;return true}
  async function loadStaffMaster(){await ensureClient();const {data,error}=await client.from('staff').select('uid,full_name,job_title,division,department,unit,email,contact_no,status,updated_at').order('full_name');if(error)throw error;return data||[]}
  async function upsertStaffMasterRows(rows){await ensureClient();const payload=(rows||[]).map(r=>({uid:String(r.uid||'').trim(),name:String(r.name||'').trim(),job_title:String(r.jobTitle||r.job_title||'').trim(),division:String(r.division||'').trim(),department:String(r.department||'').trim(),unit:String(r.unit||'').trim(),status:String(r.status||'Active')})).filter(r=>r.uid);const {data,error}=await client.rpc('upsert_staff_master_rows',{p_rows:payload});if(error)throw error;return data}
  async function checkEventEligibility(eventId){
    await ensureClient();const {data,error}=await client.rpc('is_staff_eligible_for_event',{p_event_id:String(eventId)});if(error)throw error;return !!data;
  }

  async function uploadReimbursementEvidence(reimbursementId,file){
    await ensureClient();
    if(!file)throw new Error('Select a Procurement response attachment');
    const clean=String(file.name||'procurement-response').replace(/[^A-Za-z0-9._-]+/g,'_');
    const path=`procurement/${String(reimbursementId)}/${Date.now()}-${clean}`;
    const {error}=await client.storage.from('reimbursement-evidence').upload(path,file,{
      cacheControl:'3600',
      upsert:false,
      contentType:file.type||'application/octet-stream'
    });
    if(error)throw error;
    return {path,name:file.name,type:file.type||'application/octet-stream',size:file.size||0};
  }
  async function getReimbursementEvidenceUrl(path){
    await ensureClient();
    const {data,error}=await client.storage.from('reimbursement-evidence').createSignedUrl(path,900);
    if(error)throw error;
    return data?.signedUrl||'';
  }
  async function uploadApBillEvidence(reimbursementId,batchId,billKey,file){
    await ensureClient();
    if(!file)throw new Error('Select a bill attachment');
    const clean=String(file.name||'bill').replace(/[^A-Za-z0-9._-]+/g,'_');
    const path=`ap-bills/${String(reimbursementId)}/${String(batchId)}/${String(billKey)}/${Date.now()}-${clean}`;
    const {error}=await client.storage.from('reimbursement-evidence').upload(path,file,{
      cacheControl:'3600',
      upsert:false,
      contentType:file.type||'application/octet-stream'
    });
    if(error)throw error;
    return {path,name:file.name,type:file.type||'application/octet-stream',size:file.size||0};
  }
  async function downloadReimbursementEvidence(path){
    await ensureClient();
    if(!path)throw new Error('Attachment path is missing');
    const {data,error}=await client.storage.from('reimbursement-evidence').download(path);
    if(error)throw error;
    return data;
  }


  async function loadDocumentRegistry(){
    await ensureClient();
    const {data,error}=await client.from('document_registry')
      .select('*').order('created_at',{ascending:false});
    if(error)throw error;
    return data||[];
  }
  async function uploadDocumentRegistryFile(meta,file){
    await ensureClient();
    if(!file)throw new Error('Select a document');
    if(Number(file.size||0)>26214400)throw new Error('Document must be 25 MB or smaller');
    const {data:{user}}=await client.auth.getUser();
    const clean=String(file.name||'document').replace(/[^A-Za-z0-9._-]+/g,'_');
    const eventPart=String(meta.eventId||'general').replace(/[^A-Za-z0-9_-]+/g,'_');
    const path=`${eventPart}/${Date.now()}-${clean}`;
    const {error:uploadError}=await client.storage.from('unitedbml-documents')
      .upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||'application/octet-stream'});
    if(uploadError)throw uploadError;
    const payload={
      title:String(meta.title||file.name||'Document').trim(),
      category:meta.category||'GENERAL',
      event_id:meta.eventId||null,
      event_name:meta.eventName||null,
      source_module:'DOCUMENTS',
      source_record_id:meta.sourceRecordId||null,
      file_name:file.name,
      file_type:file.type||'application/octet-stream',
      file_size:Number(file.size||0),
      storage_bucket:'unitedbml-documents',
      storage_path:path,
      visibility:'COMMITTEE',
      notes:meta.notes||null,
      uploaded_by:user?.id||null,
      uploaded_by_name:meta.uploadedByName||null
    };
    const {data,error}=await client.from('document_registry').insert(payload).select().single();
    if(error){
      await client.storage.from('unitedbml-documents').remove([path]);
      throw error;
    }
    return data;
  }
  async function getDocumentSignedUrl(bucket,path){
    await ensureClient();
    const {data,error}=await client.storage.from(bucket).createSignedUrl(path,900);
    if(error)throw error;
    return data?.signedUrl||'';
  }
  async function deleteDocumentRegistryFile(id){
    await ensureClient();
    const {data,error}=await client.from('document_registry').select('*').eq('id',id).single();
    if(error)throw error;
    if(data?.storage_path){
      const {error:storageError}=await client.storage.from(data.storage_bucket||'unitedbml-documents').remove([data.storage_path]);
      if(storageError)throw storageError;
    }
    const {error:deleteError}=await client.from('document_registry').delete().eq('id',id);
    if(deleteError)throw deleteError;
    return true;
  }

  async function loadContingencyRequests(){
    await ensureClient();
    const {data,error}=await client.from('contingency_requests').select('*').order('created_at',{ascending:false});
    if(error)throw error;
    return data||[];
  }
  async function createContingencyRequest(payload){
    await ensureClient();
    const {data:{user}}=await client.auth.getUser();
    const row={...payload,requested_by:user?.id||null,updated_at:new Date().toISOString()};
    const {data,error}=await client.from('contingency_requests').insert(row).select().single();
    if(error)throw error;
    return data;
  }
  async function updateContingencyRequest(id,patch){
    await ensureClient();
    const {data,error}=await client.from('contingency_requests').update({...patch,updated_at:new Date().toISOString()}).eq('id',id).select().single();
    if(error)throw error;
    return data;
  }
  async function uploadContingencyEvidence(requestId,file){
    await ensureClient();
    if(!file)throw new Error('Select the Procurement response attachment');
    if(Number(file.size||0)>15728640)throw new Error('Procurement response attachment must be 15 MB or smaller');
    const clean=String(file.name||'procurement-response').replace(/[^A-Za-z0-9._-]+/g,'_');
    const path=`contingency/${String(requestId)}/${Date.now()}-${clean}`;
    const {error}=await client.storage.from('reimbursement-evidence').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||'application/octet-stream'});
    if(error)throw error;
    return {path,name:file.name,type:file.type||'application/octet-stream',size:file.size||0};
  }
  async function sendEmail(payload){return invokeEmail(payload)}
  async function emailHealth(){return invokeEmail({action:'health'})}
  window.clubBackend={signIn,signOut,getMyAccount,updateMyProfile,getMyCommitteeLeave,updateMyCommitteeLeave,clearMyCommitteeLeave,changeMyPassword,signOutOtherSessions,tournamentCurrentIdentity,loadTournamentHub,saveTournamentSetup,selfRegisterTournament,createTournamentTeam,requestTournamentTeamJoin,decideTournamentTeamRequest,removeTournamentTeamMember,loadTournamentTeamPage,postTournamentTeamMessage,addTournamentUpdate,saveTournamentMatch,saveTournamentWinner,getTournamentPublicStats,subscribeTournament,loadParticipantPortal,configureParticipantEvent,selfRegisterEvent,createEventTeam,requestJoinEventTeam,decideEventTeamJoin,postEventTeamMessage,saveEventWinner,assignExternalEventOfficial,submitExternalEventReimbursement,decideExternalEventReimbursement,subscribeParticipantPortal,loadStaffAudienceAdmin,saveStaffLocationClassification,deleteStaffLocationClassification,loadStaffMaster,upsertStaffMasterRows,checkEventEligibility,uploadReimbursementEvidence,getReimbursementEvidenceUrl,uploadApBillEvidence,downloadReimbursementEvidence,loadDocumentRegistry,uploadDocumentRegistryFile,getDocumentSignedUrl,deleteDocumentRegistryFile,loadContingencyRequests,createContingencyRequest,updateContingencyRequest,uploadContingencyEvidence,sendEmail,emailHealth,expenseApproval,getCommitteeUserDirectory,verifyPresidentApprovalToken,verifyExpenseApprovalToken,refreshFinanceRequest,flush,get client(){return client},get ready(){return ready}};
  window.clubSignOut=signOut;
  document.addEventListener('DOMContentLoaded',()=>{
    const f=document.getElementById('clubLoginForm');f?.addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=document.getElementById('clubLoginButton'),er=document.getElementById('clubLoginError');
      if(er){er.style.display='none';er.textContent=''}
      if(btn){btn.disabled=true;btn.textContent='Signing in…'}
      showLoadingState('Authenticating your account');
      try{
        await signIn(document.getElementById('clubLoginEmail').value.trim(),document.getElementById('clubLoginPassword').value);
      }catch(x){
        showLoginForm();
        showError(x.message||'Sign in failed');
        if(btn){btn.disabled=false;btn.textContent='Sign in'}
      }
    });bootstrap();
  });
})();
