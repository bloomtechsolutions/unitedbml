"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageInfoPanel } from '../../components/PageInfoPanel';
import { useToast } from '../../lib/ToastContext';
import type { EventRow } from '../../types/database';
import { useEventFinanceSummary } from '../finance/useFinance';
import { EventDetailModal } from './EventDetailModal';
import { EventFormModal } from './EventFormModal';
import { eventLifecycle, eventPreparationProgress, eventReadiness, type FinanceStatus } from './lifecycle';
import type { EventWithChildren } from './types';
import { createEvent, deleteEvent, updateEvent, useCommitteeMembers, useEventTypes, useEvents } from './useEvents';

const NO_FINANCE: FinanceStatus = { hasApproved: false, hasPending: false };

type SubTab = 'overview' | 'assignments' | 'attendance' | 'archive' | 'info';

const EVENTS_INFO = [
  {
    q: 'What does an event\'s status mean?',
    a: 'An event moves automatically through Planning → Ready → Event Day → Post-Event Settlement → Closed, worked out from its preparation tasks, Finance approvals, the event date, attendance, and whether Finance has closed the settlement — you never set it by hand.',
  },
  {
    q: 'What is the Assignments tab for?',
    a: "Team assignments for the event, and — for an External-scope event — tagging a Reimbursement Manager: the person who'll submit bills once the event has run outside UnitedBML.",
  },
  {
    q: 'What happens in Attendance?',
    a: 'Record the expected vs. actual roster and check-ins, and log tournament results. Winners entered here feed straight into Leaderboard achievements.',
  },
  {
    q: 'Internal vs External scope — what\'s the difference?',
    a: "Internal events run the full UnitedBML workflow end-to-end. External events are ones staff attend on the club's behalf elsewhere — they skip the Finance Requests workflow and instead use a Reimbursement Manager to submit bills for approved reimbursement, reviewed by the committee in Reimbursements.",
  },
  {
    q: 'Where is the Event Calendar?',
    a: "It's its own page now — Events → Event Calendar in the sidebar. A year-at-a-glance view of every planned activity plus Maldives public holidays, with support for lightweight placeholder activities that don't have a full Event yet.",
  },
  {
    q: 'What does Archive show?',
    a: 'Closed and cancelled events, kept for the historical record and for Reports — they stay out of the active Overview list.',
  },
];

