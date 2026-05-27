import { PhotoCard } from '../components/PhotoCard'
import { SectionIntro } from '../components/SectionIntro'
import type { GalleryGroup, PageId } from '../types'

type GalleryPageProps = {
  groups: GalleryGroup[]
  isLoggedIn: boolean
  onOpenPage: (page: PageId) => void
  onRenameGroup: (groupId: number, title: string) => void
  onViewImages: (group: GalleryGroup) => void
}

export function GalleryPage({
  groups,
  isLoggedIn,
  onOpenPage,
  onRenameGroup,
  onViewImages,
}: GalleryPageProps) {
  if (!isLoggedIn) {
    return (
      <section className="locked-shell">
        <div className="panel locked-card">
          <p className="eyebrow">Gallery</p>
          <h2>Private upload gallery</h2>
          <p>
            This page is reserved for signed-in users so they can review their own uploaded photos,
            open the detected place, and jump into guidance.
          </p>
          <div className="hero-actions">
            <button type="button" className="button-primary" onClick={() => onOpenPage('profile')}>
              Go to Profile
            </button>
            <button type="button" className="button-secondary" onClick={() => onOpenPage('search')}>
              Back to Search
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="stack-xl">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Gallery</p>
          <h2>My uploaded photos</h2>
        </div>
        <p className="section-copy">
          Signed-in users can review grouped photo memories by city, rename collections, and open
          each group as a dedicated image browser.
        </p>
      </section>

      <section className="gallery-layout">
        <div className="gallery-grid gallery-grid--groups">
          {groups.map((group) => (
            <PhotoCard
              key={group.id}
              group={group}
              onRename={onRenameGroup}
              onViewImages={onViewImages}
            />
          ))}
        </div>

        <aside className="panel sidebar-panel">
          <SectionIntro
            title="Gallery notes"
            detail="This sidebar keeps private-user behavior visible in the shell."
          />
          <ul className="bullet-list">
            <li>Groups are organized by city and can be renamed from the card itself.</li>
            <li>View Images opens a dedicated image browser with modal preview controls.</li>
            <li>Food memories can still reopen the restaurant-discovery branch from Search.</li>
          </ul>
          <div className="callout">
            <strong>Next backend handoff</strong>
            <p>Replace these mock groups with actual uploads, predictions, and navigation links.</p>
          </div>
        </aside>
      </section>
    </div>
  )
}
