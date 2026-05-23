import { useState } from 'react'
import { ArrowLeft, Lock, MapPin, Unlock } from 'lucide-react'

import { CollectionMapModal } from '../components/CollectionMapModal'
import { ImageModal } from '../components/ImageModal'
import type { GalleryGroup, GalleryImage } from '../types'

type ImagesPageProps = {
  group: GalleryGroup
  selectedImage: GalleryImage | null
  onBack: () => void
  onOpenImage: (image: GalleryImage) => void
  onCloseImage: () => void
  onNavigateImage: (direction: 'prev' | 'next') => void
  onToggleLock: (groupId: number) => void
}

export function ImagesPage({
  group,
  selectedImage,
  onBack,
  onOpenImage,
  onCloseImage,
  onNavigateImage,
  onToggleLock,
}: ImagesPageProps) {
  const [showMap, setShowMap] = useState(false)

  return (
    <>
      <div className="images-page-shell">
        <header className="images-page-header">
          <button
            type="button"
            className="images-page-back"
            onClick={onBack}
            aria-label="Back to gallery"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div className="images-page-titles">
            <h2 className="images-page-title">{group.title}</h2>
            <p className="images-page-meta">
              <MapPin size={14} aria-hidden="true" />
              <span>
                {group.city}, {group.country} · {group.images.length} photos
              </span>
            </p>
          </div>

          <div className="images-page-actions">
            <button
              type="button"
              className={`images-page-lock ${group.isLocked ? 'is-locked' : 'is-unlocked'}`}
              onClick={() => onToggleLock(group.id)}
              aria-pressed={group.isLocked}
              aria-label={group.isLocked ? 'Unlock this collection' : 'Lock this collection'}
            >
              {group.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
              <span>{group.isLocked ? 'Locked' : 'Unlocked'}</span>
            </button>
            <button
              type="button"
              className="button-secondary images-page-map-button"
              onClick={() => setShowMap(true)}
            >
              View on map
            </button>
          </div>
        </header>

        <section className="images-grid">
          {group.images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className="images-grid-tile"
              onClick={() => onOpenImage(image)}
              style={{ animationDelay: `${index * 50}ms` }}
              aria-label={`Open ${image.title}`}
            >
              <div className={`photo-frame photo-frame--${image.theme} images-grid-frame`} />
            </button>
          ))}
        </section>
      </div>

      <ImageModal
        image={selectedImage}
        images={group.images}
        onClose={onCloseImage}
        onNavigate={onNavigateImage}
      />

      {showMap && (
        <CollectionMapModal
          title={group.title}
          images={group.images}
          onClose={() => setShowMap(false)}
        />
      )}
    </>
  )
}