export function EventsPage() {
  const { events, loading, error, reload } = useEvents();
  const eventTypes = useEventTypes();
  const coordinators = useCommitteeMembers();
  const { statusByEvent: financeByEvent } = useEventFinanceSummary();
  const toast = useToast();

  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('new') === '1') setFormOpen(true);
    const openId = searchParams.get('open');
    if (openId) setDetailId(openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enriched = useMemo(
    () =>
      events.map((event) => {
        const finance = financeByEvent.get(event.id) ?? NO_FINANCE;
        return {
          event,
          lifecycle: eventLifecycle(event, event.tasks, finance),
          readiness: eventReadiness(event, event.tasks, finance),
          prep: eventPreparationProgress(event.tasks),
        };
      }),
    [events, financeByEvent]
  );

  const active = enriched.filter((e) => !e.event.archived);
  const archived = enriched.filter((e) => e.event.archived);

  const filtered = active.filter(({ event, lifecycle }) => {
    const matchesSearch =
      !search ||
      event.name.toLowerCase().includes(search.toLowerCase()) ||
      (event.venue || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = !typeFilter || event.event_type === typeFilter;
    const matchesStatus = !statusFilter || lifecycle === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const kpis = {
    total: active.length,
    upcoming: active.filter((e) => e.lifecycle === 'Planning' || e.lifecycle === 'Ready').length,
    planning: active.filter((e) => e.lifecycle === 'Planning').length,
    completed: active.filter((e) => e.lifecycle === 'Closed').length,
    budget: active.reduce((sum, e) => sum + (e.event.planned_budget || 0), 0),
  };

  const detailEntry = detailId ? events.find((e) => e.id === detailId) ?? null : null;

  const handleSave = async (payload: Partial<EventRow>) => {
    if (editingEvent) {
      await updateEvent(editingEvent.id, payload);
      toast('Event updated');
    } else {
      await createEvent(payload);
      toast('Event created');
    }
    await reload();
  };

  const handleArchive = async (event: EventWithChildren) => {
    await updateEvent(event.id, { archived: true, archived_at: new Date().toISOString() });
    await reload();
    toast('Event archived');
    setDetailId(null);
  };

  const handleCancel = async (event: EventWithChildren) => {
    if (!confirm('Cancel this event? Financial records will be preserved.')) return;
    await updateEvent(event.id, { cancelled_at: new Date().toISOString(), manual_state: 'Cancelled' });
    await reload();
    toast('Event cancelled');
    setDetailId(null);
  };

  const handleDelete = async (event: EventWithChildren) => {
    if (!confirm(`Delete "${event.name}" permanently? This cannot be undone.`)) return;
    try {
      await deleteEvent(event.id);
      await reload();
      toast('Event deleted');
      setDetailId(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Unable to delete event.');
    }
  };

  if (loading) return <div>Loading events…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load events: {error}</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Events & Activities</h2>
        </div>
        <div className="actions">
          <button
            className="btn primary"
            onClick={() => {
              setEditingEvent(null);
              setFormOpen(true);
            }}
          >
            + Create Event
          </button>
        </div>
      </div>

      <div className="ub-kpi-strip">
        <div className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{kpis.total}</span>
          <span className="ub-kpi-strip-label">Total Events</span>
        </div>
        <div className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{kpis.upcoming}</span>
          <span className="ub-kpi-strip-label">Upcoming</span>
        </div>
        <div className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{kpis.planning}</span>
          <span className="ub-kpi-strip-label">Planning</span>
        </div>
        <div className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{kpis.completed}</span>
          <span className="ub-kpi-strip-label">Completed</span>
        </div>
        <div className="ub-kpi-strip-item">
          <span className="ub-kpi-strip-value">{kpis.budget.toLocaleString()}</span>
          <span className="ub-kpi-strip-label">Total Budget</span>
        </div>
      </div>

      <div className="tabs">
        {(['overview', 'assignments', 'attendance', 'archive', 'info'] as SubTab[]).map((t) => (
          <button key={t} className={`tab ${subTab === t ? 'active' : ''}`} onClick={() => setSubTab(t)}>
            {t === 'overview' ? 'Event Overview' : t === 'info' ? 'Info' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {subTab === 'info' && <PageInfoPanel sections={EVENTS_INFO} />}

      {subTab === 'overview' && (
        <>
          <div className="toolbar">
            <div className="filters">
              <input placeholder="Search events…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All types</option>
                {eventTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {['Planning', 'Ready', 'Event Day', 'Post-Event Settlement', 'Closed', 'Cancelled'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="event-grid">
            {filtered.map(({ event, lifecycle, prep }) => (
              <div key={event.id} className="event-card" onClick={() => setDetailId(event.id)}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <div className="pill plan">{event.event_type || 'General'}</div>
                    {event.event_scope === 'External' && <div className="pill">External</div>}
                  </div>
                  <h3 style={{ margin: '10px 0 4px' }}>{event.name}</h3>
                  <small style={{ color: 'var(--muted)' }}>
                    {event.event_date || 'No date'} · {event.venue || 'No venue'}
                  </small>
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0' }}>
                    Coordinator: {event.coordinator || '—'}
                  </p>
                  <div className="pill open">{lifecycle}</div>
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>Preparation: {prep}%</div>
                </div>
              </div>
            ))}
            {!filtered.length && <div style={{ color: 'var(--muted)' }}>No events match your filters.</div>}
          </div>
        </>
      )}

      {subTab === 'assignments' && (
        <table className="table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Task</th>
              <th>Owner</th>
              <th>Due</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {active.flatMap(({ event }) =>
              event.tasks.map((task) => (
                <tr key={task.id}>
                  <td>{event.name}</td>
                  <td>{task.task_text}</td>
                  <td>{task.owner || '—'}</td>
                  <td>{task.due_date || '—'}</td>
                  <td>{task.done ? 'Done' : 'Open'}</td>
                  <td>
                    <button className="btn ghost" onClick={() => setDetailId(event.id)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {subTab === 'attendance' && (
        <table className="table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Expected</th>
              <th>Recorded</th>
              <th>Attended</th>
              <th>Rate</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {active.map(({ event }) => {
              const attended = event.attendance.filter((a) => a.attended).length;
              const rate = event.attendance.length ? Math.round((attended / event.attendance.length) * 100) : 0;
              return (
                <tr key={event.id}>
                  <td>{event.name}</td>
                  <td>{event.expected_participants}</td>
                  <td>{event.attendance.length}</td>
                  <td>{attended}</td>
                  <td>{rate}%</td>
                  <td>
                    <button className="btn ghost" onClick={() => setDetailId(event.id)}>
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {subTab === 'archive' && (
        <table className="table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Date</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {archived.map(({ event, lifecycle }) => (
              <tr key={event.id}>
                <td>{event.name}</td>
                <td>{event.event_date}</td>
                <td>{lifecycle}</td>
                <td>
                  <button className="btn ghost" onClick={() => setDetailId(event.id)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {!archived.length && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  No archived events.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <EventFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        eventTypes={eventTypes}
        coordinators={coordinators}
        editing={editingEvent}
      />

      <EventDetailModal
        event={detailEntry}
        onClose={() => setDetailId(null)}
        onEdit={(event) => {
          setEditingEvent(event);
          setDetailId(null);
          setFormOpen(true);
        }}
        onArchive={handleArchive}
        onCancel={handleCancel}
        onDelete={handleDelete}
        coordinators={coordinators}
        onRefresh={reload}
      />
    </div>
  );
}