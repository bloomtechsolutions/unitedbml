import type { MeetingWithChildren } from './types';
import { meetingStatus } from './status';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Mirrors meetingMinutesHtml() in the legacy index.html: a fully computed document, nothing hand-authored. */
export function buildMinutesHtml(meeting: MeetingWithChildren): string {
  const attendanceRows = meeting.attendees
    .map((a) => `<tr><td>${escapeHtml(a.attendee_name)}</td><td>${escapeHtml(a.attendee_role || '')}</td><td>${escapeHtml(a.attendance_status || '')}</td></tr>`)
    .join('');

  const agendaRows = meeting.agenda
    .map(
      (a) =>
        `<li><b>${escapeHtml(a.title)}</b>${a.owner ? ` — ${escapeHtml(a.owner)}` : ''}${
          a.outcome ? `<br/><i>Outcome: ${escapeHtml(a.outcome)}</i>` : ''
        }${a.discussion ? `<br/>${escapeHtml(a.discussion)}` : ''}</li>`
    )
    .join('');

  const decisionRows = meeting.decisions
    .map((d) => `<li>${escapeHtml(d.decision_text)}${d.outcome ? ` — <i>${escapeHtml(d.outcome)}</i>` : ''}</li>`)
    .join('');

  const actionRows = meeting.actions
    .map(
      (a) =>
        `<li>${escapeHtml(a.action_text)} — ${escapeHtml(a.assigned_to || 'Unassigned')}${
          a.due_date ? ` (due ${a.due_date})` : ''
        } — <b>${escapeHtml(a.status)}</b></li>`
    )
    .join('');

  return `
    <h1>${escapeHtml(meeting.title)}</h1>
    <p>${meeting.meeting_date || ''} ${meeting.meeting_time || ''} · ${escapeHtml(meeting.location || '')}</p>
    <h3>Meeting Details</h3>
    <p>Chair: ${escapeHtml(meeting.chair || '—')}<br/>Secretary: ${escapeHtml(meeting.secretary || '—')}<br/>Purpose: ${escapeHtml(meeting.purpose || '—')}</p>
    <h3>Attendance</h3>
    <table><thead><tr><th>Name</th><th>Role</th><th>Status</th></tr></thead><tbody>${attendanceRows}</tbody></table>
    <h3>Agenda</h3>
    <ol>${agendaRows}</ol>
    <h3>Decisions</h3>
    <ul>${decisionRows}</ul>
    <h3>Action Points</h3>
    <ul>${actionRows}</ul>
  `;
}

export function printMeetingMinutes(meeting: MeetingWithChildren) {
  const w = window.open('', '_blank');
  if (!w) return;
  const status = meetingStatus(meeting);
  w.document.write(
    `<!doctype html><html><head><title>${meeting.title} Minutes</title><style>@page{size:A4;margin:16mm}body{font-family:Arial;color:#111827;font-size:12px;line-height:1.55}h1{font-size:22px}h3{margin-top:20px;border-bottom:1px solid #ddd;padding-bottom:5px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px;text-align:left}.status{float:right;font-size:10px;border:1px solid #ddd;padding:5px 8px;border-radius:10px}</style></head><body><span class="status">${status}</span>${buildMinutesHtml(meeting)}</body></html>`
  );
  w.document.close();
  setTimeout(() => w.print(), 250);
}
