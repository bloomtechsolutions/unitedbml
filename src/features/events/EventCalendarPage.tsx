'use client';

import { useMemo, useState } from 'react';
import { PageInfoPanel } from '../../components/PageInfoPanel';
import { useToast } from '../../lib/ToastContext';
import type { EventRow } from '../../types/database';
import { useEventFinanceSummary } from '../finance/useFinance';
import { EventCalendar } from './EventCalendar';
import { EventDetailModal } from './EventDetailModal';
import { EventFormModal } from './EventFormModal';
import { HolidayManagerModal } from './HolidayManagerModal';
import { PlannedActivityModal } from './PlannedActivityModal';
import { eventLifecycle } from './lifecycle';
import type { EventWithChildren } from './types';
import { createEvent, deleteEvent, updateEvent, useCommitteeMembers, useEventTypes, useEvents } from './useEvents';
import { deletePlannedActivity, markPlannedActivityPromoted, usePlannedActivities, usePublicHolidays } from './useEventCalendar';
import type { PlannedActivityRow } from '../../types/database';

const CALENDAR_INFO = [
  {
    q: 'What is the Event Calendar?',
    a: "A year-at-a-glance view of every planned activity, including Maldives public holidays. Click a month chip to jump to it, click any day to see what's on, and click an activity to open its full detail.",
  },
  {
    q: 'What is a Planned Activity?',
    a: "A lightweight placeholder for something not yet set up as a full Event — just a name and a date, shown with a dashed outline. Use it to hold a date while details (budget, coordinator, scope) are still being worked out.",
  },
  {
    q: 'How do I turn a Planned Activity into a real Event?',
    a: 'Open the day, find the placeholder, and click Promote to Event — it opens the full Create Event form pre-filled with the name and date. The placeholder is then linked to the new event and stops showing as a separate item.',
  },
  {
    q: 'Where do the public holidays come from?',
    a: "A committee-maintained list (Manage Holidays button). Fixed-date holidays don't change, but Islamic-calendar ones (Eid, Hajj Day, National Day, Mawlid) shift every year with moon sighting — update them here once officially confirmed.",
  },
];

export function EventCalendarPage() {
  const { events, reload: reloadEvents } = useEvents();
  const eventTypes = useEventTypes();
  const coordinators = useCommitteeMembers();
  const { statusByEvent: financeByEvent } = useEventFinanceSummary();
  const { activities, reload: reloadActivities } = usePlannedActivities();
  const { holidays, reload: reloadHolidays } = usePublicHolidays();
  const toast = useToast();

  const [view, setView] = useState<'calendar' | 'info'>('calendar');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [plannedModalOpen, setPlannedModalOpen] = useState(false);
  const [plannedDefaultDate, setPlannedDefaultDate] = useState('');
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithChildren | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [promoting, setPromoting] = useState<PlannedActivityRow | null>(null);

  const enriched = useMemo(
    () =>
      events.map((event) => ({
        event,
        lifecycle: eventLifecycle(event, event.tasks, financeByEvent.get(event.id) ?? { hasApproved: false, hasPending: false }),
      })),
    [events, financeByEvent]
  );

  const detailEntry = detailId ? events.find((e) => e.id === detailId) ?? null : null;

  const closeForm = () => {
    setFormOpen(false);
    setEditingEvent(null);
    setPromoting(null);
  };

  const handleSave = async (payload: Partial<EventRow>) => {
    if (editingEvent) {
      await updateEvent(editingEvent.id, payload);
      toast('Event updated');
    } else if (promoting) {
      const newId = await createEvent(payload);
      await markPlannedActivityPromoted(promoting.id, newId);
      await reloadActivities();
      toast('Planned activity promoted to a full event');
    }
    await reloadEvents();
  };

  const handleArchive = async (event: EventWithChildren) => {
    await updateEvent(event.id, { archived: true, archived_at: new Date().toISOString() });
    await reloadEvents();
    toast('Event archived');
    setDetailId(null);
  };

  const handleCancel = async (event: EventWithChildren) => {
    if (!confirm('Cancel this event? Financial records will be preserved.')) return;
    await updateEvent(event.id, { cancelled_at: new Date().toISOString(), manual_state: 'Cancelled' });
    await reloadEvents();
    toast('Event cancelled');
    setDetailId(null);
  };

  const handleDelete = async (event: EventWithChildren) => {
    if (!confirm(`Delete "${event.name}" permanently? This cannot be undone.`)) return;
    try {
      await deleteEvent(event.id);
      await reloadEvents();
      toast('Event deleted');
      setDetailId(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Unable to delete event.');
    }
  };

  const handleDeletePlaceholder = async (id: string) => {
    if (!confirm('Remove this planned activity?')) return;
    try {
      await deletePlannedActivity(id);
      await reloadActivities();
      toast('Planned activity removed');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove.');
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Event Calendar</h2>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={`tab ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>
          Calendar
        </button>
        <button className={`tab ${view === 'info' ? 'active' : ''}`} onClick={() => setView('info')}>
          Info
        </button>
      </div>

      {view === 'info' && <PageInfoPanel sections={CALENDAR_INFO} />}

      {view === 'calendar' && (
        <EventCalendar
          events={enriched}
          placeholders={activities}
          holidays={holidays}
          onOpenEvent={setDetailId}
          onAddPlaceholder={(date) => {
            setPlannedDefaultDate(date);
            setPlannedModalOpen(true);
          }}
          onPromotePlaceholder={(activity) => {
            setPromoting(activity);
            setFormOpen(true);
          }}
          onDeletePlaceholder={(id) => void handleDeletePlaceholder(id)}
          onManageHolidays={() => setHolidayModalOpen(true)}
        />
      )}

      <PlannedActivityModal
        open={plannedModalOpen}
        onClose={() => setPlannedModalOpen(false)}
        defaultDate={plannedDefaultDate}
        onSaved={reloadActivities}
      />

      <HolidayManagerModal open={holidayModalOpen} onClose={() => setHolidayModalOpen(false)} holidays={holidays} onSaved={reloadHolidays} />

      <EventFormModal
        open={formOpen}
        onClose={closeForm}
        onSave={handleSave}
        eventTypes={eventTypes}
        coordinators={coordinators}
        editing={editingEvent}
        initialValues={promoting ? { name: promoting.name, event_date: promoting.planned_date, description: promoting.notes ?? '' } : undefined}
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
        onRefresh={reloadEvents}
      />
    </div>
  );
}
