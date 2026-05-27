import { SearchResults } from '../search/components/SearchResults'
import { buildSearchResultBundle } from '../search/data'
import type { SearchResultsPageProps } from '../search/types'

export function SearchResultsPage({
  isLoggedIn,
  searchSession,
  onOpenPage,
}: SearchResultsPageProps) {
  if (!searchSession) {
    return (
      <div className="stack-xl">
        <section className="section-heading">
          <div>
            <p className="eyebrow">Search Results</p>
            <h2>No search run yet</h2>
          </div>
          <p className="section-copy">
            Upload images and run the search flow first. This temporary results page is driven by
            the latest frontend search session.
          </p>
        </section>

        <article className="panel content-panel empty-results-card">
          <p>
            No search session exists yet, so there is nothing to display. Start from the main
            search screen and upload one or more travel images.
          </p>
          <button type="button" className="button-primary" onClick={() => onOpenPage('search')}>
            Go to search
          </button>
        </article>
      </div>
    )
  }

  return (
    <SearchResults
      bundle={buildSearchResultBundle(searchSession)}
      isLoggedIn={isLoggedIn}
      onOpenPage={onOpenPage}
    />
  )
}
