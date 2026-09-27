'use client';

import { useMemo, useState } from 'react';
import type { PlannedActivityRow } from '../../types/database';
import type { EventWithChildren } from './types';

interface EnrichedEvent {
  event: EventWithChildren;
  lifecycle: string;
}

interface Props {
  events: EnrichedEvent[];
  placeholders: PlannedActivityRow[];
  onOpenEvent: (id: string) => void;
  onPromotePlaceholder: (activity: PlannedActivityRow) => void;
  onDeletePlaceholder: (id: string) => void;
}

type Row =
  | { kind: 'event'; date: string; entry: EnrichedEvent }
  | { kind: 'planned'; date: string; entry: PlannedActivityRow };

export function ActivityListView({ events, placeholders, onOpenEvent, onPromotePlaceholder, onDeletePlaceholder }: Props) {
  const years = useMemo(() => {
    const all = new Set<number>();
    for (const { event } of events) if (event.event_date) all.add(new Date(event.event_date).getFullYear());
    for (const p of placeholders) if (p.planned_date) all.add(new Date(p.planned_date).getFullYear());
    all.add(new Date().getFullYear());
    return Array.from(all).sort((a, b) => b - a);
  }, [events, placeholders]);

  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');

  const rows = useMemo<Row[]>(() => {
    const eventRows: Row[] = events
      .filter(({ event }) => event.event_date && new Date(event.event_date).getFullYear() === year)
      .map((entry) => ({ kind: 'event' as const, date: entry.event.event_date!, entry }));
    const plannedRows: Row[] = placeholders
      .filter((p) => !p.promoted_event_id && p.planned_date && new Date(p.planned_date).getFullYear() === year)
      .map((entry) => ({ kind: 'planned' as const, date: entry.planned_date, entry }));
    const all = [...eventRows, ...plannedRows];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? all.filter((r) => (r.kind === 'event' ? r.entry.event.name : r.entry.name).toLowerCase().includes(q))
      : all;
    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  }, [events, placeholders, year, search]);

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <div className="filters">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <input placeholder="Search activities…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Activity</th>
              <th>Type</th>
              <th>Venue</th>
              <th>Coordinator</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              r.kind === 'event' ? (
                <tr key={`event-${r.entry.event.id}`} onClick={() => onOpenEvent(r.entry.event.id)} style={{ cursor: 'pointer' }}>
                  <td>{r.date}</td>
                  <td>{r.entry.event.name}</td>
                  <td>{r.entry.event.event_type || 'General'}</td>
                  <td>{r.entry.event.venue || '—'}</td>
                  <td>{r.entry.event.coordinator || '—'}</td>
                  <td>
                    <span className="pill open">{r.entry.lifecycle}</span>
                  </td>
                  <td>
                    <button className="btn ghost" onClick={(e) => { e.stopPropagation(); onOpenEvent(r.entry.event.id); }}>
                      Open
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={`planned-${r.entry.id}`}>
                  <td>{r.date}</td>
                  <td>{r.entry.name}</td>
                  <td>{r.entry.event_type || '—'}</td>
                  <td>—</td>
                  <td>—</td>
                  <td>
                    <span className="pill" style={{ borderStyle: 'dashed' }}>
                      Planned (not yet an event)
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn soft" onClick={() => onPromotePlaceholder(r.entry)}>
                        Promote
                      </button>
                      <button className="btn ghost" onClick={() => onDeletePlaceholder(r.entry.id)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {!rows.length && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  No activities planned for {year}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
