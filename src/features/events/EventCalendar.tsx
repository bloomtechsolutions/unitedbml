'use client';

import { useMemo, useState } from 'react';
import type { EventRow } from '../../types/database';
import { localTodayIso, type EventLifecycle } from './lifecycle';

interface CalendarEntry {
  event: EventRow;
  lifecycle: EventLifecycle;
}

interface Props {
  events: CalendarEntry[];
  onOpenEvent: (id: string) => void;
}

const LIFECYCLE_PILL: Record<EventLifecycle, string> = {
  Planning: 'ub-pill-accent',
  Ready: 'ub-pill-success',
  'Event Day': 'ub-pill-gold',
  'Post-Event Settlement': 'ub-pill-warning',
  Closed: 'ub-pill-neutral',
  Cancelled: 'ub-pill-danger',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function EventCalendar({ events, onOpenEvent }: Props) {
  const todayIso = localTodayIso();
  const todayDate = new Date(`${todayIso}T00:00:00`);

  const [cursor, setCursor] = useState({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
  const [selectedDate, setSelectedDate] = useState<string | null>(todayIso);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of events) {
      const d = entry.event.event_date;
      if (!d) continue;
      const arr = map.get(d) ?? [];
      arr.push(entry);
      map.set(d, arr);
    }
    return map;
  }, [events]);

  const yearCounts = useMemo(() => {
    const counts = new Array(12).fill(0);
    for (const entry of events) {
      const d = entry.event.event_date;
      if (!d) continue;
      const [y, m] = d.split('-').map(Number);
      if (y === cursor.year) counts[m - 1] += 1;
    }
    return counts;
  }, [events, cursor.year]);
  const maxYearCount = Math.max(1, ...yearCounts);

  const years = useMemo(() => {
    const set = new Set<number>([todayDate.getFullYear()]);
    for (const entry of events) {
      const d = entry.event.event_date;
      if (d) set.add(Number(d.slice(0, 4)));
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [events, todayDate]);

  const grid = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const daysInPrevMonth = new Date(cursor.year, cursor.month, 0).getDate();
    const cells: { iso: string; day: number; inMonth: boolean }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const m = cursor.month === 0 ? 12 : cursor.month;
      const y = cursor.month === 0 ? cursor.year - 1 : cursor.year;
      cells.push({ iso: `${y}-${pad(m)}-${pad(day)}`, day, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ iso: `${cursor.year}-${pad(cursor.month + 1)}-${pad(day)}`, day, inMonth: true });
    }
    let nextDay = 1;
    while (cells.length % 7 !== 0 || cells.length < 42) {
      const m = cursor.month === 11 ? 1 : cursor.month + 2;
      const y = cursor.month === 11 ? cursor.year + 1 : cursor.year;
      cells.push({ iso: `${y}-${pad(m)}-${pad(nextDay)}`, day: nextDay, inMonth: false });
      nextDay++;
      if (cells.length >= 42) break;
    }
    return cells;
  }, [cursor]);

  const goToday = () => {
    setCursor({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
    setSelectedDate(todayIso);
  };
  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      let month = c.month + delta;
      let year = c.year;
      if (month < 0) {
        month = 11;
        year -= 1;
      } else if (month > 11) {
        month = 0;
        year += 1;
      }
      return { year, month };
    });
  };

  const selectedEvents = selectedDate ? byDate.get(selectedDate) ?? [] : [];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {MONTH_SHORT.map((m, i) => {
          const count = yearCounts[i];
          const active = i === cursor.month;
          return (
            <button
              key={m}
              onClick={() => setCursor((c) => ({ ...c, month: i }))}
              className="ub-cal-month-chip"
              data-active={active || undefined}
              title={`${count} ${count === 1 ? 'activity' : 'activities'} in ${MONTH_NAMES[i]}`}
            >
              <span>{m}</span>
              <span className="ub-cal-month-bar">
                <span style={{ width: `${Math.round((count / maxYearCount) * 100)}%` }} />
              </span>
              <span className="ub-cal-month-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
        <div className="ub-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="ub-btn ub-btn-ghost" style={{ padding: '6px 10px' }} onClick={() => shiftMonth(-1)} aria-label="Previous month">
                ‹
              </button>
              <div style={{ fontSize: 16, fontWeight: 700, minWidth: 150, textAlign: 'center' }}>
                {MONTH_NAMES[cursor.month]} {cursor.year}
              </div>
              <button className="ub-btn ub-btn-ghost" style={{ padding: '6px 10px' }} onClick={() => shiftMonth(1)} aria-label="Next month">
                ›
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                value={cursor.year}
                onChange={(e) => setCursor((c) => ({ ...c, year: Number(e.target.value) }))}
                style={{ fontSize: 12.5 }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button className="ub-btn ub-btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={goToday}>
                Today
              </button>
            </div>
          </div>

          <div className="ub-cal-grid ub-cal-weekdays">
            {WEEKDAYS.map((w) => (
              <div key={w} className="ub-cal-weekday">
                {w}
              </div>
            ))}
          </div>
          <div className="ub-cal-grid">
            {grid.map((cell) => {
              const dayEvents = byDate.get(cell.iso) ?? [];
              const isToday = cell.iso === todayIso;
              const isSelected = cell.iso === selectedDate;
              return (
                <button
                  key={cell.iso}
                  className="ub-cal-cell"
                  data-in-month={cell.inMonth || undefined}
                  data-today={isToday || undefined}
                  data-selected={isSelected || undefined}
                  onClick={() => setSelectedDate(cell.iso)}
                >
                  <span className="ub-cal-cell-day">{cell.day}</span>
                  <span className="ub-cal-cell-chips">
                    {dayEvents.slice(0, 2).map((e) => (
                      <span key={e.event.id} className={`ub-cal-chip ${LIFECYCLE_PILL[e.lifecycle]}`}>
                        {e.event.name}
                      </span>
                    ))}
                    {dayEvents.length > 2 && <span className="ub-cal-chip-more">+{dayEvents.length - 2} more</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--ub-border-2)' }}>
            {(Object.keys(LIFECYCLE_PILL) as EventLifecycle[]).map((stage) => (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ub-ink-faint)' }}>
                <span className={`ub-pill ${LIFECYCLE_PILL[stage]}`} style={{ padding: '2px 8px' }}>
                  {stage}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="ub-card" style={{ padding: 16, position: 'sticky', top: 16 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ub-ink-faint)', textTransform: 'uppercase', marginBottom: 2 }}>
            {selectedDate === todayIso ? 'Today' : selectedDate}
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            {selectedDate
              ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              : 'Pick a day'}
          </h3>
          {!selectedEvents.length && <p className="ub-empty">No activities scheduled this day.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedEvents.map((e) => (
              <button
                key={e.event.id}
                onClick={() => onOpenEvent(e.event.id)}
                style={{
                  textAlign: 'left',
                  border: '1px solid var(--ub-border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  background: 'var(--ub-surface)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{e.event.name}</span>
                  <span className={`ub-pill ${LIFECYCLE_PILL[e.lifecycle]}`}>{e.lifecycle}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ub-ink-faint)', marginTop: 4 }}>
                  {e.event.venue || 'Venue TBC'}
                  {e.event.coordinator ? ` · ${e.event.coordinator}` : ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
