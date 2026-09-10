import { outlookEmailTemplate, sendEmail, type EmailAttachment } from '../../lib/email';
import { generateApprovedExpenseNotePdf } from '../../lib/expenseNotePdf';
import { supabase } from '../../lib/supabase';

interface ExpenseRequestEmailContext {
  id: string;
  request_number: string | null;
  title: string | null;
  event_name: string | null;
  requested_by: string | null;
  requester_role: string | null;
  total_amount: number | null;
}

async function requesterEmail(requestedByUser: string | null): Promise<string | null> {
  if (!requestedByUser) return null;
  const { data } = await supabase.from('profiles').select('email').eq('id', requestedByUser).maybeSingle();
  return data?.email ?? null;
}

/** Notifies whichever approver a request is now waiting on — the President (recommendation
 * stage) or the selected Final Approver (either directly, when the President is on leave, or
 * after the President recommends it) — that it needs their decision. */
export async function notifyExpenseApprover(
  request: ExpenseRequestEmailContext,
  approverEmail: string,
  approverName: string,
  stage: 'President Recommendation' | 'Final Approval'
) {
  if (!approverEmail) return;
  const subject = `Expense Approval Needed — ${request.title || request.request_number} (${stage})`;
  const html = outlookEmailTemplate({
    heading: stage === 'President Recommendation' ? 'President Recommendation Required' : 'Final Approval Required',
    intro: `Dear ${approverName || 'Sir/Madam'}, an expense request is waiting on your decision.`,
    rows: [
      { label: 'Request', value: `${request.request_number ?? ''} — ${request.title ?? ''}` },
      { label: 'Event / Activity', value: request.event_name || 'General Club Expense' },
      { label: 'Requested By', value: `${request.requested_by ?? ''} (${request.requester_role ?? ''})` },
    ],
    totalLabel: 'Total Amount',
    totalValue: `MVR ${Number(request.total_amount ?? 0).toLocaleString()}`,
    signatureName: request.requested_by || 'UnitedBML Finance',
    signatureRole: request.requester_role || '',
    signatureEmail: '',
  });
  await sendEmail({
    to: approverEmail,
    subject,
    html,
    emailType: 'Expense Approval Request',
    relatedType: 'expense_request',
    relatedId: request.id,
  });
}

/** Notifies the requester once a request has been approved (with the Approval Note PDF attached)
 * or rejected, at either the President or Final Approval stage. */
export async function notifyExpenseDecision(
  request: ExpenseRequestEmailContext & { requested_by_user: string | null },
  decision: 'Approved' | 'Rejected',
  comment: string,
  decidedByName: string,
  decidedByRole: string
) {
  const to = await requesterEmail(request.requested_by_user);
  if (!to) return;

  const subject = `Expense Request ${decision} — ${request.title || request.request_number}`;
  const html = outlookEmailTemplate({
    heading: `Your Expense Request Was ${decision}`,
    intro: `Dear ${request.requested_by || 'Sir/Madam'}, your expense request has been ${decision.toLowerCase()}${comment ? ' with the following comment' : ''}.`,
    rows: [
      { label: 'Request', value: `${request.request_number ?? ''} — ${request.title ?? ''}` },
      { label: 'Event / Activity', value: request.event_name || 'General Club Expense' },
      ...(comment ? [{ label: 'Comment', value: comment }] : []),
    ],
    totalLabel: 'Total Amount',
    totalValue: `MVR ${Number(request.total_amount ?? 0).toLocaleString()}`,
    signatureName: decidedByName,
    signatureRole: decidedByRole,
    signatureEmail: '',
  });

  const attachments: EmailAttachment[] = [];
  if (decision === 'Approved') {
    try {
      attachments.push(await generateApprovedExpenseNotePdf(request.id));
    } catch {
      // Approval note generation is best-effort — still send the decision notice without it.
    }
  }

  await sendEmail({
    to,
    subject,
    html,
    attachments,
    emailType: 'Expense Decision Notice',
    relatedType: 'expense_request',
    relatedId: request.id,
  });
}
