/**
 * Read-only view of a saved Journal. Reuses much of the visual language of
 * JournalResultPage (header date + title, entry list with photo + tags +
 * text) but everything is non-editable here — Save/Discard are gone, and a
 * "View on map" button surfaces the entries on a Leaflet map (in a modal,
 * matching the pattern used by CollectionMapModal in the gallery).
 *
 * Entries are rendered in entry_order, which the backend already sets to the
 * captured_at timeline order.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'

import { getJournalDetail, type JournalDetail, type JournalEntry } from '../services/journalApi'

const formatHeaderDate = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()} Journal`
}

const collectTags = (entry: JournalEntry): string[] => {
  // v3: clip_* are multi-label arrays. Same shortlisting strategy as the
  // result page so saved/draft views feel consistent.
  const tags: string[] = []
  for (const t of (entry.clip_subject ?? []).slice(0, 2)) tags.push(t)
  for (const t of (entry.clip_activity ?? []).slice(0, 2)) tags.push(t)
  for (const t of (entry.clip_atmosphere ?? []).slice(0, 2)) tags.push(t)
  if (entry.gpt_time_of_day) tags.push(entry.gpt_time_of_day)
  if (entry.gpt_cultural_layer) tags.push(entry.gpt_cultural_layer)
  return tags
}

// Numbered pin in the same visual idiom as CollectionMapModal — keeps the
// map UI consistent between gallery and journal contexts.
const numberedPin = (n: number) =>
  L.divIcon({
    className: 'journal-map-pin',
    html: `
      <div style="
        width: 30px; height: 30px;
        border-radius: 999px;
        background: #ffffff;
        border: 2px solid #2d6a5f;
        color: #2d6a5f;
        display: grid; place-items: center;
        font-weight: 700; font-size: 12px;
        box-shadow: 0 6px 16px rgba(0,0,0,0.18);
      ">${n}</div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })

export function JournalDetailPage() {
  const navigate = useNavigate()
  const { journalId } = useParams<{ journalId: string }>()
  const [detail, setDetail] = useState<JournalDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)

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

  const headerDate = useMemo(() => {
    if (!detail?.entries.length) return null
    const first = [...detail.entries]
      .filter((e) => e.captured_at)
      .sort((a, b) => (a.captured_at ?? '').localeCompare(b.captured_at ?? ''))[0]
    return formatHeaderDate(first?.captured_at ?? null)
  }, [detail])

  const geotagged = useMemo(() => {
    if (!detail) return []
    return detail.entries
      .filter((e): e is JournalEntry & { latitude: number; longitude: number } =>
        typeof e.latitude === 'number' && typeof e.longitude === 'number',
      )
      .sort((a, b) => a.entry_order - b.entry_order)
  }, [detail])

  const mapBounds = useMemo(() => {
    if (geotagged.length === 0) return null
    return L.latLngBounds(geotagged.map((e) => [e.latitude, e.longitude]))
  }, [geotagged])

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
    <div className="journal-result-shell">
      <header className="journal-result-header">
        <button
          type="button"
          className="journal-picker-back"
          onClick={() => navigate('/journal/collections')}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <div className="journal-result-titles">
          <span className="journal-result-date">{headerDate}</span>
          <span className="journal-result-title-button" style={{ cursor: 'default' }}>
            <span>{detail.title?.trim() || 'Untitled Journal'}</span>
          </span>
        </div>

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
      </header>

      <section className="journal-result-entries">
        {detail.entries.map((entry) => {
          const tags = collectTags(entry)
          return (
            <article key={entry.id} className="journal-result-entry">
              <div className="journal-result-photo photo-frame photo-frame--coast" />

              <div className="journal-result-content">
                <div className="journal-result-location">
                  <MapPin size={14} />
                  <span>
                    {[entry.place_name, entry.city, entry.country].filter(Boolean).join(' · ') || 'Unknown place'}
                  </span>
                </div>

                {tags.length > 0 && (
                  <div className="journal-result-tags">
                    {tags.map((tag) => (
                      <span key={tag} className="journal-result-tag">{tag.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                )}

                <p className="journal-result-text" style={{ cursor: 'default' }}>
                  {entry.journal_text || <em>No note recorded.</em>}
                </p>
              </div>
            </article>
          )
        })}
      </section>

      {showMap && (
        <div className="collection-map-overlay" onClick={() => setShowMap(false)}>
          <div className="collection-map-modal" onClick={(e) => e.stopPropagation()}>
            <header className="collection-map-header">
              <div>
                <h3>{detail.title?.trim() || 'Journal'}</h3>
                <p>
                  {geotagged.length} on map
                  {detail.entries.length - geotagged.length > 0 &&
                    ` · ${detail.entries.length - geotagged.length} without GPS`}
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
                    ? { bounds: mapBounds, boundsOptions: { padding: [32, 32] } }
                    : { center: [geotagged[0].latitude, geotagged[0].longitude], zoom: 13 })}
                  scrollWheelZoom={true}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {geotagged.map((entry, idx) => (
                    <Marker
                      key={entry.id}
                      position={[entry.latitude, entry.longitude]}
                      icon={numberedPin(idx + 1)}
                    >
                      <Popup>
                        <strong>{entry.place_name || entry.city || 'Spot ' + (idx + 1)}</strong>
                        <br />
                        {entry.journal_text && (
                          <span style={{ color: '#475569', fontSize: '0.85em' }}>{entry.journal_text}</span>
                        )}
                      </Popup>
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
