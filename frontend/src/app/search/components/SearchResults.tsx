import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { createSavedPlace, fetchCollections } from '../../services/galleryApi'
import type { Candidate, SearchImageResult, SearchResultBundle } from '../types'
import { EditableMatchMap } from './EditableMatchMap'

type TopMatchEdit = {
  placeName?: string
  latitude?: number
  longitude?: number
}

type SearchResultsProps = {
  bundle: SearchResultBundle
  isLoggedIn: boolean
  onRetryFailedImage: (uploadId: string, userHint: string) => Promise<void>
}

const VERDICT_LABEL: Record<string, string> = {
  confident: 'Confident',
  likely: 'Likely',
  suggestions: 'Suggestions',
  failed: 'Could not identify',
}

const SOURCE_TAG_LABEL: Record<string, string> = {
  exif_gps: 'GPS verified',
  vision_landmark: 'Landmark',
  vision_logo: 'Logo',
  vision_web: 'Web search',
  vision_ocr: 'OCR',
  gpt4o_main: 'AI vision',
}

function toPercent(score: number | null | undefined): number {
  if (score == null) return 0
  return Math.round(Math.max(0, Math.min(score, 1)) * 100)
}

function locationLine(c: Candidate): string {
  return [c.city, c.country].filter(Boolean).join(', ') || 'Location unknown'
}

