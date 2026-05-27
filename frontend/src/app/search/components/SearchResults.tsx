import { SectionIntro } from '../../components/SectionIntro'
import type { PageNavigator } from '../../types'
import type { SearchResultBundle } from '../types'

type SearchResultsProps = {
  bundle: SearchResultBundle
  isLoggedIn: boolean
  onOpenPage: PageNavigator
}

export function SearchResults({ bundle, isLoggedIn, onOpenPage }: SearchResultsProps) {
  return (
    <section className="panel content-panel search-results-shell">
      <section className="section-heading results-heading">
        <div>
          <p className="eyebrow">Search Results</p>
          <h2>{bundle.heading}</h2>
        </div>
        <div className="results-heading-side">
          <button
            type="button"
            className="button-secondary save-gallery-button"
            onClick={() => onOpenPage('gallery')}
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

      <div className="results-summary-grid">
        {bundle.summaryCards.map((card) => (
          <article key={card.label} className="result-card">
            <span className="metric-label">{card.label}</span>
            <strong className="metric-value">{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>

      <div className="analysis-hero">
        <div className="map-placeholder">
          <div className="map-placeholder-head">
            <span className="pill">Placeholder Map</span>
            <span className="pill">
              {bundle.topResolved ? 'coordinates ready' : 'no valid coordinates'}
            </span>
          </div>
          <div className="map-placeholder-center">
            <strong>
              {bundle.topResolved
                ? 'Temporary map placeholder for the highest-confidence resolved image'
                : 'No image passed the save rule in this temporary run'}
            </strong>
            <p>
              {bundle.topResolved?.address ??
                'A resolved address will appear here after a successful run.'}
            </p>
            <span>{bundle.topResolved?.coordinates ?? 'No coordinates saved'}</span>
          </div>
        </div>

        <aside className="focus-card">
          <span className="result-label">Highest confidence</span>
          <h3>{bundle.topResolved?.imageName ?? 'No resolved image yet'}</h3>
          <p>{bundle.topResolved?.source ?? 'Awaiting successful location resolution'}</p>
          <div className="confidence-pill">
            {bundle.topResolved ? 'saved to backend' : 'temporary failure'}
          </div>
          <p className="focus-card-copy">
            {bundle.topResolved?.summary ??
              'If every image fails validation, the final product should show a visible failure state instead of storing coordinates.'}
          </p>
        </aside>
      </div>

      <div className="candidate-stack">
        <SectionIntro
          title="Per-image processing output"
          detail="Each uploaded image shows whether EXIF, landmark recognition, CLIP + OpenAI fallback, or failure determined the final state."
        />
        <div className="image-result-list">
          {bundle.results.map((result) => (
            <article key={result.id} className="image-result-card">
              <div className="image-result-header">
                <div>
                  <strong>{result.imageName}</strong>
                  <p>{result.source}</p>
                </div>
                <span className={`result-state-pill result-state-pill--${result.status}`}>
                  {result.status === 'saved' ? 'Stored' : 'Failed'}
                </span>
              </div>

              <p className="image-result-summary">{result.summary}</p>

              <div className="image-result-grid">
                <div className="details-placeholder-item">
                  <strong>Coordinates</strong>
                  <p>{result.coordinates ?? 'No coordinates stored'}</p>
                </div>
                <div className="details-placeholder-item">
                  <strong>Address</strong>
                  <p>{result.address ?? 'Address unavailable because location inference failed'}</p>
                </div>
                <div className="details-placeholder-item image-result-grid-span">
                  <strong>Backend image record</strong>
                  <p>{result.backendRecord}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="details-layout">
        <article className="details-card">
          <SectionIntro
            title="Processing rules"
            detail="This is the intended backend sequence for EXIF, landmark recognition, CLIP, and OpenAI based location inference."
          />
          <div className="details-placeholder-list">
            {bundle.processingNotes.map((item) => (
              <div key={item.label} className="details-placeholder-item">
                <strong>{item.label}</strong>
                <p>{item.value}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="details-card">
          <SectionIntro
            title="External services in this flow"
            detail="The final backend flow uses these services to decide whether a coordinate can be written to the image record."
          />
          <div className="details-placeholder-list">
            {bundle.serviceNotes.map((item) => (
              <div key={item.label} className="details-placeholder-item">
                <strong>{item.label}</strong>
                <p>{item.value}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="search-results-footer">
        <button type="button" className="button-secondary" onClick={() => onOpenPage('search')}>
          Back to search
        </button>
        {!isLoggedIn ? (
          <button type="button" className="button-secondary" onClick={() => onOpenPage('sign-in')}>
            Sign in to save this result
          </button>
        ) : (
          <button type="button" className="button-secondary" onClick={() => onOpenPage('gallery')}>
            Open Gallery history
          </button>
        )}
      </div>
    </section>
  )
}
