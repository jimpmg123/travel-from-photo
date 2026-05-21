import { useNavigate } from 'react-router-dom'
import { PhotoCard } from '../components/PhotoCard'
import { SectionIntro } from '../components/SectionIntro'
import type { GalleryGroup } from '../types'

type GalleryPageProps = {
  groups: GalleryGroup[]
  isLoggedIn: boolean
  onRenameGroup: (groupId: number, title: string) => void
  onViewImages: (group: GalleryGroup) => void
}

export function GalleryPage({
  groups,
  isLoggedIn,
  onRenameGroup,
  onViewImages,
}: GalleryPageProps) {
  const navigate = useNavigate()
  const totalImages = groups.reduce((sum, group) => sum + group.images.length, 0)
  const foodGroups = groups.filter((group) => group.type.toLowerCase().includes('food')).length
  const cityCount = new Set(groups.map((group) => group.city)).size

  if (!isLoggedIn) {
    return (
      <section className="locked-shell">
        <div className="panel locked-card">
          <p className="eyebrow">Gallery</p>
          <h2>Private upload gallery</h2>
          <p>
            This page is reserved for signed-in users so they can review their uploaded photos,
            organize memory groups, and reopen image-based travel results.
          </p>
          <div className="hero-actions">
            <button type="button" className="button-primary" onClick={() => navigate('/sign-in')}>
              Sign in to continue
            </button>
            <button type="button" className="button-secondary" onClick={() => navigate('/profile')}>
              Open Profile
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="stack-xl">
      <section className="gallery-hero panel">
        <div className="gallery-hero-copy">
          <p className="eyebrow">Gallery</p>
          <h2>My uploaded photo groups</h2>
          <p className="section-copy">
            Review grouped memories, rename collections, and open a dedicated image browser for each
            city or trip context.
          </p>

          <div className="badge-row">
            <span className="pill">Signed-in only</span>
            <span className="pill">Private image browser</span>
            <span className="pill">Ready for backend upload data</span>
          </div>
        </div>

        <div className="gallery-metric-grid">
          <div className="gallery-metric-card">
            <span className="result-label">Groups</span>
            <strong>{groups.length}</strong>
            <p>Organized collections built from uploaded travel memories.</p>
          </div>
          <div className="gallery-metric-card">
            <span className="result-label">Images</span>
            <strong>{totalImages}</strong>
            <p>Total thumbnails currently visible across all private groups.</p>
          </div>
          <div className="gallery-metric-card">
            <span className="result-label">Cities</span>
            <strong>{cityCount}</strong>
            <p>Distinct city contexts represented in the current gallery state.</p>
          </div>
          <div className="gallery-metric-card">
            <span className="result-label">Food sets</span>
            <strong>{foodGroups}</strong>
            <p>Collections that can reopen the restaurant or cuisine search flow.</p>
          </div>
        </div>
      </section>

      <section className="gallery-layout">
        <div className="gallery-main-column">
          <div className="panel content-panel">
            <SectionIntro
              title="Grouped memories"
              detail="Each card keeps one city or trip cluster so the user can browse images with less clutter."
            />
          </div>

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
        </div>

        <aside className="panel sidebar-panel">
          <SectionIntro
            title="Gallery notes"
            detail="This sidebar keeps the behavior of the gallery clear before backend upload data is connected."
          />
          <ul className="bullet-list">
            <li>Each group can be renamed directly from the card.</li>
            <li>View Images opens a dedicated image browser with modal preview controls.</li>
            <li>Food-related groups can connect back to restaurant search later.</li>
            <li>Current backend route is mock-based and can be swapped with DB data later.</li>
          </ul>
          <div className="callout">
            <strong>Next backend handoff</strong>
            <p>Replace mock groups with uploaded image records, EXIF metadata, and AI-assisted results.</p>
          </div>
        </aside>
      </section>
    </div>
  )
}