function mapEmbedUrl(c: Candidate, zoom = 15): string | null {
  if (c.latitude != null && c.longitude != null) {
    return `https://maps.google.com/maps?q=${c.latitude},${c.longitude}&z=${zoom}&output=embed`
  }
  if (c.formatted_address) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(c.formatted_address)}&z=${zoom - 1}&output=embed`
  }
  return null
}

function deriveTags(candidate: Candidate): string[] {
  const out: string[] = []
  if (candidate.city) out.push(candidate.city)
  if (candidate.country) out.push(candidate.country)
  const priority = ['exif_gps', 'vision_landmark', 'vision_logo', 'gpt4o_main', 'vision_web', 'vision_ocr']
  for (const src of priority) {
    if (candidate.contributing_sources?.includes(src) && SOURCE_TAG_LABEL[src]) {
      out.push(SOURCE_TAG_LABEL[src])
      break
    }
  }
  return out
}

async function fetchPreviewAsBlob(previewUrl: string): Promise<Blob> {
  const res = await fetch(previewUrl)
  return res.blob()
}

function MapPinIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  const path = direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

function SaveDialog({
  open,
  candidate,
  previewUrl,
  imageName,
  collections,
  saving,
  onClose,
  onConfirm,
}: {
  open: boolean
  candidate: Candidate | null
  previewUrl: string
  imageName: string
  collections: string[]
  saving: boolean
  onClose: () => void
  onConfirm: (collectionName: string) => Promise<void> | void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<string>('My Gallery')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (open) {
      const suggestedCity = candidate?.city?.trim() || null
      if (suggestedCity && collections.includes(suggestedCity)) {
        setSelected(suggestedCity)
        setCreating(false)
        setNewName('')
      } else if (suggestedCity) {
        setCreating(true)
        setNewName(suggestedCity)
        setSelected(collections[0] ?? 'My Gallery')
      } else {
        setSelected(collections[0] ?? 'My Gallery')
        setCreating(false)
        setNewName('')
      }
    }
  }, [open, collections, candidate])

  if (!candidate) return null

  const handleConfirm = async () => {
    const target = creating ? newName.trim() : selected
    if (!target) return
    await onConfirm(target)
  }

  return (
    <dialog
      ref={ref}
      className="save-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="save-dialog-body">
        <header className="save-dialog-header">
          <h3>Save to Gallery</h3>
          <button type="button" className="search-modal-close" onClick={onClose}>×</button>
        </header>
        <div className="save-dialog-preview">
          <img src={previewUrl} alt={imageName} />
          <div>
            <strong>{candidate.place_name ?? 'Unnamed location'}</strong>
            <p>{locationLine(candidate)}</p>
          </div>
        </div>

        <div className="save-dialog-section">
          <p className="save-dialog-label">Collection</p>
          {!creating ? (
            <>
              {collections.length > 0 ? (
                <div className="save-dialog-collections">
                  {collections.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={`save-dialog-collection-pill${selected === name ? ' is-selected' : ''}`}
                      onClick={() => setSelected(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="save-dialog-empty">No collections yet — defaults to "My Gallery".</p>
              )}
              <button type="button" className="save-dialog-new-link" onClick={() => setCreating(true)}>
                + New collection
              </button>
            </>
          ) : (
            <div className="save-dialog-new-row">
              <input
                type="text"
                autoFocus
                placeholder="e.g. Jeju 2024"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button type="button" className="button-secondary" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          )}
        </div>

        <div className="save-dialog-actions">
          <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            type="button"
            className="button-primary"
            disabled={saving || (creating && !newName.trim())}
            onClick={() => void handleConfirm()}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </dialog>
  )
}

function CandidateModal({
  candidate,
  imagePreviewUrl,
  imageName,
  open,
  onClose,
  onSave,
}: {
  candidate: Candidate | null
  imagePreviewUrl: string
  imageName: string
  open: boolean
  onClose: () => void
  onSave: (c: Candidate) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  if (!candidate) return null
  const mapUrl = mapEmbedUrl(candidate, 16)
  const tags = deriveTags(candidate)

  return (
    <dialog
      ref={ref}
      className="search-modal"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <button type="button" className="search-modal-close" onClick={onClose} aria-label="Close">×</button>
      <div className="search-modal-body">
        <div className="search-modal-map">
          {mapUrl ? (
            <iframe src={mapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={candidate.place_name ?? 'Map'} allowFullScreen />
          ) : (
            <div className="match-map-placeholder">No coordinates available.</div>
          )}
        </div>
        <div className="search-modal-info">
          <div>
            <h3>{candidate.place_name ?? candidate.formatted_address ?? 'Unnamed location'}</h3>
            <p className="match-location" style={{ marginTop: 4 }}>
              <MapPinIcon /> {locationLine(candidate)}
            </p>
          </div>
          <div className="match-info-head" style={{ alignItems: 'center' }}>
            <div className="match-info-text">
              {candidate.formatted_address ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
                  {candidate.formatted_address}
                </p>
              ) : null}
            </div>
            <div className="match-score">
              <div className="match-score-value">{toPercent(candidate.aggregated_score)}%</div>
              <div className="match-score-label">match</div>
            </div>
          </div>
          {tags.length > 0 ? (
            <div className="match-tags">
              {tags.map((tag) => (
                <span key={tag} className="tag-chip">#{tag}</span>
              ))}
            </div>
          ) : null}
          <div className="search-modal-photo">
            <img src={imagePreviewUrl} alt={imageName} />
          </div>
          <div className="search-modal-actions">
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                onSave(candidate)
                onClose()
              }}
            >
              Save this place
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}

function ImageResultBlock({
  result,
  index,
  total,
  retryHint,
  retryDisabled,
  showResearchPanel,
  edit,
  onChangeEdit,
  onToggleResearchPanel,
  onChangeRetryHint,
  onRetry,
  onSaveCandidate,
  onOpenAlternate,
}: {
  result: SearchImageResult
  index: number
  total: number
  retryHint: string
  retryDisabled: boolean
  showResearchPanel: boolean
  edit: TopMatchEdit
  onChangeEdit: (patch: TopMatchEdit) => void
  onToggleResearchPanel: () => void
  onChangeRetryHint: (value: string) => void
  onRetry: () => void
  onSaveCandidate: (candidate: Candidate) => void
  onOpenAlternate: (candidate: Candidate) => void
}) {
  const candidates = result.candidates ?? []
  const top = candidates[0] ?? null
  const alternates = candidates.slice(1, 4)
  const verdict = result.verdict ?? 'failed'
  const isConfident = verdict === 'confident'

  const effectiveTop: Candidate | null = top
    ? {
        ...top,
        place_name: edit.placeName ?? top.place_name,
        latitude: edit.latitude ?? top.latitude,
        longitude: edit.longitude ?? top.longitude,
      }
    : null
  const tags = effectiveTop ? deriveTags(effectiveTop) : []
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [isMapEditable, setIsMapEditable] = useState(false)

  const startNameEdit = () => {
    setNameDraft(effectiveTop?.place_name ?? effectiveTop?.formatted_address ?? '')
    setIsEditingName(true)
  }
  const commitNameEdit = () => {
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== effectiveTop?.place_name) {
      onChangeEdit({ placeName: trimmed })
    }
    setIsEditingName(false)
  }
  const cancelNameEdit = () => {
    setIsEditingName(false)
  }

  return (
    <article className="search-image-block">
      <header className="search-image-block-header">
        <div className="image-meta">
          <span className="image-position">
            Image {index + 1}{total > 1 ? ` / ${total}` : ''}
          </span>
          <span className="image-name">{result.imageName}</span>
        </div>
        <span className={`verdict-pill verdict-pill--${verdict}`}>
          {VERDICT_LABEL[verdict] ?? verdict}
        </span>
      </header>

      {effectiveTop ? (
        <>
          <div className="top-match-card">
            <div className="match-map">
              <EditableMatchMap
                latitude={effectiveTop.latitude ?? null}
                longitude={effectiveTop.longitude ?? null}
                placeName={effectiveTop.place_name ?? null}
                editable={isMapEditable}
                onPick={(lat, lng, suggested) => {
                  const patch: TopMatchEdit = { latitude: lat, longitude: lng }
                  if (suggested?.placeName) patch.placeName = suggested.placeName
                  onChangeEdit(patch)
                }}
              />
              <button
                type="button"
                className={`match-map-edit-toggle${isMapEditable ? ' is-active' : ''}`}
                onClick={() => setIsMapEditable((v) => !v)}
              >
                {isMapEditable ? 'Done' : 'Pick on map'}
              </button>
            </div>

            <div className="match-right">
              <div className="match-photo">
                <img src={result.previewUrl} alt={result.imageName} />
              </div>

              <div className="match-info">
                <div className="match-info-head">
                  <div className="match-info-text">
                    {isEditingName ? (
                      <input
                        type="text"
                        className="match-name-input"
                        value={nameDraft}
                        autoFocus
                        onChange={(e) => setNameDraft(e.target.value)}
                        onBlur={commitNameEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitNameEdit()
                          if (e.key === 'Escape') cancelNameEdit()
                        }}
                      />
                    ) : (
                      <h3 className="match-name">
                        <span>{effectiveTop.place_name ?? effectiveTop.formatted_address ?? 'Unnamed location'}</span>
                        <button
                          type="button"
                          className="match-name-edit-btn"
                          onClick={startNameEdit}
                          aria-label="Edit place name"
                        >
                          ✎
                        </button>
                      </h3>
                    )}
                    <p className="match-location">
                      <MapPinIcon />
                      {locationLine(effectiveTop)}
                    </p>
                    {(edit.placeName !== undefined || edit.latitude !== undefined) ? (
                      <p className="match-edit-note">Edited — your changes will be saved with this place.</p>
                    ) : null}
                  </div>
                  <div className="match-score">
                    <div className="match-score-value">{toPercent(effectiveTop.aggregated_score)}%</div>
                    <div className="match-score-label">match</div>
                  </div>
                </div>

                {tags.length > 0 ? (
                  <div className="match-tags">
                    {tags.map((tag) => (
                      <span key={tag} className="tag-chip">#{tag}</span>
                    ))}
                  </div>
                ) : null}

                <div className="match-actions">
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => onSaveCandidate(effectiveTop)}
                  >
                    Save to Gallery
                  </button>
                </div>
              </div>
            </div>
          </div>

          {alternates.length > 0 ? (
            <div className="alternates-section">
              <h4 className="alternates-section-heading">Other matches</h4>
              <div className="alternates-grid">
                {alternates.map((alt) => {
                  const altMap = mapEmbedUrl(alt, 14)
                  return (
                    <button
                      key={alt.rank}
                      type="button"
                      className="alternate-card"
                      onClick={() => onOpenAlternate(alt)}
                    >
                      <div className="alternate-card-map">
                        {altMap ? (
                          <iframe src={altMap} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={alt.place_name ?? 'Map'} />
                        ) : (
                          <div className="alternate-card-map-placeholder">No map</div>
                        )}
                      </div>
                      <div className="alternate-card-body">
                        <div className="alternate-card-head">
                          <p className="alternate-card-name">
                            {alt.place_name ?? alt.formatted_address ?? 'Unnamed'}
                          </p>
                          <span className="alternate-card-score">{toPercent(alt.aggregated_score)}%</span>
                        </div>
                        <p className="alternate-card-location">{locationLine(alt)}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {!isConfident && !showResearchPanel ? (
            <div className="research-bar">
              <p>Not confident this is right? Add a hint and re-search this photo.</p>
              <button type="button" className="button-secondary" onClick={onToggleResearchPanel}>
                Re-search this photo
              </button>
            </div>
          ) : null}

          {showResearchPanel ? (
            <div className="research-panel">
              <p className="research-panel-label">Add a hint (any language)</p>
              <input
                type="text"
                value={retryHint}
                onChange={(e) => onChangeRetryHint(e.target.value)}
                placeholder="e.g. 제주 협재 해수욕장, ramen district near Shibuya, ..."
                autoFocus
              />
              <div className="research-panel-actions">
                <button type="button" className="button-secondary" onClick={onToggleResearchPanel}>Cancel</button>
                <button
                  type="button"
                  className="button-primary"
                  disabled={!retryHint.trim() || retryDisabled}
                  onClick={onRetry}
                >
                  {retryDisabled ? 'Re-searching...' : 'Re-search with hint'}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="no-candidates-state">
            <strong>No location identified</strong>
            <p>{result.summary ?? 'Add a hint and retry to refine the search.'}</p>
          </div>
          {!showResearchPanel ? (
            <div className="research-bar">
              <p>Give it a hint and we'll re-run.</p>
              <button type="button" className="button-secondary" onClick={onToggleResearchPanel}>
                Re-search this photo
              </button>
            </div>
          ) : (
            <div className="research-panel">
              <p className="research-panel-label">Add a hint (any language)</p>
              <input
                type="text"
                value={retryHint}
                onChange={(e) => onChangeRetryHint(e.target.value)}
                placeholder="e.g. 제주 협재, ramen district, ..."
                autoFocus
              />
              <div className="research-panel-actions">
                <button type="button" className="button-secondary" onClick={onToggleResearchPanel}>Cancel</button>
                <button
                  type="button"
                  className="button-primary"
                  disabled={!retryHint.trim() || retryDisabled}
                  onClick={onRetry}
                >
                  {retryDisabled ? 'Re-searching...' : 'Re-search with hint'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </article>
  )
}

export function SearchResults({
  bundle,
  isLoggedIn,
  onRetryFailedImage,
}: SearchResultsProps) {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [retryHints, setRetryHints] = useState<Record<string, string>>({})
  const [openResearchFor, setOpenResearchFor] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [modalCandidate, setModalCandidate] = useState<Candidate | null>(null)
  const [topEdits, setTopEdits] = useState<Record<string, TopMatchEdit>>({})
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const [collections, setCollections] = useState<string[]>([])
  const [saveDialogState, setSaveDialogState] = useState<{
    candidate: Candidate
    result: SearchImageResult
  } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchCollections()
      .then((cols) => {
        if (cancelled) return
        setCollections(cols.map((c) => c.name))
      })
      .catch(() => {
        // unauthorized or backend down — leave empty, dialog will allow new name
      })
    return () => {
      cancelled = true
    }
  }, [])

  const total = bundle.results.length
  const safeIndex = Math.min(currentIndex, Math.max(total - 1, 0))
  const current = bundle.results[safeIndex] ?? null

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400)
  }

  const handleRetry = async (uploadId: string) => {
    const hint = retryHints[uploadId]?.trim()
    if (!hint) return
    setRetryingId(uploadId)
    try {
      await onRetryFailedImage(uploadId, hint)
      setOpenResearchFor(null)
      setRetryHints((current) => ({ ...current, [uploadId]: '' }))
    } finally {
      setRetryingId(null)
    }
  }

  const handleSaveCandidate = (candidate: Candidate, result: SearchImageResult) => {
    setSaveDialogState({ candidate, result })
  }

  const [savingAll, setSavingAll] = useState(false)

  const handleSaveAll = async () => {
    const targets: { candidate: Candidate; result: SearchImageResult; collection: string }[] = []
    for (const result of bundle.results) {
      const cands = result.candidates ?? []
      const top = cands[0]
      if (!top) continue
      const collection = (top.city?.trim() || top.country?.trim() || 'My Gallery').slice(0, 120)
      targets.push({ candidate: top, result, collection })
    }
    if (targets.length === 0) {
      showToast('No results to save')
      return
    }
    setSavingAll(true)
    let savedCount = 0
    const newCollections = new Set(collections)
    for (const { candidate, result, collection } of targets) {
      try {
        const blob = await fetchPreviewAsBlob(result.previewUrl)
        await createSavedPlace({
          imageBlob: blob,
          imageName: result.imageName,
          placeName: candidate.place_name ?? candidate.formatted_address ?? 'Unnamed place',
          collectionName: collection,
          formattedAddress: candidate.formatted_address ?? null,
          country: candidate.country ?? null,
          city: candidate.city ?? null,
          latitude: candidate.latitude ?? null,
          longitude: candidate.longitude ?? null,
        })
        savedCount += 1
        newCollections.add(collection)
      } catch {
        // continue with remaining
      }
    }
    setCollections(Array.from(newCollections))
    setSavingAll(false)
    showToast(
      savedCount === targets.length
        ? `Saved all ${savedCount} places, grouped by city`
        : `Saved ${savedCount} of ${targets.length} places`,
    )
  }

  const handleConfirmSave = async (collectionName: string) => {
    if (!saveDialogState) return
    const { candidate, result } = saveDialogState
    setSaving(true)
    try {
      const blob = await fetchPreviewAsBlob(result.previewUrl)
      await createSavedPlace({
        imageBlob: blob,
        imageName: result.imageName,
        placeName: candidate.place_name ?? candidate.formatted_address ?? 'Unnamed place',
        collectionName,
        formattedAddress: candidate.formatted_address ?? null,
        country: candidate.country ?? null,
        city: candidate.city ?? null,
        latitude: candidate.latitude ?? null,
        longitude: candidate.longitude ?? null,
      })
      if (!collections.includes(collectionName)) {
        setCollections((cur) => [...cur, collectionName])
      }
      showToast(`Saved "${candidate.place_name ?? 'this location'}" to ${collectionName}`)
      setSaveDialogState(null)
    } catch (err) {
      showToast(err instanceof Error ? `Save failed: ${err.message}` : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!current) {
    return (
      <section className="panel content-panel search-results-shell">
        <p>No images in this search.</p>
      </section>
    )
  }

  return (
    <section className="panel content-panel search-results-shell">
      <section className="section-heading results-heading">
        <div>
          <p className="eyebrow">Search Results</p>
          <h2>{bundle.heading}</h2>
        </div>
        <div className="results-heading-side">
          <p className="section-copy">{bundle.subheading}</p>
          {bundle.results.length > 0 ? (
            <button
              type="button"
              className="button-primary results-save-all"
              onClick={() => void handleSaveAll()}
              disabled={savingAll}
            >
              {savingAll ? 'Saving all...' : `Save all to Gallery (${bundle.results.length})`}
            </button>
          ) : null}
        </div>
      </section>

      {total > 1 ? (
        <div className="carousel-bar">
          <div className="carousel-nav">
            <button
              type="button"
              className="carousel-arrow"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={safeIndex === 0}
              aria-label="Previous photo"
            >
              <ChevronIcon direction="left" />
            </button>
            <span className="carousel-position">{safeIndex + 1} / {total}</span>
            <button
              type="button"
              className="carousel-arrow"
              onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
              disabled={safeIndex === total - 1}
              aria-label="Next photo"
            >
              <ChevronIcon direction="right" />
            </button>
          </div>
        </div>
      ) : null}

      <ImageResultBlock
        key={current.id}
        result={current}
        index={safeIndex}
        total={total}
        retryHint={retryHints[current.id] ?? ''}
        retryDisabled={retryingId === current.id}
        showResearchPanel={openResearchFor === current.id}
        edit={topEdits[current.id] ?? {}}
        onChangeEdit={(patch) =>
          setTopEdits((cur) => ({ ...cur, [current.id]: { ...cur[current.id], ...patch } }))
        }
        onToggleResearchPanel={() =>
          setOpenResearchFor((cur) => (cur === current.id ? null : current.id))
        }
        onChangeRetryHint={(value) =>
          setRetryHints((cur) => ({ ...cur, [current.id]: value }))
        }
        onRetry={() => void handleRetry(current.id)}
        onSaveCandidate={(c) => handleSaveCandidate(c, current)}
        onOpenAlternate={(c) => setModalCandidate(c)}
      />

      <CandidateModal
        candidate={modalCandidate}
        imagePreviewUrl={current.previewUrl}
        imageName={current.imageName}
        open={modalCandidate !== null}
        onClose={() => setModalCandidate(null)}
        onSave={(c) => handleSaveCandidate(c, current)}
      />

      <SaveDialog
        open={saveDialogState !== null}
        candidate={saveDialogState?.candidate ?? null}
        previewUrl={saveDialogState?.result.previewUrl ?? ''}
        imageName={saveDialogState?.result.imageName ?? ''}
        collections={collections}
        saving={saving}
        onClose={() => setSaveDialogState(null)}
        onConfirm={handleConfirmSave}
      />

      {toast ? <div className="gallery-toast">{toast}</div> : null}

      <div className="search-results-footer">
        <button type="button" className="button-secondary" onClick={() => navigate('/')}>
          Back to search
        </button>
        {!isLoggedIn ? (
          <button type="button" className="button-secondary" onClick={() => navigate('/sign-in')}>
            Sign in to save this result
          </button>
        ) : (
          <button type="button" className="button-secondary" onClick={() => navigate('/gallery')}>
            Open Gallery history
          </button>
        )}
      </div>
    </section>
  )
}
