'use client';

import { useMemo, useState } from 'react';
import { LEADERBOARD_VIEWS, leaderboardLevel, scoreForView } from './types';
import type { LeaderboardRow, LeaderboardView } from './types';
import { useLeaderboard } from './useLeaderboard';

const LEVEL_CLASS: Record<string, string> = { Starter: '', Bronze: 'bronze', Silver: 'silver', Gold: 'gold' };
const MEDAL = ['🥇', '🥈', '🥉'];
const ACTIVITY_ICON: Record<string, string> = { event: '◉', task: '✓', win: '★' };

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function LeaderboardPage() {
  const { rows, loading, error } = useLeaderboard();
  const [view, setView] = useState<LeaderboardView>('overall');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const departments = useMemo(
    () => Array.from(new Set(rows.map((r) => r.department).filter((d): d is string => !!d))).sort(),
    [rows]
  );

  const sorted = useMemo(() => {
    return rows
      .filter((r) => r.points > 0 || r.events > 0 || r.wins > 0 || r.tasks > 0)
      .filter((r) => {
        const matchesSearch =
          !search ||
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          (r.uid ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (r.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (r.department ?? '').toLowerCase().includes(search.toLowerCase());
        const matchesDept = !department || r.department === department;
        return matchesSearch && matchesDept;
      })
      .sort((a, b) => scoreForView(b, view) - scoreForView(a, view) || b.points - a.points || a.name.localeCompare(b.name));
  }, [rows, view, search, department]);

  if (loading) return <div>Loading leaderboard…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load leaderboard: {error}</div>;

  const maxScore = sorted.length ? scoreForView(sorted[0], view) || 1 : 1;
  const totalPoints = rows.reduce((sum, r) => sum + r.points, 0);
  const topScore = sorted.length ? scoreForView(sorted[0], view) : 0;
  const podium = sorted.slice(0, 3);
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

  return (
    <div>
      <div className="leaderboard-hero">
        <div>
          <div className="leaderboard-kicker">UNITEDBML</div>
          <h2>Leaderboard</h2>
          <p>Recognizing event attendance, achievements, and task delivery — tracked by committee.</p>
        </div>
      </div>

      <div className="leaderboard-controlbar">
        <div className="leaderboard-view-tabs">
          {LEADERBOARD_VIEWS.map((v) => (
            <button key={v.key} className={view === v.key ? 'active' : ''} onClick={() => setView(v.key)}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="leaderboard-filter-tools">
          <input placeholder="Search name, UID, department…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="leaderboard-shell">
        <div className="leaderboard-insight-strip">
          <div>
            <span>Active Staff</span>
            <b>{rows.filter((r) => r.points > 0).length}</b>
          </div>
          <div>
            <span>Total Points</span>
            <b>{totalPoints}</b>
          </div>
          <div>
            <span>Departments</span>
            <b>{departments.length}</b>
          </div>
          <div>
            <span>Top Score</span>
            <b>{topScore}</b>
          </div>
        </div>

        {podium.length > 0 && (
          <div className="leaderboard-podium-stage">
            <div className="leaderboard-podium-grid">
              {podiumOrder.map((row) => {
                if (!row) return null;
                const rank = sorted.indexOf(row);
                const score = scoreForView(row, view);
                return (
                  <div
                    key={row.key}
                    className={`leaderboard-podium-card ${rank === 0 ? 'rank-1' : ''}`}
                    onClick={() => setExpandedKey(expandedKey === row.key ? null : row.key)}
                  >
                    <div className="leaderboard-medal">{MEDAL[rank]}</div>
                    <div className="leaderboard-avatar podium-avatar">{initials(row.name)}</div>
                    <div className="leaderboard-podium-rank">Rank {rank + 1}</div>
                    <h3>{row.name}</h3>
                    <small>{row.department || 'No department'}</small>
                    <div className="leaderboard-podium-score">
                      <b>{score}</b>
                      <span>points</span>
                    </div>
                    <div className="leaderboard-mini-progress">
                      <span style={{ width: `${Math.min(100, (score / maxScore) * 100)}%` }} />
                    </div>
                    <div className="leaderboard-podium-meta">
                      <span>{row.events} events</span>
                      <span>{row.wins} wins</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="leaderboard-ranking-card">
          <div className="leaderboard-ranking-head">
            <div>
              <h3>Full Ranking</h3>
              <p>Tap a row for activity details</p>
            </div>
            <span>{sorted.length} people</span>
          </div>
          {sorted.map((row, idx) => {
            const score = scoreForView(row, view);
            const expanded = expandedKey === row.key;
            return (
              <div key={row.key}>
                <button
                  className={`leaderboard-ranking-item ${idx < 3 ? 'top-rank' : ''} ${expanded ? 'expanded' : ''}`}
                  onClick={() => setExpandedKey(expanded ? null : row.key)}
                >
                  <div className="leaderboard-position">{idx < 3 ? MEDAL[idx] : `#${idx + 1}`}</div>
                  <div className="leaderboard-avatar">{initials(row.name)}</div>
                  <div className="leaderboard-person">
                    <b>{row.name}</b>
                    <small>
                      {row.uid || row.email || ''} {row.department ? `· ${row.department}` : ''}
                    </small>
                  </div>
                  <div className="leaderboard-scorebar">
                    <span>
                      <i style={{ width: `${Math.min(100, (score / maxScore) * 100)}%` }} />
                    </span>
                    <small>{score} pts</small>
                  </div>
                  <div className="leaderboard-count">
                    <b>{row.events}</b>
                    <small>Events</small>
                  </div>
                  <div className="leaderboard-count">
                    <b>{row.wins}</b>
                    <small>Achievements</small>
                  </div>
                  <div className="leaderboard-points">
                    <b>{row.points}</b>
                    <small>Total</small>
                  </div>
                  <div className="leaderboard-chevron">{expanded ? '▲' : '▼'}</div>
                </button>
                {expanded && <LeaderboardDetail row={row} />}
              </div>
            );
          })}
          {!sorted.length && <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>No activity to rank yet.</div>}
        </div>
      </div>
    </div>
  );
}

function LeaderboardDetail({ row }: { row: LeaderboardRow }) {
  const { level, next, floor, ceiling } = leaderboardLevel(row.points);
  const progressPct = ceiling ? Math.min(100, ((row.points - floor) / (ceiling - floor)) * 100) : 100;

  return (
    <div className="leaderboard-detail-panel">
      <div className="leaderboard-profile-summary">
        <div className="leaderboard-avatar large">{initials(row.name)}</div>
        <div>
          <h3>{row.name}</h3>
          <p>{row.department || 'No department'}</p>
          <small>{row.uid || row.email}</small>
        </div>
        <span className={`leaderboard-level-badge ${LEVEL_CLASS[level]}`}>{level}</span>
      </div>
      <div className="leaderboard-detail-stats">
        <div>
          <b>{row.points}</b>
          <span>Total Points</span>
        </div>
        <div>
          <b>{row.events}</b>
          <span>Events</span>
        </div>
        <div>
          <b>{row.tasks}</b>
          <span>Completed Tasks</span>
        </div>
        <div>
          <b>{row.wins}</b>
          <span>Achievements</span>
        </div>
      </div>
      <div className="leaderboard-level-progress">
        <div>
          <span>{level}</span>
          {next !== null && <b>{next} pts to next level</b>}
        </div>
        <div className="leaderboard-progress-track">
          <span style={{ width: `${progressPct}%` }} />
        </div>
      </div>
      <div className="leaderboard-activity-feed">
        <h4>Recent Activity</h4>
        {row.activity.map((a, i) => (
          <div key={i} className="leaderboard-activity-item">
            <div className="leaderboard-activity-icon">{ACTIVITY_ICON[a.type]}</div>
            <div>
              <b>{a.title}</b>
              <small>{a.detail}</small>
            </div>
            <strong>+{a.points}</strong>
          </div>
        ))}
        {!row.activity.length && <small style={{ color: 'var(--muted)' }}>No activity recorded yet.</small>}
      </div>
    </div>
  );
}
