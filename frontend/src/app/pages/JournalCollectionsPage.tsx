import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookText, Globe, Library, MapPin, PieChart as PieChartIcon, Sparkles, TrendingUp } from 'lucide-react'

import {
  getJournalRecommendations,
  getJournalStats,
  listJournals,
  type JournalRecommendations,
  type JournalStats,
  type JournalSummary,
  type RecommendationItem,
} from '../services/journalApi'
import { humanizeTag } from '../utils/tags'

type ViewTab = 'collections' | 'stats' | 'pie' | 'gpt'
type PieAxis = 'subject' | 'atmosphere' | 'activity'

const formatDate = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function PieChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0)
  if (total === 0) {
    return <p className="muted-copy">No tag data yet — generate a journal first.</p>
  }

  const colors = ['#0f766e', '#f59e0b', '#6366f1', '#ec4899', '#10b981', '#ef4444', '#0ea5e9', '#a855f7']
  const radius = 130
  const cx = 150
  const cy = 150

  let start = -Math.PI / 2
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
    <div className="journal-pie-shell journal-pie-shell--big">
      <svg viewBox="0 0 300 300" className="journal-pie-svg journal-pie-svg--big">
        {slices.map((slice, idx) => (
          <path key={idx} d={slice.path} fill={slice.color} stroke="#ffffff" strokeWidth={2} />
        ))}
      </svg>
      <ul className="journal-pie-legend journal-pie-legend--big">
        {slices.map((slice, idx) => (
          <li key={idx}>
            <span className="journal-pie-swatch" style={{ background: slice.color }} />
            <span className="journal-pie-label">{humanizeTag(slice.label)}</span>
            <span className="journal-pie-value">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function useRecommendationPhotos(items: RecommendationItem[] | null): Record<string, string | null> {
  const [photos, setPhotos] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (!items) return
    let cancelled = false
    const key = (i: RecommendationItem) => `${i.name}|${i.country}`
    const missing = items.filter((i) => !(key(i) in photos))
    if (missing.length === 0) return
    ;(async () => {
      const fetched: Record<string, string | null> = {}
      await Promise.all(
        missing.map(async (item) => {
          const k = key(item)
          try {
            const titleAttempts = [item.name, `${item.name} (${item.country})`, `${item.name}, ${item.country}`]
            for (const title of titleAttempts) {
              const res = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
              )
              if (!res.ok) continue
              const body = await res.json()
              const url = body?.originalimage?.source ?? body?.thumbnail?.source ?? null
              if (url) {
                fetched[k] = url
                return
              }
            }
            fetched[k] = null
          } catch {
            fetched[k] = null
          }
        }),
      )
      if (!cancelled) {
        setPhotos((cur) => ({ ...cur, ...fetched }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [items, photos])

  return photos
}

export function JournalCollectionsPage() {
  const navigate = useNavigate()
  const [journals, setJournals] = useState<JournalSummary[] | null>(null)
  const [stats, setStats] = useState<JournalStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<ViewTab>('collections')
  const [pieAxis, setPieAxis] = useState<PieAxis>('subject')
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
    const source: Record<string, number> =
      pieAxis === 'subject' ? stats.subject_distribution
      : pieAxis === 'atmosphere' ? stats.atmosphere_distribution
      : stats.activity_distribution
    return Object.entries(source)
      .filter(([, count]) => count > 0)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [stats, pieAxis])

  const topActivity = useMemo(() => {
    if (!stats) return null
    const entries = Object.entries(stats.activity_distribution)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
    return entries[0] ?? null
  }, [stats])

  const photos = useRecommendationPhotos(recs?.recommendations ?? null)

  if (error) {
    return (
      <div className="journal-collections-shell">
        <p className="field-error">{error}</p>
      </div>
    )
  }

  return (
    <div className="journal-collections-shell journal-collections-shell--with-rail">
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

      <div className="journal-collections-with-rail">
        <main className="journal-collections-main">
          {tab === 'collections' && (
            <>
              {journals === null ? (
                <p className="muted-copy">Loading journals…</p>
              ) : journals.length === 0 ? (
                <div className="gallery-empty">
                  <strong>No saved journals yet</strong>
                  <p>Head to Create Journal to make your first one.</p>
                </div>
              ) : (
                <section className="journal-collections-grid journal-collections-grid--big">
                  {journals.map((j) => (
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
                  ))}
                </section>
              )}
            </>
          )}

          {tab === 'stats' && stats !== null && (
            <div className="journal-stats-big">
              <h3 className="journal-section-heading">Your travel at a glance</h3>
              <div className="journal-stats-big-grid">
                <div className="journal-stat-tile">
                  <Globe size={28} />
                  <strong>{stats.country_count}</strong>
                  <span>countries</span>
                </div>
                <div className="journal-stat-tile">
                  <MapPin size={28} />
                  <strong>{stats.city_count}</strong>
                  <span>cities</span>
                </div>
                <div className="journal-stat-tile">
                  <BookText size={28} />
                  <strong>{stats.photo_count}</strong>
                  <span>photos</span>
                </div>
                <div className="journal-stat-tile">
                  <TrendingUp size={28} />
                  <strong>{stats.total_distance_km.toLocaleString()}</strong>
                  <span>km traveled</span>
                </div>
              </div>

              {topActivity && (
                <div className="journal-stats-dna journal-stats-dna--big">
                  <span className="journal-stats-dna-label">Behavioral DNA · top activity</span>
                  <strong>{humanizeTag(topActivity[0])}</strong>
                  <span className="journal-stats-dna-count">{topActivity[1]} photos</span>
                </div>
              )}
            </div>
          )}

          {tab === 'pie' && (
            <div className="journal-pie-big">
              <h3 className="journal-section-heading">Subject distribution</h3>
              <div className="journal-pie-axis-switch" role="radiogroup" aria-label="Distribution axis">
                {(['subject', 'atmosphere', 'activity'] as const).map((axis) => (
                  <button
                    key={axis}
                    type="button"
                    role="radio"
                    aria-checked={pieAxis === axis}
                    className={`journal-pie-axis-button ${pieAxis === axis ? 'is-active' : ''}`}
                    onClick={() => setPieAxis(axis)}
                  >
                    {axis}
                  </button>
                ))}
              </div>
              <PieChart data={pieData} />
            </div>
          )}

          {tab === 'gpt' && (
            <div className="journal-recs journal-recs--big">
              <h3 className="journal-section-heading">Where you should go next</h3>
              {isLoadingRecs && <p className="muted-copy">Generating ideas based on your travel pattern…</p>}
              {recsError && <p className="field-error">{recsError}</p>}
              {recs && (
                <>
                  {recs.low_data && (
                    <p className="muted-copy">
                      You have few entries so the picks may be tentative — save more journals
                      for sharper suggestions.
                    </p>
                  )}
                  <div className="journal-rec-grid">
                    {recs.recommendations.map((r) => {
                      const photoUrl = photos[`${r.name}|${r.country}`]
                      return (
                        <article key={`${r.name}-${r.country}`} className="journal-rec-big-card">
                          <div className="journal-rec-big-photo">
                            {photoUrl ? (
                              <img src={photoUrl} alt={r.name} />
                            ) : photoUrl === null ? (
                              <div className="journal-rec-big-photo-empty">No preview</div>
                            ) : (
                              <div className="journal-rec-big-photo-loading">Loading…</div>
                            )}
                          </div>
                          <div className="journal-rec-big-body">
                            <h4>{r.name}</h4>
                            <p className="journal-rec-big-country">{r.country}</p>
                            <p className="journal-rec-big-reason">{r.reason}</p>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </main>

        <aside className="journal-rail" aria-label="Journal sections">
          <button
            type="button"
            className={`journal-rail-btn ${tab === 'collections' ? 'is-active' : ''}`}
            onClick={() => setTab('collections')}
            aria-label="Saved journals"
            title="Saved journals"
          >
            <Library size={20} />
          </button>
          <button
            type="button"
            className={`journal-rail-btn ${tab === 'stats' ? 'is-active' : ''}`}
            onClick={() => setTab('stats')}
            aria-label="Stats summary"
            title="Stats summary"
          >
            <TrendingUp size={20} />
          </button>
          <button
            type="button"
            className={`journal-rail-btn ${tab === 'pie' ? 'is-active' : ''}`}
            onClick={() => setTab('pie')}
            aria-label="Subject distribution"
            title="Subject distribution"
          >
            <PieChartIcon size={20} />
          </button>
          <button
            type="button"
            className={`journal-rail-btn ${tab === 'gpt' ? 'is-active' : ''}`}
            onClick={() => setTab('gpt')}
            aria-label="Destination recommendations"
            title="Destination recommendations"
          >
            <Sparkles size={20} />
          </button>
        </aside>
      </div>
    </div>
  )
}
