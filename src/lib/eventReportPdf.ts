import type { EmailAttachment } from './email';
import type { EventReportRow } from '../types/database';
import type { EventReportEventSnapshot } from '../features/events/useEventReports';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtMoney(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

const MAX_PHOTOS = 12;

/** Builds the final "Event Completion Report" PDF — event & budget snapshot, attendance,
 * feedback/recommendations and a photo gallery — for a President-signed-off event_reports row.
 * Follows the same jsPDF pipeline as expenseNotePdf.ts. Photos are pre-resolved to data URLs by
 * the caller (via reportPhotoAsDataUrl) and capped here at MAX_PHOTOS for file-size sanity. */
export async function generateEventReportPdf(
  report: EventReportRow,
  event: EventReportEventSnapshot,
  photos: { dataUrl: string; caption: string | null }[]
): Promise<EmailAttachment> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 48;
  const right = pageWidth - 48;
  let y = 0;

  const drawHeader = () => {
    doc.setFillColor(190, 24, 38);
    doc.rect(0, 0, pageWidth, 78, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('EVENT COMPLETION REPORT', pageWidth / 2, 40, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('UnitedBML', pageWidth / 2, 60, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  };

  drawHeader();
  y = 108;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(event.name, left, y);
  y += 22;

  doc.setFontSize(10.5);
  const metaField = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, left, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, left + 90, y);
    y += 16;
  };
  metaField('Event Type:', event.event_type || '—');
  metaField('Date:', fmtDate(event.event_date));
  metaField('Venue:', event.venue || '—');
  metaField('Coordinator:', `${event.coordinator || '—'}${event.coordinator_role ? `, ${event.coordinator_role}` : ''}`);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Budget Summary', left, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    body: [
      ['Planned Budget (MVR)', fmtMoney(event.planned_budget)],
      ['Actual Expense (MVR)', fmtMoney(event.actual_expense_total)],
      ['Finance Settlement', event.finance_settlement_status || '—'],
    ],
    margin: { left, right: pageWidth - right },
    styles: { fontSize: 9.5, cellPadding: 5 },
    columnStyles: { 1: { halign: 'right' } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Attendance', left, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [['Expected', 'Attended', 'Staff Attended', 'Volunteers', 'No-Shows']],
    body: [[
      String(event.expected_participants ?? 0),
      String(event.attendance_count ?? 0),
      String(report.staff_attended ?? 0),
      String(report.volunteers_count ?? 0),
      String(report.no_show_count ?? 0),
    ]],
    margin: { left, right: pageWidth - right },
    styles: { fontSize: 9.5, cellPadding: 5, halign: 'center' },
    headStyles: { fillColor: [230, 230, 230], textColor: [30, 30, 30], fontStyle: 'bold' },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  const textSection = (title: string, body: string | null) => {
    if (!body || !body.trim()) return;
    if (y > pageHeight - 100) {
      doc.addPage();
      y = 48;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, left, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(body, right - left);
    doc.text(lines, left, y);
    y += lines.length * 13 + 16;
  };

  if (report.feedback_rating) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Overall Feedback Rating: ${report.feedback_rating} / 5`, left, y);
    y += 20;
  }

  textSection('Highlights', report.highlights);
  textSection('Feedback', report.feedback_text);
  textSection('Challenges Faced', report.challenges);
  textSection('Recommendations', report.recommendations);

  if (report.status === 'Approved' || report.status === 'Returned') {
    if (y > pageHeight - 120) {
      doc.addPage();
      y = 48;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Sign-off', left, y);
    y += 16;
    autoTable(doc, {
      startY: y,
      body: [
        ['Submitted By', `${report.submitted_by_name || '—'} on ${fmtDate(report.submitted_at)}`],
        ['President Decision', report.president_decision || '—'],
        ['Decided By', `${report.decided_by_name || '—'}${report.decided_by_role ? `, ${report.decided_by_role}` : ''} on ${fmtDate(report.decided_at)}`],
        ...(report.president_comment ? [['Comment', report.president_comment]] : []),
      ],
      margin: { left, right: pageWidth - right },
      styles: { fontSize: 9.5, cellPadding: 5 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  const gallery = photos.slice(0, MAX_PHOTOS);
  if (gallery.length) {
    doc.addPage();
    y = 48;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Photo Gallery', left, y);
    y += 20;

    const cols = 2;
    const gap = 14;
    const cellWidth = (right - left - gap) / cols;
    const cellHeight = 160;
    const captionHeight = 16;

    gallery.forEach((photo, i) => {
      const col = i % cols;
      if (col === 0 && i > 0) y += cellHeight + captionHeight + gap;
      if (y + cellHeight + captionHeight > pageHeight - 40) {
        doc.addPage();
        y = 48;
      }
      const x = left + col * (cellWidth + gap);
      try {
        doc.addImage(photo.dataUrl, 'JPEG', x, y, cellWidth, cellHeight, undefined, 'FAST');
      } catch {
        doc.setDrawColor(210, 210, 210);
        doc.rect(x, y, cellWidth, cellHeight);
      }
      if (photo.caption) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 100, 100);
        doc.text(doc.splitTextToSize(photo.caption, cellWidth), x, y + cellHeight + 12);
        doc.setTextColor(0, 0, 0);
      }
    });
  }

  const base64 = doc.output('datauristring').split(',')[1];
  return {
    filename: `Event-Report-${event.id}.pdf`,
    contentType: 'application/pdf',
    content: base64,
  };
}
