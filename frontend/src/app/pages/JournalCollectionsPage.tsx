/**
 * Two-column page: journal cards on the left, right sidebar with three
 * stacked panels (stats summary / tag pie chart / GPT recommendation).
 *
 * The pie + stats both share the same /journals/stats payload, so we fetch
 * once and slice. GPT recommendation is loaded on demand (it's an API call
 * that costs money — don't fire unless the user opens that tab).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookText, Globe, MapPin, PieChart as PieChartIcon, Sparkles, TrendingUp } from 'lucide-react'

import {
  getJournalRecommendations,
  getJournalStats,
  listJournals,
  type JournalRecommendations,
  type JournalStats,
  type JournalSummary,
} from '../services/journalApi'

type SidebarTab = 'stats' | 'pie' | 'gpt'

const formatDate = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Pure SVG pie chart so we don't pull a charting lib for a single chart.
function PieChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0)
  if (total === 0) {
    return <p className="muted-copy">No tag data yet — generate a journal first.</p>
  }

  const colors = ['#0f766e', '#f59e0b', '#6366f1', '#ec4899', '#10b981', '#ef4444', '#0ea5e9', '#a855f7']
  const radius = 90
  const cx = 100
  const cy = 100

  let start = -Math.PI / 2  // start at top
  const slices = data.map((slice, idx) => {
    const angle = (slice.value / total) * Math.PI * 2
    const end = start + angle
    const x1 = cx + radius * Math.cos(start)
    const y1 = cy + radius * Math.sin(start)
    const x2 = cx + radius * Math.cos(end)
    const y2 = cy + radius * Math.sin(end)
    const largeArc = angle > Math.PI ? 1 : 0
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
    start = end
    return { path, color: colors[idx % colors.length], label: slice.label, value: slice.value }
  })

  return (
    <div className="journal-pie-shell">
      <svg viewBox="0 0 200 200" className="journal-pie-svg">
        {slices.map((slice, idx) => (
          <path key={idx} d={slice.path} fill={slice.color} stroke="#ffffff" strokeWidth={1.5} />
        ))}
      </svg>
      <ul className="journal-pie-legend">
        {slices.map((slice, idx) => (
          <li key={idx}>
            <span className="journal-pie-swatch" style={{ background: slice.color }} />
            <span className="journal-pie-label">{slice.label.replace(/_/g, ' ')}</span>
            <span className="journal-pie-value">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function JournalCollectionsPage() {
  const navigate = useNavigate()
  const [journals, setJournals] = useState<JournalSummary[] | null>(null)
  const [stats, setStats] = useState<JournalStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<SidebarTab>('stats')
  const [recs, setRecs] = useState<JournalRecommendations | null>(null)
  const [isLoadingRecs, setIsLoadingRecs] = useState(false)
  const [recsError, setRecsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listJournals(), getJournalStats()])
      .then(([j, s]) => {
        if (cancelled) return
        setJournals(j)
        setStats(s)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load collections.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Lazy-load recommendations only when the GPT tab is opened.
  useEffect(() => {
    if (tab !== 'gpt' || recs !== null || isLoadingRecs) return
    setIsLoadingRecs(true)
    setRecsError(null)
    getJournalRecommendations()
      .then(setRecs)
      .catch((e) => setRecsError(e instanceof Error ? e.message : 'Failed to load recommendations.'))
      .finally(() => setIsLoadingRecs(false))
  }, [tab, recs, isLoadingRecs])

  const pieData = useMemo(() => {
    if (!stats) return []
    return Object.entries(stats.subject_distribution)
      .filter(([, count]) => count > 0)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
  }, [stats])

  if (error) {
    return (
      <div className="journal-collections-shell">
        <p className="field-error">{error}</p>
      </div>
    )
  }

  return (
    <div className="journal-collections-shell">
      <header className="journal-picker-header">
        <button type="button" className="journal-picker-back" onClick={() => navigate('/journal')}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <div className="journal-picker-titles">
          <h2>Journal Collections</h2>
          <p>{journals ? `${journals.length} saved` : 'Loading…'}</p>
        </div>
      </header>

      <div className="journal-collections-layout">
        {/* Left column: journal cards */}
        <section className="journal-collections-grid">
          {journals === null ? (
            <p className="muted-copy">Loading journals…</p>
          ) : journals.length === 0 ? (
            <p className="muted-copy">
              No saved journals yet. Head to Create Journal to make your first one.
            </p>
          ) : (
            journals.map((j) => (
              <button
                key={j.id}
                type="button"
                className="journal-collection-card"
                onClick={() => navigate(`/journal/collections/${j.id}`)}
              >
                <div className="journal-collection-card-strip" />
                <div className="journal-collection-card-body">
                  <strong>{j.title?.trim() || 'Untitled Journal'}</strong>
                  <span className="journal-collection-card-place">
                    <MapPin size={12} />
                    {[j.primary_city, j.primary_country].filter(Boolean).join(', ') || 'Unknown'}
                  </span>
                  <span className="journal-collection-card-meta">
                    {formatDate(j.earliest_captured_at ?? j.created_at)} · {j.entry_count} entries
                  </span>
                </div>
              </button>
            ))
          )}
        </section>

        {/* Right column: stats / pie / GPT recs */}
        <aside className="journal-stats-sidebar">
          <nav className="journal-stats-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={`journal-stats-tab ${tab === 'stats' ? 'is-active' : ''}`}
              onClick={() => setTab('stats')}
              aria-selected={tab === 'stats'}
              title="Summary"
            >
              <TrendingUp size={16} />
            </button>
            <button
              type="button"
              role="tab"
              className={`journal-stats-tab ${tab === 'pie' ? 'is-active' : ''}`}
              onClick={() => setTab('pie')}
              aria-selected={tab === 'pie'}
              title="Subject distribution"
            >
              <PieChartIcon size={16} />
            </button>
            <button
              type="button"
              role="tab"
              className={`journal-stats-tab ${tab === 'gpt' ? 'is-active' : ''}`}
              onClick={() => setTab('gpt')}
              aria-selected={tab === 'gpt'}
              title="GPT recommendations"
            >
              <Sparkles size={16} />
            </button>
          </nav>

          <div className="journal-stats-panel">
            {tab === 'stats' && stats !== null && (
              <div className="journal-stats-summary">
                <div className="journal-stats-metric">
                  <Globe size={16} />
                  <strong>{stats.country_count}</strong>
                  <span>countries</span>
                </div>
                <div className="journal-stats-metric">
                  <MapPin size={16} />
                  <strong>{stats.city_count}</strong>
                  <span>cities</span>
                </div>
                <div className="journal-stats-metric">
                  <BookText size={16} />
                  <strong>{stats.photo_count}</strong>
                  <span>photos</span>
                </div>
                <div className="journal-stats-metric">
                  <TrendingUp size={16} />
                  <strong>{stats.total_distance_km.toLocaleString()} km</strong>
                  <span>total distance</span>
                </div>
              </div>
            )}

            {tab === 'pie' && <PieChart data={pieData} />}

            {tab === 'gpt' && (
              <div className="journal-recs">
                {isLoadingRecs && <p className="muted-copy">Generating ideas…</p>}
                {recsError && <p className="field-error">{recsError}</p>}
                {recs && (
                  <>
                    {recs.low_data && (
                      <p className="muted-copy">
                        You have few entries so the picks may be tentative — save more journals
                        for sharper suggestions.
                      </p>
                    )}
                    {recs.recommendations.map((r) => (
                      <article key={`${r.name}-${r.country}`} className="journal-rec-card">
                        <strong>
                          {r.name}, {r.country}
                        </strong>
                        <p>{r.reason}</p>
                      </article>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
