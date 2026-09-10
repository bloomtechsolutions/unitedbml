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

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Builds the "Expense Approval Note" PDF for one approved Expense Request — the same
 * invoice-style layout as the legacy build — attached to the Procurement pre-approval email
 * and every AP submission for its lines, and offered on demand from Documents/Finance. */
export async function generateApprovedExpenseNotePdf(expenseRequestId: string): Promise<EmailAttachment> {
  const [{ data: request, error: reqError }, { data: lines }] = await Promise.all([
    supabase.from('expense_requests').select('*').eq('id', expenseRequestId).single(),
    supabase.from('expense_lines').select('*').eq('expense_request_id', expenseRequestId).order('line_no'),
  ]);
  if (reqError || !request) throw new Error('The approved expense request could not be found for the approval note.');

  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 48;
  const right = pageWidth - 48;
  let y = 0;

  // Header banner
  doc.setFillColor(190, 24, 38);
  doc.rect(0, 0, pageWidth, 78, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('EXPENSE APPROVAL NOTE', pageWidth / 2, 40, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('UnitedBML Finance', pageWidth / 2, 60, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y = 108;

  const ref = `UNITEDBML/APN/${new Date(request.approved_at || request.submitted_at || Date.now()).getFullYear().toString().slice(-2)}/${request.request_number?.replace(/\D/g, '').slice(-3) || '1'}`;
  const finalApprover = `${request.final_approver_name || 'Final Approver'}, ${request.final_approver_role || ''}, UnitedBML`;
  const preparedBy = `${request.approved_by_name || request.final_approver_name || 'Committee'}, ${request.approved_by_role || request.final_approver_role || ''}, UnitedBML`;

  doc.setFontSize(10.5);
  const metaField = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, left, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, left + 70, y);
    y += 16;
  };
  metaField('Ref:', ref);
  metaField('Date:', fmtDate(request.approved_at || request.submitted_at));
  metaField('To:', finalApprover);
  metaField('From:', preparedBy);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Subject: Expense Approval - "${request.title || request.request_number}"`, left, y);
  doc.setLineWidth(0.6);
  doc.line(left, y + 3, right, y + 3);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const introText = `Approval is sought for expenses related to ${request.event_name || 'general club activity'}. ${request.purpose || ''}`.trim();
  const introLines = doc.splitTextToSize(introText, right - left);
  doc.text(introLines, left, y);
  y += introLines.length * 14 + 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Estimated costs', left, y);
  y += 8;

  const itemRows = (lines ?? []).map((l) => [
    l.description || '',
    String(l.quantity ?? ''),
    Number(l.rate ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
    Number(l.line_total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
  ]);
  itemRows.push(['Contingency (5%)', '', '', Number(request.contingency_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })]);
  itemRows.push(['TOTAL', '', '', Number(request.total_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })]);

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Rate', 'Total MVR']],
    body: itemRows,
    margin: { left, right: pageWidth - right },
    styles: { fontSize: 9.5, cellPadding: 5 },
    headStyles: { fillColor: [230, 230, 230], textColor: [30, 30, 30], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.row.index === itemRows.length - 1) data.cell.styles.fontStyle = 'bold';
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  const reimbursementLines = (lines ?? []).filter((l) => l.reimbursement_required);
  if (reimbursementLines.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('Reimbursement Note:', left, y);
    doc.setFont('helvetica', 'normal');
    const note = `The following approved expense item(s) are placed for reimbursement upon submission of paid bill(s): ${reimbursementLines
      .map((l) => l.description)
      .join(', ')}.`;
    const noteLines = doc.splitTextToSize(note, right - left - 120);
    doc.text(noteLines, left + 120, y);
    y += noteLines.length * 14 + 14;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Budget Details', left, y);
  y += 8;

  const availableBefore = request.budget_available_before_approval ?? 0;
  const availableAfter = request.budget_available_after_approval ?? availableBefore - Number(request.total_amount ?? 0);

  autoTable(doc, {
    startY: y,
    body: [
      ['Budget Category: United BML', 'MVR'],
      [`Available amount as at ${fmtDate(request.approved_at || request.submitted_at)}`, availableBefore.toLocaleString(undefined, { minimumFractionDigits: 2 })],
      ['Amount approved for this request', Number(request.total_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })],
      ['Available amount after deduction', availableAfter.toLocaleString(undefined, { minimumFractionDigits: 2 })],
    ],
    margin: { left, right: pageWidth - right },
    styles: { fontSize: 9.5, cellPadding: 5 },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.row.index === 0) data.cell.styles.fontStyle = 'bold';
      if (data.row.index === 3) data.cell.styles.fontStyle = 'bold';
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text('Placed for approval to proceed with above.', left, y);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Digital Approval Timeline', left, y);
  y += 10;

  const boxWidth = (right - left - 16) / 3;
  const boxHeight = 74;
  const boxes = [
    {
      label: 'PREPARED BY',
      name: request.requested_by || '—',
      role: request.requester_role || '',
      at: fmtDateTime(request.submitted_at),
    },
    {
      label: 'RECOMMENDED BY',
      name: request.recommended_by_name || 'President',
      role: request.recommended_by_role || 'President',
      at: request.president_recommendation ? fmtDateTime(request.updated_at) : '—',
    },
    {
      label: 'APPROVED BY',
      name: request.approved_by_name || '—',
      role: request.approved_by_role || '',
      at: fmtDateTime(request.approved_at),
    },
  ];

  boxes.forEach((box, i) => {
    const x = left + i * (boxWidth + 8);
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, boxWidth, boxHeight, 3, 3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(box.label, x + 8, y + 16);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10.5);
    doc.text(box.name, x + 8, y + 32);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(box.role, x + 8, y + 46);
    doc.setDrawColor(220, 220, 220);
    doc.line(x + 8, y + 54, x + boxWidth - 8, y + 54);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(box.at, x + 8, y + 66);
    doc.setTextColor(0, 0, 0);
  });

  const base64 = doc.output('datauristring').split(',')[1];
  return {
    filename: `Approved-Expense-Note-${request.request_number ?? request.id}.pdf`,
    contentType: 'application/pdf',
    content: base64,
  };
}
