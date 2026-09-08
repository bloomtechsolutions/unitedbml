export function Placeholder({ title }: { title: string }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        <p style={{ color: 'var(--muted)' }}>
          This module has not been migrated to the new architecture yet. It is still available in the legacy
          build.
        </p>
      </div>
    </div>
  );
}
