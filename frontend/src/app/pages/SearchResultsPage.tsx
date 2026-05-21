import { useNavigate } from 'react-router-dom'
import { SearchResults } from '../search/components/SearchResults'
import type { SearchResultsPageProps } from '../search/types'

export function SearchResultsPage({
  isLoggedIn,
  searchSession,
  onRetryFailedImage,
}: SearchResultsPageProps) {
  const navigate = useNavigate()

  if (!searchSession) {
    return (
      <div className="stack-xl">
        <section className="section-heading">
          <div>
            <p className="eyebrow">Search Results</p>
            <h2>No search run yet</h2>
          </div>
          <p className="section-copy">
            Upload images and run search first. The result screen is filled from the latest backend
            image-analysis run.
          </p>
        </section>

        <article className="panel content-panel empty-results-card">
          <p>
            No search session exists yet, so there is nothing to display. Start from the main
            search screen and upload one or more travel images.
          </p>
          <button type="button" className="button-primary" onClick={() => navigate('/')}>
            Go to search
          </button>
        </article>
      </div>
    )
  }

  return (
    <SearchResults
      bundle={searchSession.bundle}
      isLoggedIn={isLoggedIn}
      onRetryFailedImage={onRetryFailedImage}
    />
  )
}
