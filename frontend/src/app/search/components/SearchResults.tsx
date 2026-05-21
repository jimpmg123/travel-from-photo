import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { SearchResultMap } from './SearchResultMap'
import type { SearchResultBundle } from '../types'

type SearchResultsProps = {
  bundle: SearchResultBundle
  isLoggedIn: boolean
  onRetryFailedImage: (uploadId: string, userHint: string) => Promise<void>
}

export function SearchResults({
  bundle,
  isLoggedIn,
  onRetryFailedImage,
}: SearchResultsProps) {
  const navigate = useNavigate()
  const [retryHints, setRetryHints] = useState<Record<string, string>>({})
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const mappedResults = bundle.results.filter(
    (result) => result.latitude != null && result.longitude != null,
  )
  const savedCount = bundle.results.filter((result) => result.status === 'saved').length
  const warningCount = bundle.results.filter((result) => result.status === 'warning').length

  const handleRetry = async (uploadId: string) => {
    const hint = retryHints[uploadId]?.trim()
    if (!hint) {
      return
    }

    setRetryingId(uploadId)
    try {
      await onRetryFailedImage(uploadId, hint)
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <section className="panel content-panel search-results-shell">
      <section className="section-heading results-heading results-heading--large">
        <div>
          <p className="eyebrow">Search Results</p>
          <h2>{bundle.heading}</h2>
        </div>
        <div className="results-heading-side">
          <button
            type="button"
            className="button-secondary save-gallery-button"
            onClick={() => navigate('/gallery')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l1.4 1.7c.28.33.69.53 1.12.53H17.5A2.5 2.5 0 0 1 20 8.73v7.77A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-10Z"
                fill="currentColor"
              />
              <path
                d="M12 9.25v4.1m0 0-1.65-1.65M12 13.35l1.65-1.65"
                stroke="#fffaf0"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
              />
            </svg>
            <span>Save to Gallery</span>
          </button>
          <p className="section-copy">{bundle.subheading}</p>
        </div>
      </section>

      <div className="results-summary-grid results-summary-grid--large">
        {bundle.summaryCards.map((card) => (
          <article key={card.label} className="result-card result-card--large">
            <span className="metric-label">{card.label}</span>
            <strong className="metric-value">{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>

      <div className="analysis-hero analysis-hero--search">
        <div className="map-placeholder map-placeholder--search">
          <div className="map-placeholder-head">
            <span className="pill">Resolved locations</span>
            <span className="pill">
              {mappedResults.length > 0
                ? `${savedCount} exact${warningCount ? ` · ${warningCount} warning` : ''}`
                : 'No mapped coordinates'}
            </span>
          </div>
          <SearchResultMap results={bundle.results} />
          <div className="search-uploaded-strip">
            {mappedResults.map((result, index) => (
              <article key={result.id} className={`search-uploaded-strip-card search-uploaded-strip-card--${result.status}`}>
                <img src={result.previewUrl} alt={result.imageName} className="search-uploaded-strip-image" />
                <div className="search-uploaded-strip-copy">
                  <strong>#{index + 1}</strong>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="focus-card focus-card--search">
          <span className="result-label">Top mapped image</span>
          {bundle.topResolved ? (
            <>
              <img
                src={bundle.topResolved.previewUrl}
                alt={bundle.topResolved.imageName}
                className="search-focus-image"
              />
              <h3>{bundle.topResolved.imageName}</h3>
              <p>{bundle.topResolved.address ?? bundle.topResolved.coordinates}</p>
              <div className="confidence-pill">{bundle.topResolved.resolutionPath}</div>
              <p className="focus-card-copy">{bundle.topResolved.summary}</p>
            </>
          ) : (
            <>
              <h3>No resolved image yet</h3>
              <p>Every uploaded image failed location recovery in this run.</p>
            </>
          )}
        </aside>
      </div>

      <div className="candidate-stack">
        <div className="section-heading compact-section-heading">
          <div>
            <p className="eyebrow">Uploaded Images</p>
            <h3>Per-image results</h3>
          </div>
          <p className="section-copy">
            Each card shows the uploaded image, the resolved location if any, and which backend path produced the result.
          </p>
        </div>

        <div className="image-result-list image-result-list--visual">
          {bundle.results.map((result) => (
            <article key={result.id} className="image-result-card image-result-card--visual">
              <img src={result.previewUrl} alt={result.imageName} className="image-result-preview" />

              <div className="image-result-body">
                <div className="image-result-header image-result-header--visual">
                  <div>
                    <strong>{result.imageName}</strong>
                    <p>{result.address ?? 'No resolved address'}</p>
                  </div>
                  <span className={`result-state-pill result-state-pill--${result.status}`}>
                    {result.status === 'saved'
                      ? 'Resolved'
                      : result.status === 'warning'
                        ? 'Warning'
                        : 'Failed'}
                  </span>
                </div>

                <p className="image-result-summary image-result-summary--large">{result.summary}</p>

                <div className="image-result-grid image-result-grid--large">
                  <div className="details-placeholder-item">
                    <strong>Resolution path</strong>
                    <p>{result.resolutionPath}</p>
                  </div>
                  <div className="details-placeholder-item">
                    <strong>Coordinates</strong>
                    <p>{result.coordinates ?? 'No coordinates returned'}</p>
                  </div>
                  <div className="details-placeholder-item image-result-grid-span">
                    <strong>How this result was produced</strong>
                    <p>{result.resolutionNote}</p>
                  </div>
                </div>

                {result.status === 'failed' ? (
                  <div className="search-retry-panel">
                    <label className="field field--retry">
                      <span>Add a hint for retry</span>
                      <input
                        type="text"
                        value={retryHints[result.id] ?? ''}
                        onChange={(event) =>
                          setRetryHints((current) => ({
                            ...current,
                            [result.id]: event.target.value,
                          }))
                        }
                        placeholder="e.g. Kyoto subway ticket, near Gion, museum pass in Manhattan"
                      />
                    </label>
                    <div className="search-retry-panel-actions">
                      <p>
                        This retry sends the image, your hint, and any OCR text to OpenAI with
                        higher weight on your hint.
                      </p>
                      <button
                        type="button"
                        className="button-secondary"
                        disabled={!retryHints[result.id]?.trim() || retryingId === result.id}
                        onClick={() => void handleRetry(result.id)}
                      >
                        {retryingId === result.id ? 'Retrying...' : 'Retry with hint'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>

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
