import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookText, Check, Library, MapPin, Plus, Sparkles } from 'lucide-react'

import { useJournalJob } from '../context/JournalJobContext'
import { useSavedPlaces } from '../hooks/useSavedPlaces'
import { absoluteImageUrl, type Collection, type SavedPlace } from '../services/galleryApi'

type PageMode = 'home' | 'pick-collection' | 'pick-photos' | 'just-started'

const MAX_SELECTABLE = 20

const eligibleForJournal = (place: SavedPlace): boolean =>
  place.image_metadata_id != null && place.has_gps

export function JournalPage() {
  const navigate = useNavigate()
  const { job, isStarting, start } = useJournalJob()
  const { collections, loading, error } = useSavedPlaces()
  const [mode, setMode] = useState<PageMode>('home')
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Set<number>>(new Set())
  const [warning, setWarning] = useState<string | null>(null)

  const nonEmptyCollections = useMemo(
    () => collections.filter((c) => c.saves.length > 0),
    [collections],
  )

  const enterPhotoPicker = (collection: Collection) => {
    setSelectedCollection(collection)
    setSelectedPlaceIds(new Set())
    setWarning(null)
    setMode('pick-photos')
  }

  const togglePlace = (place: SavedPlace) => {
    if (!eligibleForJournal(place)) {
      const reason = place.image_metadata_id == null
        ? 'This save predates EXIF storage. Save it again from a new search to make it journal-eligible.'
        : "No GPS in this photo's EXIF — journal needs location data to map it."
      setWarning(`"${place.place_name}": ${reason}`)
      return
    }
    setSelectedPlaceIds((current) => {
      const next = new Set(current)
      if (next.has(place.id)) {
        next.delete(place.id)
      } else if (next.size < MAX_SELECTABLE) {
        next.add(place.id)
      }
      return next
    })
  }

  const handleGenerate = async () => {
    if (!selectedCollection) return
    const eligibleSelected = selectedCollection.saves.filter(
      (p) => selectedPlaceIds.has(p.id) && eligibleForJournal(p),
    )
    const imageIds = eligibleSelected
      .map((p) => p.image_metadata_id)
      .filter((id): id is number => id != null)
    if (imageIds.length === 0) return
    try {
      await start(imageIds)
      setMode('just-started')
    } catch (e) {
      setWarning(e instanceof Error ? e.message : 'Failed to start journal generation.')
    }
  }

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
            <span className="journal-home-tile-icon"><Plus size={28} /></span>
            <strong>Create Journal</strong>
            <span className="journal-home-tile-hint">Pick photos from a gallery collection</span>
          </button>

          <button
            type="button"
            className="journal-home-tile journal-home-tile--browse"
            onClick={() => navigate('/journal/collections')}
          >
            <span className="journal-home-tile-icon"><Library size={28} /></span>
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
            <p>{nonEmptyCollections.length} collection{nonEmptyCollections.length === 1 ? '' : 's'} available</p>
          </div>
        </header>

        {loading ? (
          <p className="gallery-empty-line">Loading collections...</p>
        ) : error ? (
          <div className="gallery-empty">
            <strong>Could not load gallery</strong>
            <p>{error}</p>
          </div>
        ) : nonEmptyCollections.length === 0 ? (
          <div className="gallery-empty">
            <strong>No collections with photos yet</strong>
            <p>
              Run a search and save results to Gallery first — then come back here to pick photos
              for a journal.
            </p>
          </div>
        ) : (
          <section className="gallery-grid gallery-grid--groups">
            {nonEmptyCollections.map((collection) => {
              const cover = collection.saves[0]
              const coverUrl = absoluteImageUrl(cover?.image_url ?? null)
              const eligibleCount = collection.saves.filter(eligibleForJournal).length
              return (
                <button
                  key={collection.name}
                  type="button"
                  className="gallery-collection-card"
                  onClick={() => enterPhotoPicker(collection)}
                >
                  <div className="gallery-collection-cover">
                    {coverUrl ? <img src={coverUrl} alt={collection.name} /> : (
                      <div className="gallery-collection-cover-empty">Empty collection</div>
                    )}
                  </div>
                  <div className="gallery-collection-meta">
                    <h3>{collection.name}</h3>
                    <p>
                      {collection.saves.length} place{collection.saves.length === 1 ? '' : 's'}
                      {' · '}
                      {eligibleCount} journal-ready
                    </p>
                  </div>
                </button>
              )
            })}
          </section>
        )}
      </div>
    )
  }

  // ----- PHOTO PICKER -----
  if (mode === 'pick-photos' && selectedCollection !== null) {
    const eligibleCount = selectedCollection.saves.filter(eligibleForJournal).length
    const selectedCount = selectedPlaceIds.size
    const canGenerate = selectedCount > 0 && !isStarting

    return (
      <div className="journal-picker-shell">
        <header className="journal-picker-header">
          <button
            type="button"
            className="journal-picker-back"
            onClick={() => setMode('pick-collection')}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div className="journal-picker-titles">
            <h2>{selectedCollection.name}</h2>
            <p>
              Select up to {MAX_SELECTABLE} photos · {eligibleCount} journal-ready · {selectedCount} selected
            </p>
          </div>
          <button
            type="button"
            className="button-primary journal-generate-button"
            onClick={() => void handleGenerate()}
            disabled={!canGenerate}
          >
            <Sparkles size={14} />
            <span>{isStarting ? 'Starting...' : 'Generate Journal'}</span>
          </button>
        </header>

        {warning && (
          <div className="journal-warning-banner">
            <span>{warning}</span>
            <button type="button" onClick={() => setWarning(null)} aria-label="Dismiss warning">×</button>
          </div>
        )}

        <section className="journal-photo-grid">
          {selectedCollection.saves.map((place) => {
            const eligible = eligibleForJournal(place)
            const selected = selectedPlaceIds.has(place.id)
            const url = absoluteImageUrl(place.image_url)
            return (
              <button
                key={place.id}
                type="button"
                className={`journal-photo-tile ${eligible ? '' : 'is-disabled'} ${selected ? 'is-selected' : ''}`}
                onClick={() => togglePlace(place)}
                aria-pressed={selected}
                title={place.place_name}
              >
                {url ? (
                  <img src={url} alt={place.place_name} className="journal-photo-tile-img" />
                ) : (
                  <div className="journal-photo-tile-empty">No image</div>
                )}
                {eligible && (
                  <span className="journal-photo-checkbox" aria-hidden="true">
                    {selected ? <Check size={14} /> : null}
                  </span>
                )}
                {!eligible && <span className="journal-photo-nometa">no GPS</span>}
                <span className="journal-photo-caption">{place.place_name}</span>
              </button>
            )
          })}
        </section>
      </div>
    )
  }

  // ----- JUST STARTED -----
  if (mode === 'just-started') {
    return (
      <div className="journal-started-shell">
        <BookText size={36} />
        <h2>AI is generating your journal…</h2>
        <p>You can keep using the app — the progress popup stays with you.</p>
        <div className="journal-started-meta">
          {selectedCollection && (
            <span><MapPin size={14} /> {selectedCollection.name}</span>
          )}
          <span>{selectedPlaceIds.size} photos queued</span>
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
