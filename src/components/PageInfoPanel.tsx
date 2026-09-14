'use client';

export interface InfoSection {
  q: string;
  a: string;
}

interface Props {
  intro?: string;
  sections: InfoSection[];
}

/** Shared "Info" / FAQ tab content — replaces the inline explainer paragraphs pages used to
 * show above their tables, so each page's own content isn't crowded with instructional copy. */
export function PageInfoPanel({ intro, sections }: Props) {
  return (
    <div style={{ maxWidth: 760 }}>
      {intro && <p style={{ fontSize: 13, color: 'var(--ub-ink-soft, var(--muted))', lineHeight: 1.6, marginBottom: 18 }}>{intro}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sections.map((s) => (
          <div key={s.q} style={{ border: '1px solid var(--border, var(--ub-border))', borderRadius: 10, padding: '13px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 5 }}>{s.q}</div>
            <div style={{ fontSize: 12.8, color: 'var(--muted, var(--ub-ink-faint))', lineHeight: 1.65 }}>{s.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
