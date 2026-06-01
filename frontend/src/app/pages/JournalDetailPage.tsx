import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Pencil, Trash2 } from 'lucide-react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet'

import { discardJournal, editJournal, getJournalDetail, type JournalDetail, type JournalEntry } from '../services/journalApi'
import { humanizeTag } from '../utils/tags'
import { absoluteImageUrl } from '../services/galleryApi'

const formatHeaderDate = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()} Journal`
}

const collectTags = (entry: JournalEntry): string[] => {
  const tags: string[] = []
  for (const t of (entry.clip_subject ?? []).slice(0, 2)) tags.push(t)
  for (const t of (entry.clip_activity ?? []).slice(0, 2)) tags.push(t)
  for (const t of (entry.clip_atmosphere ?? []).slice(0, 2)) tags.push(t)
  if (entry.gpt_time_of_day) tags.push(entry.gpt_time_of_day)
  if (entry.gpt_cultural_layer) tags.push(entry.gpt_cultural_layer)
  return tags
}

const numberedPin = (n: number) =>
  L.divIcon({
    className: 'journal-map-pin',
    html: `
      <div style="
        width: 32px; height: 32px;
        border-radius: 999px;
        background: #ffffff;
        border: 2px solid #2d6a5f;
        color: #2d6a5f;
        display: grid; place-items: center;
        font-weight: 700; font-size: 13px;
        box-shadow: 0 6px 16px rgba(0,0,0,0.18);
      ">${n}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })

