'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { openGeneratedAttachment } from '../../lib/expenseNotePdf';
import { generateEventReportPdf } from '../../lib/eventReportPdf';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../lib/ToastContext';
import type { EventReportPhotoRow, EventReportRow } from '../../types/database';
import {
  addReportPhoto,
  decideEventReport,
  deleteReportPhoto,
  submitEventReport,
  updateEventReport,
  useEventReportPhotos,
  type EventReportEventSnapshot,
} from './useEventReports';
import { removeReportPhoto, reportPhotoAsDataUrl, uploadReportPhoto } from './reportStorage';

interface Props {
  reportId: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

type FormState = {
  staff_attended: number;
  volunteers_count: number;
  no_show_count: number;
  highlights: string;
  feedback_rating: number;
  feedback_text: string;
  challenges: string;
  recommendations: string;
};

const EMPTY_FORM: FormState = {
  staff_attended: 0,
  volunteers_count: 0,
  no_show_count: 0,
  highlights: '',
  feedback_rating: 0,
  feedback_text: '',
  challenges: '',
  recommendations: '',
};

function toForm(r: EventReportRow): FormState {
  return {
    staff_attended: r.staff_attended ?? 0,
    volunteers_count: r.volunteers_count ?? 0,
    no_show_count: r.no_show_count ?? 0,
    highlights: r.highlights ?? '',
    feedback_rating: r.feedback_rating ?? 0,
    feedback_text: r.feedback_text ?? '',
    challenges: r.challenges ?? '',
    recommendations: r.recommendations ?? '',
  };
}

export function EventReportModal({ reportId, onClose, onSaved }: Props) {
  const { session, profile } = useAuth();
  const toast = useToast();
  const isPresident = profile?.role === 'President';

  const [report, setReport] = useState<EventReportRow | null>(null);
  const [event, setEvent] = useState<EventReportEventSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [comment, setComment] = useState('');

  const { photos, reload: reloadPhotos } = useEventReportPhotos(reportId);

  useEffect(() => {
    if (!reportId) {
      setReport(null);
      setEvent(null);
      setForm(EMPTY_FORM);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from('event_reports')
      .select(
        '*, event:events(id,name,event_type,event_date,venue,coordinator,coordinator_role,expected_participants,attendance_count,planned_budget,actual_expense_total,finance_settlement_status)'
      )
      .eq('id', reportId)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          toast('Failed to load report.');
          setLoading(false);
          return;
        }
        const { event: eventSnapshot, ...reportRow } = data as unknown as EventReportRow & { event: EventReportEventSnapshot };
        setReport(reportRow);
        setEvent(eventSnapshot ?? null);
        setForm(toForm(reportRow));
        setComment(reportRow.president_comment ?? '');
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  if (!reportId) return null;

  const isLocked = report && (report.status === 'Submitted' || report.status === 'Approved');
  const canEdit = !isLocked;

  const handleSaveDraft = async () => {
    if (!report) return;
    setSaving(true);
    try {
      await updateEventReport(report.id, form);
      await onSaved();
      toast('Report saved.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save report.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!report || !session) return;
    setSaving(true);
    try {
      await updateEventReport(report.id, form);
      await submitEventReport(report.id, session.user.id, profile?.full_name || 'Coordinator');
      await onSaved();
      toast('Report submitted for President sign-off.');
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = async (decision: 'Approved' | 'Returned') => {
    if (!report) return;
    if (decision === 'Returned' && !comment.trim()) {
      toast('Add a comment explaining what needs revising.');
      return;
    }
    setSaving(true);
    try {
      await decideEventReport(report.id, decision, comment, profile?.full_name || 'President', profile?.role || 'President');
      await onSaved();
      toast(decision === 'Approved' ? 'Report approved.' : 'Report returned to coordinator.');
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to record decision.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrefillHighlights = async () => {
    if (!event) return;
    const { data: tournaments } = await supabase.from('tournaments').select('id,name').eq('event_id', event.id);
    if (!tournaments?.length) {
      toast('No tournament results found for this event.');
      return;
    }
    const { data: winners } = await supabase
      .from('tournament_winners')
      .select('position,winner_name,tournament_id')
      .in('tournament_id', tournaments.map((t) => t.id));
    if (!winners?.length) {
      toast('No winners recorded for this event.');
      return;
    }
    const lines = winners.map((w) => {
      const t = tournaments.find((x) => x.id === w.tournament_id);
      return `${t?.name ? `${t.name} — ` : ''}${w.position}: ${w.winner_name}`;
    });
    setForm((f) => ({ ...f, highlights: [f.highlights, ...lines].filter(Boolean).join('\n') }));
    toast('Winners added to Highlights.');
  };

  const handleUploadPhoto = async (file: File) => {
    if (!report) return;
    setUploading(true);
    try {
      const { path } = await uploadReportPhoto(report.id, file);
      await addReportPhoto(report.id, path, '', photos.length, session?.user.id ?? null);
      await reloadPhotos();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photo: EventReportPhotoRow) => {
    try {
      await removeReportPhoto(photo.storage_path);
      await deleteReportPhoto(photo.id);
      await reloadPhotos();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove photo.');
    }
  };

  const handleDownloadPdf = async () => {
    if (!report || !event) return;
    setDownloading(true);
    try {
      const resolved = await Promise.all(
        photos.slice(0, 12).map(async (p) => ({ dataUrl: await reportPhotoAsDataUrl(p.storage_path), caption: p.caption }))
      );
      const gallery = resolved.filter((p): p is { dataUrl: string; caption: string | null } => !!p.dataUrl);
      const attachment = await generateEventReportPdf(report, event, gallery);
      openGeneratedAttachment(attachment);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to generate PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal open={!!reportId} onClose={onClose} title={event?.name ? `Event Report — ${event.name}` : 'Event Report'} wide>
      {loading || !report ? (
        <div>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="ub-kpi-strip">
            <div className="ub-kpi-strip-item">
              <span className="ub-kpi-strip-value">{event?.event_date ? new Date(event.event_date).toLocaleDateString('en-GB') : '—'}</span>
              <span className="ub-kpi-strip-label">Event Date</span>
            </div>
            <div className="ub-kpi-strip-item">
              <span className="ub-kpi-strip-value">{event?.planned_budget?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? '—'}</span>
              <span className="ub-kpi-strip-label">Planned Budget</span>
            </div>
            <div className="ub-kpi-strip-item">
              <span className="ub-kpi-strip-value">{event?.actual_expense_total?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? '—'}</span>
              <span className="ub-kpi-strip-label">Actual Expense</span>
            </div>
            <div className="ub-kpi-strip-item">
              <span className="ub-kpi-strip-value">
                <span className={`pill ${report.status === 'Approved' ? 'plan' : ''}`}>{report.status}</span>
              </span>
              <span className="ub-kpi-strip-label">Status</span>
            </div>
          </div>

          {report.status === 'Returned' && report.president_comment && (
            <div className="banner" style={{ background: 'var(--warn-bg,#fff4e5)', padding: 10, borderRadius: 8 }}>
              Returned by {report.decided_by_name}: {report.president_comment}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label>
              Staff Attended
              <input
                type="number"
                min={0}
                value={form.staff_attended}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, staff_attended: Number(e.target.value) }))}
              />
            </label>
            <label>
              Volunteers
              <input
                type="number"
                min={0}
                value={form.volunteers_count}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, volunteers_count: Number(e.target.value) }))}
              />
            </label>
            <label>
              No-Shows
              <input
                type="number"
                min={0}
                value={form.no_show_count}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, no_show_count: Number(e.target.value) }))}
              />
            </label>
          </div>

          <label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Highlights
              {canEdit && (
                <button type="button" className="btn ghost" onClick={() => void handlePrefillHighlights()}>
                  Pull Winners
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={form.highlights}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, highlights: e.target.value }))}
            />
          </label>

          <label>
            Overall Feedback Rating
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setForm((f) => ({ ...f, feedback_rating: n }))}
                  style={{ fontSize: 20, background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', color: n <= form.feedback_rating ? '#f5a623' : '#ccc' }}
                >
                  ★
                </button>
              ))}
            </div>
          </label>

