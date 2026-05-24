import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookText, Check, Library, MapPin, Plus, Sparkles } from 'lucide-react'

import { useJournalJob } from '../context/JournalJobContext'
import { galleryGroups } from '../data'
import type { GalleryGroup, GalleryImage } from '../types'

type PageMode = 'home' | 'pick-collection' | 'pick-photos' | 'just-started'

const MAX_SELECTABLE = 20

const imageHasMetadata = (image: GalleryImage): boolean =>
  typeof image.latitude === 'number' && typeof image.longitude === 'number'

export function JournalPage() {
  const navigate = useNavigate()
  const { job, isStarting, start } = useJournalJob()
  const [mode, setMode] = useState<PageMode>('home')
  const [selectedCollection, setSelectedCollection] = useState<GalleryGroup | null>(null)
  const [selectedImageIds, setSelectedImageIds] = useState<Set<number>>(new Set())
  const [noMetaWarning, setNoMetaWarning] = useState<string | null>(null)

  // Reset photo selection whenever the user enters a different collection.
  const enterPhotoPicker = (group: GalleryGroup) => {
    setSelectedCollection(group)
    setSelectedImageIds(new Set())
    setNoMetaWarning(null)
    setMode('pick-photos')
  }

  const toggleImage = (image: GalleryImage) => {
    if (!imageHasMetadata(image)) {
      setNoMetaWarning(`"${image.title}" doesn't have GPS/timestamp metadata, so it can't be journaled.`)
      return
    }
    setSelectedImageIds((current) => {
      const next = new Set(current)
      if (next.has(image.id)) {
        next.delete(image.id)
      } else if (next.size < MAX_SELECTABLE) {
        next.add(image.id)
      }
      return next
    })
  }

  const handleGenerate = async () => {
    if (selectedImageIds.size === 0) return
    try {
      await start(Array.from(selectedImageIds))
      setMode('just-started')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start journal generation.'
      setNoMetaWarning(message)
    }
  }

  const totalCollections = galleryGroups.length

  // ----- HOME -----
  if (mode === 'home') {
    return (
      <div className="journal-home-shell">
        <header className="journal-home-header">
          <h2>Journal</h2>
          <p>Turn your travel photos into a written log, or revisit the ones you've already kept.</p>
        </header>

        <section className="journal-home-actions">
          <button
            type="button"
            className="journal-home-tile journal-home-tile--create"
            onClick={() => setMode('pick-collection')}
          >
            <span className="journal-home-tile-icon">
              <Plus size={28} />
            </span>
            <strong>Create Journal</strong>
            <span className="journal-home-tile-hint">Pick photos from a collection</span>
          </button>

          <button
            type="button"
            className="journal-home-tile journal-home-tile--browse"
            onClick={() => navigate('/journal/collections')}
          >
            <span className="journal-home-tile-icon">
              <Library size={28} />
            </span>
            <strong>Show Journal Collections</strong>
            <span className="journal-home-tile-hint">Saved journals + stats</span>
          </button>
        </section>
      </div>
    )
  }

  // ----- COLLECTION PICKER -----
  if (mode === 'pick-collection') {
    return (
      <div className="journal-picker-shell">
        <header className="journal-picker-header">
          <button type="button" className="journal-picker-back" onClick={() => setMode('home')}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div className="journal-picker-titles">
            <h2>Choose a collection</h2>
            <p>{totalCollections} collections in your gallery</p>
          </div>
        </header>

        {galleryGroups.length === 0 ? (
          <div className="gallery-empty">
            <strong>No collections yet</strong>
            <p>
              Upload photos through the Search page first — once they land in the gallery you can
              come back here and build a journal from them.
            </p>
          </div>
        ) : (
          <section className="journal-collection-grid">
            {galleryGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                className="journal-collection-tile"
                onClick={() => enterPhotoPicker(group)}
              >
                <div className={`photo-frame photo-frame--${group.images[0]?.theme ?? group.theme}`} />
                <div className="journal-collection-info">
                  <strong>{group.title}</strong>
                  <span>{group.city}, {group.country} · {group.images.length} photos</span>
                </div>
              </button>
            ))}
          </section>
        )}
      </div>
    )
  }

  // ----- PHOTO PICKER -----
  if (mode === 'pick-photos' && selectedCollection !== null) {
    const eligibleCount = selectedCollection.images.filter(imageHasMetadata).length
    const selectedCount = selectedImageIds.size
    const canGenerate = selectedCount > 0 && !isStarting

    return (
      <div className="journal-picker-shell">
        <header className="journal-picker-header">
          <button type="button" className="journal-picker-back" onClick={() => setMode('pick-collection')}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div className="journal-picker-titles">
            <h2>{selectedCollection.title}</h2>
            <p>
              Select up to {MAX_SELECTABLE} photos · {eligibleCount} with GPS/timestamp · {selectedCount} selected
            </p>
          </div>
          <button
            type="button"
            className="button-primary journal-generate-button"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            <Sparkles size={14} />
            <span>Generate Journal</span>
          </button>
        </header>

        {noMetaWarning && (
          <div className="journal-warning-banner">
            <span>{noMetaWarning}</span>
            <button type="button" onClick={() => setNoMetaWarning(null)} aria-label="Dismiss warning">
              ×
            </button>
          </div>
        )}

        <section className="journal-photo-grid">
          {selectedCollection.images.map((image) => {
            const has = imageHasMetadata(image)
            const selected = selectedImageIds.has(image.id)
            return (
              <button
                key={image.id}
                type="button"
                className={`journal-photo-tile ${has ? '' : 'is-disabled'} ${selected ? 'is-selected' : ''}`}
                onClick={() => toggleImage(image)}
                aria-pressed={selected}
                title={has ? image.title : `${image.title} (no metadata)`}
              >
                <div className={`photo-frame photo-frame--${image.theme}`} />
                {has && (
                  <span className="journal-photo-checkbox" aria-hidden="true">
                    {selected ? <Check size={14} /> : null}
                  </span>
                )}
                {!has && <span className="journal-photo-nometa">no metadata</span>}
              </button>
            )
          })}
        </section>
      </div>
    )
  }

  // ----- JUST STARTED (brief message before user navigates away) -----
  if (mode === 'just-started') {
    const totalSelected = selectedImageIds.size
    return (
      <div className="journal-started-shell">
        <BookText size={36} />
        <h2>AI is generating your journal…</h2>
        <p>You can keep using the app — the progress popup will stay with you.</p>
        <div className="journal-started-meta">
          <span>
            <MapPin size={14} /> {selectedCollection?.title}
          </span>
          <span>{totalSelected} photos queued</span>
          {job && <span>Status: {job.status}</span>}
        </div>
        <div className="journal-started-actions">
          <button type="button" className="button-secondary" onClick={() => setMode('home')}>
            Back to Journal home
          </button>
        </div>
      </div>
    )
  }

  return null
}
