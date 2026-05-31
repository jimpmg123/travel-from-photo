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
import { absoluteImageUrl } from '../services/galleryApi'

type ViewTab = 'collections' | 'stats' | 'pie' | 'gpt'
type PieAxis = 'subject' | 'atmosphere' | 'activity'

type LevelTier = {
  level: number
  title: string
  min: number
  max: number | null
}

const COUNTRY_LEVELS: LevelTier[] = [
  { level: 1, title: 'Starting traveler', min: 1, max: 1 },
  { level: 2, title: 'Broadening horizons', min: 2, max: 4 },
  { level: 3, title: 'Pro passport holder', min: 5, max: 9 },
  { level: 4, title: 'World is my stage', min: 10, max: 19 },
  { level: 5, title: 'Borderless wanderer', min: 20, max: null },
]

const CITY_LEVELS: LevelTier[] = [
  { level: 1, title: 'First footprints', min: 1, max: 3 },
  { level: 2, title: 'Leaving the block', min: 4, max: 10 },
  { level: 3, title: 'Wanderlust onset', min: 11, max: 25 },
  { level: 4, title: 'No GPS needed', min: 26, max: 50 },
  { level: 5, title: 'Global city collector', min: 51, max: null },
]

const PHOTO_LEVELS: LevelTier[] = [
  { level: 1, title: 'Casual shutter', min: 1, max: 100 },
  { level: 2, title: 'Memory keeper', min: 101, max: 500 },
  { level: 3, title: 'Moment capturer', min: 501, max: 1500 },
  { level: 4, title: 'Story archiver', min: 1501, max: 4000 },
  { level: 5, title: 'Visual big data', min: 4001, max: null },
]

const DISTANCE_LEVELS: LevelTier[] = [
  { level: 1, title: 'Nearby getaway', min: 1, max: 1000 },
  { level: 2, title: 'Crossed a border', min: 1001, max: 5000 },
  { level: 3, title: 'Continent crosser', min: 5001, max: 15000 },
  { level: 4, title: 'Around the Earth', min: 15001, max: 40000 },
  { level: 5, title: 'Mileage astronaut', min: 40001, max: null },
]

function resolveLevel(value: number, tiers: LevelTier[]): { tier: LevelTier; nextTier: LevelTier | null; progress: number } {
  const safeValue = Math.max(0, value)
  const tier =
    tiers.find((t) => safeValue >= t.min && (t.max === null || safeValue <= t.max)) ?? tiers[0]
  const nextTier = tiers.find((t) => t.level === tier.level + 1) ?? null
  let progress = 0
  if (tier.max !== null) {
    const range = tier.max - tier.min + 1
    progress = Math.min(1, Math.max(0, (safeValue - tier.min + 1) / range))
  } else {
    progress = 1
  }
  return { tier, nextTier, progress }
}

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

function LevelBar({
  icon,
  metricLabel,
  value,
  unit,
  tiers,
}: {
  icon: React.ReactNode
  metricLabel: string
  value: number
  unit: string
  tiers: LevelTier[]
}) {
  const { tier, nextTier, progress } = resolveLevel(value, tiers)
  const formattedValue = value.toLocaleString()
  const nextThreshold = nextTier ? nextTier.min.toLocaleString() : null

  return (
    <article className="level-bar">
      <header className="level-bar-head">
        <span className="level-bar-icon">{icon}</span>
        <div className="level-bar-titles">
          <p className="level-bar-metric">{metricLabel}</p>
          <p className="level-bar-tier-title">{tier.title}</p>
        </div>
        <span className={`level-bar-badge level-bar-badge--${tier.level}`}>Lv {tier.level}</span>
      </header>

      <div className="level-bar-value-row">
        <strong className="level-bar-value">{formattedValue}</strong>
        <span className="level-bar-unit">{unit}</span>
      </div>

      <div className="level-bar-segments" role="presentation">
        {tiers.map((t) => {
          const reached = value >= t.min
          return (
            <span
              key={t.level}
              className={`level-bar-segment${reached ? ' is-reached' : ''}${t.level === tier.level ? ' is-current' : ''}`}
              style={t.level === tier.level && t.max !== null ? { '--seg-fill': `${progress * 100}%` } as React.CSSProperties : undefined}
            />
          )
        })}
      </div>

      <p className="level-bar-next">
        {nextThreshold
          ? `${(Math.max(0, nextTier!.min - value)).toLocaleString()} ${unit} to Lv ${nextTier!.level}`
          : 'Max level reached'}
      </p>
    </article>
  )
}

async function tryWikipediaThumb(title: string): Promise<string | null> {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
    if (!res.ok) return null
    const body = await res.json()
    return body?.originalimage?.source ?? body?.thumbnail?.source ?? null
  } catch {
    return null
  }
}

async function tryWikipediaSearch(query: string): Promise<string | null> {
  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=1&origin=*&srsearch=${encodeURIComponent(query)}`,
    )
    if (!searchRes.ok) return null
    const searchBody = await searchRes.json()
    const firstTitle: string | undefined = searchBody?.query?.search?.[0]?.title
    if (!firstTitle) return null
    return tryWikipediaThumb(firstTitle)
  } catch {
    return null
  }
}

async function findRepresentativePhoto(name: string, country: string): Promise<string | null> {
  const attempts = [
    name,
    `${name} (${country})`,
    `${name}, ${country}`,
    `${name} city`,
  ]
  for (const a of attempts) {
    const url = await tryWikipediaThumb(a)
    if (url) return url
  }
  const searchUrl = await tryWikipediaSearch(`${name} ${country}`)
  if (searchUrl) return searchUrl
  return null
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
          const url = await findRepresentativePhoto(item.name, item.country)
          fetched[k] = url
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
                      {j.cover_image_url ? (
                        <img
                          className="journal-collection-card-cover"
                          src={absoluteImageUrl(j.cover_image_url) ?? undefined}
                          alt={j.title ?? 'Journal cover'}
                          loading="lazy"
                        />
                      ) : (
                        <div className="journal-collection-card-strip" />
                      )}
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
              <h3 className="journal-section-heading">Your traveler levels</h3>
              <div className="level-bar-grid">
                <LevelBar
                  icon={<Globe size={22} />}
                  metricLabel="Countries"
                  value={stats.country_count}
                  unit="countries"
                  tiers={COUNTRY_LEVELS}
                />
                <LevelBar
                  icon={<MapPin size={22} />}
                  metricLabel="Cities"
                  value={stats.city_count}
                  unit="cities"
                  tiers={CITY_LEVELS}
                />
                <LevelBar
                  icon={<BookText size={22} />}
                  metricLabel="Photos"
                  value={stats.photo_count}
                  unit="photos"
                  tiers={PHOTO_LEVELS}
                />
                <LevelBar
                  icon={<TrendingUp size={22} />}
                  metricLabel="Total distance"
                  value={Math.round(stats.total_distance_km)}
                  unit="km"
                  tiers={DISTANCE_LEVELS}
                />
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
                              <div className="journal-rec-big-photo-fallback">
                                <span className="journal-rec-big-photo-fallback-name">{r.name}</span>
                                <span className="journal-rec-big-photo-fallback-country">{r.country}</span>
                              </div>
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