          <label>
            Feedback Notes
            <textarea
              rows={3}
              value={form.feedback_text}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, feedback_text: e.target.value }))}
            />
          </label>

          <label>
            Challenges Faced
            <textarea
              rows={3}
              value={form.challenges}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, challenges: e.target.value }))}
            />
          </label>

          <label>
            Recommendations
            <textarea
              rows={3}
              value={form.recommendations}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, recommendations: e.target.value }))}
            />
          </label>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>Photos</strong>
              {canEdit && (
                <label className="btn soft" style={{ cursor: 'pointer' }}>
                  {uploading ? 'Uploading…' : 'Add Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUploadPhoto(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {photos.map((p) => (
                <div key={p.id} style={{ position: 'relative' }}>
                  <PhotoThumb path={p.storage_path} />
                  {canEdit && (
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ position: 'absolute', top: 2, right: 2, padding: '2px 6px' }}
                      onClick={() => void handleDeletePhoto(p)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {!photos.length && <span style={{ color: 'var(--muted)' }}>No photos added yet.</span>}
            </div>
          </div>

          {isPresident && report.status === 'Submitted' && (
            <div style={{ borderTop: '1px solid var(--border,#e5e7eb)', paddingTop: 14 }}>
              <strong>President Sign-off</strong>
              <textarea
                rows={2}
                placeholder="Comment (required if returning)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{ marginTop: 8 }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn primary" disabled={saving} onClick={() => void handleDecision('Approved')}>
                  Approve
                </button>
                <button className="btn ghost" disabled={saving} onClick={() => void handleDecision('Returned')}>
                  Return
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border,#e5e7eb)', paddingTop: 14 }}>
            <button className="btn ghost" disabled={downloading} onClick={() => void handleDownloadPdf()}>
              {downloading ? 'Generating…' : 'Download PDF'}
            </button>
            {canEdit && (
              <>
                <button className="btn soft" disabled={saving} onClick={() => void handleSaveDraft()}>
                  Save Draft
                </button>
                <button className="btn primary" disabled={saving} onClick={() => void handleSubmit()}>
                  Submit for Sign-off
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function PhotoThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    import('./reportStorage').then(({ reportPhotoSignedUrl }) => {
      reportPhotoSignedUrl(path).then((u) => {
        if (active) setUrl(u);
      });
    });
    return () => {
      active = false;
    };
  }, [path]);
  return (
    <div style={{ width: 100, height: 100, borderRadius: 6, overflow: 'hidden', background: '#f2f2f2' }}>
      {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
    </div>
  );
}
