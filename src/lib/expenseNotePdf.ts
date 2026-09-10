import { supabase } from './supabase';
import type { EmailAttachment } from './email';

/** Opens a generated (not stored) PDF/file attachment in a new tab via a short-lived blob URL. */
export function openGeneratedAttachment(attachment: EmailAttachment) {
  const binary = atob(attachment.content);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: attachment.contentType });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Builds the "Approved Expense Approval Note" PDF for one approved Expense Request —
 * attached to the Procurement pre-approval email and every AP submission for its lines. */
export async function generateApprovedExpenseNotePdf(expenseRequestId: string): Promise<EmailAttachment> {
  const [{ data: request, error: reqError }, { data: lines }] = await Promise.all([
    supabase.from('expense_requests').select('*').eq('id', expenseRequestId).single(),
    supabase.from('expense_lines').select('*').eq('expense_request_id', expenseRequestId).order('line_no'),
  ]);
  if (reqError || !request) throw new Error('The approved expense request could not be found for the approval note.');

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const left = 48;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('UnitedBML — Approved Expense Approval Note', left, y);
  y += 26;

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1);
  doc.line(left, y, 548, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const field = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, left, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value || '—'), left + 140, y);
    y += 18;
  };

  field('Request Number', request.request_number ?? request.id);
  field('Title', request.title ?? '');
  field('Event / Activity', request.event_name ?? 'General (no linked event)');
  field('Requested By', `${request.requested_by ?? ''}${request.requester_role ? ` (${request.requester_role})` : ''}`);
  field('President Recommendation', request.president_recommendation ?? '—');
  field('Approved By', `${request.approved_by_name ?? ''}${request.approved_by_role ? ` (${request.approved_by_role})` : ''}`);
  field('Approved At', request.approved_at ? new Date(request.approved_at).toLocaleString() : '—');
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Expense Items', left, y);
  y += 16;

  doc.setFontSize(10);
  const colX = [left, left + 260, left + 330, left + 400];
  doc.text('Description', colX[0], y);
  doc.text('Qty', colX[1], y);
  doc.text('Rate', colX[2], y);
  doc.text('Amount', colX[3], y);
  y += 6;
  doc.setLineWidth(0.5);
  doc.line(left, y, 548, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  for (const line of lines ?? []) {
    if (y > 760) {
      doc.addPage();
      y = 56;
    }
    doc.text(String(line.description ?? ''), colX[0], y, { maxWidth: 250 });
    doc.text(String(line.quantity ?? ''), colX[1], y);
    doc.text(Number(line.rate ?? 0).toLocaleString(), colX[2], y);
    doc.text(Number(line.line_total ?? 0).toLocaleString(), colX[3], y);
    y += 16;
  }

  y += 4;
  doc.setLineWidth(0.5);
  doc.line(left, y, 548, y);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.text(`Subtotal: MVR ${Number(request.subtotal ?? 0).toLocaleString()}`, left + 300, y);
  y += 16;
  doc.text(`Contingency (${request.contingency_percent ?? 5}%): MVR ${Number(request.contingency_amount ?? 0).toLocaleString()}`, left + 300, y);
  y += 16;
  doc.setFontSize(12);
  doc.text(`Total Approved: MVR ${Number(request.total_amount ?? 0).toLocaleString()}`, left + 300, y);

  const base64 = doc.output('datauristring').split(',')[1];
  return {
    filename: `Approved-Expense-Note-${request.request_number ?? request.id}.pdf`,
    contentType: 'application/pdf',
    content: base64,
  };
}