export function JournalDetailPage() {
  const navigate = useNavigate()
  const { journalId } = useParams<{ journalId: string }>()
  const [detail, setDetail] = useState<JournalDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [currentEntry, setCurrentEntry] = useState(0)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteJournal = async () => {
    if (!detail) return
    const title = detail.title?.trim() || 'Untitled Journal'
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await discardJournal(detail.id)
      navigate('/journal/collections', { replace: true })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete journal')
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (!journalId) return
    let cancelled = false
    getJournalDetail(Number(journalId))
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load journal.')
      })
    return () => {
      cancelled = true
    }
  }, [journalId])

  const entries = detail?.entries ?? []
  const totalEntries = entries.length
  const entry = entries[currentEntry] ?? null
  const headerDate = useMemo(
    () => (entry?.captured_at ? formatHeaderDate(entry.captured_at) : detail?.title ?? ''),
    [entry, detail],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showMap) return
      if (editingTitle) return
      if (e.key === 'ArrowLeft' && currentEntry > 0) setCurrentEntry((i) => i - 1)
      if (e.key === 'ArrowRight' && currentEntry < totalEntries - 1) setCurrentEntry((i) => i + 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentEntry, totalEntries, showMap, editingTitle])

  const geotagged = useMemo(() => {
    return entries
      .filter(
        (e): e is JournalEntry & { latitude: number; longitude: number } =>
          typeof e.latitude === 'number' && typeof e.longitude === 'number',
      )
      .sort((a, b) => a.entry_order - b.entry_order)
  }, [entries])

  const mapBounds = useMemo(() => {
    if (geotagged.length === 0) return null
    return L.latLngBounds(geotagged.map((e) => [e.latitude, e.longitude]))
  }, [geotagged])

  const commitTitle = async () => {
    if (!detail) return
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === detail.title) {
      setEditingTitle(false)
      return
    }
    setSavingTitle(true)
    try {
      const updated = await editJournal(detail.id, { title: trimmed })
      setDetail(updated)
      setEditingTitle(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to rename journal')
    } finally {
      setSavingTitle(false)
    }
  }

  if (error) {
    return (
      <div className="journal-result-shell">
        <p className="field-error">{error}</p>
        <button type="button" className="button-secondary" onClick={() => navigate('/journal/collections')}>
          Back to Collections
        </button>
      </div>
    )
  }

  if (detail === null) {
    return (
      <div className="journal-result-shell">
        <p className="muted-copy">Loading journal…</p>
      </div>
    )
  }

  return (
    <div className="journal-diary-shell">
      <header className="journal-diary-header">
        <button
          type="button"
          className="journal-picker-back"
          onClick={() => navigate('/journal/collections')}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <div className="journal-diary-titles">
          <span className="journal-diary-date">{headerDate}</span>
          {editingTitle ? (
            <input
              type="text"
              className="journal-diary-title-input"
              value={titleDraft}
              autoFocus
              disabled={savingTitle}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => void commitTitle()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitTitle()
                if (e.key === 'Escape') setEditingTitle(false)
              }}
            />
          ) : (
            <h2 className="journal-diary-title">
              <span>{detail.title?.trim() || 'Untitled Journal'}</span>
              <button
                type="button"
                className="journal-diary-title-edit"
                onClick={() => {
                  setTitleDraft(detail.title ?? '')
                  setEditingTitle(true)
                }}
                aria-label="Rename journal"
              >
                <Pencil size={14} />
              </button>
            </h2>
          )}
        </div>

        <div className="journal-diary-header-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={() => setShowMap(true)}
            disabled={geotagged.length === 0}
            title={geotagged.length === 0 ? 'No GPS coordinates to map' : 'View on map'}
          >
            <MapPin size={14} />
            <span>View on map</span>
          </button>
          <button
            type="button"
            className="button-secondary collection-delete-btn"
            onClick={() => void handleDeleteJournal()}
            disabled={deleting}
            title="Delete this journal"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      </header>

      {totalEntries === 0 ? (
        <div className="journal-empty">
          <p>This journal has no entries.</p>
        </div>
      ) : (
        <section className="journal-diary-stage">
          <button
            type="button"
            className="journal-diary-arrow journal-diary-arrow--left"
            onClick={() => setCurrentEntry((i) => Math.max(0, i - 1))}
            disabled={currentEntry === 0}
            aria-label="Previous entry"
          >
            ‹
          </button>

          <DiaryCard entry={entry!} index={currentEntry} total={totalEntries} />

          <button
            type="button"
            className="journal-diary-arrow journal-diary-arrow--right"
            onClick={() => setCurrentEntry((i) => Math.min(totalEntries - 1, i + 1))}
            disabled={currentEntry === totalEntries - 1}
            aria-label="Next entry"
          >
            ›
          </button>
        </section>
      )}

      {totalEntries > 1 ? (
        <div className="journal-diary-dots">
          {entries.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`journal-diary-dot${idx === currentEntry ? ' is-active' : ''}`}
              onClick={() => setCurrentEntry(idx)}
              aria-label={`Go to entry ${idx + 1}`}
            />
          ))}
        </div>
      ) : null}

      {showMap && (
        <div className="collection-map-overlay" onClick={() => setShowMap(false)}>
          <div className="collection-map-modal" onClick={(e) => e.stopPropagation()}>
            <header className="collection-map-header">
              <div>
                <h3>Journal route map</h3>
                <p>
                  {geotagged.length} stops
                  {entries.length - geotagged.length > 0 &&
                    ` · ${entries.length - geotagged.length} without GPS`}
                </p>
              </div>
              <button
                type="button"
                className="collection-map-close"
                onClick={() => setShowMap(false)}
                aria-label="Close map"
              >
                ×
              </button>
            </header>

            <div className="collection-map-body">
              {geotagged.length === 0 ? (
                <div className="collection-map-empty">
                  <strong>No GPS data</strong>
                  <p>This journal has no entries with location coordinates.</p>
                </div>
              ) : (
                <MapContainer
                  {...(mapBounds
                    ? { bounds: mapBounds, boundsOptions: { padding: [40, 40] } }
                    : { center: [geotagged[0].latitude, geotagged[0].longitude], zoom: 13 })}
                  scrollWheelZoom={true}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {geotagged.length >= 2 ? (
                    <Polyline
                      positions={geotagged.map((e) => [e.latitude, e.longitude])}
                      pathOptions={{
                        color: '#2d6a5f',
                        weight: 3,
                        opacity: 0.9,
                        dashArray: '6 8',
                      }}
                    />
                  ) : null}
                  {geotagged.map((e, idx) => (
                    <Marker
                      key={e.id}
                      position={[e.latitude, e.longitude]}
                      icon={numberedPin(idx + 1)}
                    >
                      <Tooltip direction="top" offset={[0, -16]} opacity={1} permanent={false}>
                        <div className="journal-map-tooltip">
                          <strong>{idx + 1}. {e.place_name || e.city || `Stop ${idx + 1}`}</strong>
                          {[e.city, e.country].filter(Boolean).length > 0 ? (
                            <p>{[e.city, e.country].filter(Boolean).join(', ')}</p>
                          ) : null}
                          {e.journal_text ? <em>{e.journal_text.slice(0, 80)}{e.journal_text.length > 80 ? '…' : ''}</em> : null}
                        </div>
                      </Tooltip>
                    </Marker>
                  ))}
                </MapContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DiaryCard({ entry, index, total }: { entry: JournalEntry; index: number; total: number }) {
  const tags = collectTags(entry)
  const location = [entry.place_name, entry.city, entry.country].filter(Boolean).join(' · ') || 'Unknown place'

  return (
    <article className="journal-diary-card">
      <header className="journal-diary-card-top">
        <span className="journal-diary-card-counter">{index + 1} / {total}</span>
        <span className="journal-diary-card-location">
          <MapPin size={13} />
          {location}
        </span>
      </header>

      <div className="journal-diary-card-body">
        {entry.image_url ? (
          <img
            className="journal-diary-card-photo"
            src={absoluteImageUrl(entry.image_url) ?? undefined}
            alt={`Photo ${index + 1}`}
            loading="lazy"
          />
        ) : (
          <div className="journal-diary-card-photo photo-frame photo-frame--coast" />
        )}

        <div className="journal-diary-card-text">
          {tags.length > 0 && (
            <div className="journal-result-tags">
              {tags.map((tag) => (
                <span key={tag} className="journal-result-tag">{humanizeTag(tag)}</span>
              ))}
            </div>
          )}
          <p className="journal-diary-card-narrative">
            {entry.journal_text || <em>No note recorded for this stop.</em>}
          </p>
        </div>
      </div>
    </article>
  )
}
