import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { Candidate, SearchImageResult, SearchResultBundle } from '../types'

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

const GALLERY_STORAGE_KEY = 'tfp_gallery_saves'

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

function saveToLocalGallery(payload: { candidate: Candidate; imageId: string; previewUrl: string; imageName: string }) {
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY)
    const existing = raw ? JSON.parse(raw) : []
    const entry = {
      savedAt: new Date().toISOString(),
      imageId: payload.imageId,
      imageName: payload.imageName,
      previewUrl: payload.previewUrl,
      candidate: payload.candidate,
    }
    const next = Array.isArray(existing) ? [entry, ...existing] : [entry]
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage may be unavailable in restricted contexts; silently skip.
  }
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
  const mapUrl = top ? mapEmbedUrl(top) : null
  const tags = top ? deriveTags(top) : []

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

      {top ? (
        <>
          <div className="top-match-card">
            <div className="match-map">
              {mapUrl ? (
                <iframe src={mapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={top.place_name ?? 'Map'} allowFullScreen />
              ) : (
                <div className="match-map-placeholder">No coordinates available.</div>
              )}
            </div>

            <div className="match-right">
              <div className="match-photo">
                <img src={result.previewUrl} alt={result.imageName} />
              </div>

              <div className="match-info">
                <div className="match-info-head">
                  <div className="match-info-text">
                    <h3 className="match-name">
                      {top.place_name ?? top.formatted_address ?? 'Unnamed location'}
                    </h3>
                    <p className="match-location">
                      <MapPinIcon />
                      {locationLine(top)}
                    </p>
                  </div>
                  <div className="match-score">
                    <div className="match-score-value">{toPercent(top.aggregated_score)}%</div>
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
                    onClick={() => onSaveCandidate(top)}
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
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

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
    saveToLocalGallery({
      candidate,
      imageId: result.id,
      previewUrl: result.previewUrl,
      imageName: result.imageName,
    })
    showToast(`Saved "${candidate.place_name ?? 'this location'}" to your gallery`)
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
