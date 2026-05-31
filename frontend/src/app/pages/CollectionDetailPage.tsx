import { useEffect, useState } from 'react'
import { ArrowLeft, MapPin, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { useSavedPlaces } from '../hooks/useSavedPlaces'
import { absoluteImageUrl, type SavedPlace } from '../services/galleryApi'

export function CollectionDetailPage() {
  const navigate = useNavigate()
  const params = useParams<{ collectionName: string }>()
  const collectionName = decodeURIComponent(params.collectionName ?? '')

  const { collections, loading, error, renameCollection, movePlace, deletePlace, deleteCollection } = useSavedPlaces()

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(collectionName)
  const [moveDialogFor, setMoveDialogFor] = useState<SavedPlace | null>(null)
  const [busy, setBusy] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  if (loading) {
    return <div className="gallery-page-shell"><p className="gallery-empty-line">Loading...</p></div>
  }
  if (error) {
    return (
      <div className="gallery-page-shell">
        <div className="gallery-empty">
          <strong>Could not load collection</strong>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  const collection = collections.find((c) => c.name === collectionName)
  if (!collection) {
    return (
      <div className="gallery-page-shell">
        <div className="gallery-empty">
          <strong>Collection not found</strong>
          <button type="button" className="button-secondary" onClick={() => navigate('/gallery')}>
            Back to gallery
          </button>
        </div>
      </div>
    )
  }

  const otherCollections = collections.filter((c) => c.name !== collection.name).map((c) => c.name)

  const commitRename = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === collection.name) {
      setEditingName(false)
      return
    }
    setBusy(true)
    try {
      await renameCollection(collection.name, trimmed)
      setEditingName(false)
      navigate(`/gallery/collection/${encodeURIComponent(trimmed)}`, { replace: true })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rename failed')
    } finally {
      setBusy(false)
    }
  }

  const handleMove = async (target: string) => {
    if (!moveDialogFor) return
    const trimmed = target.trim()
    if (!trimmed || trimmed === collection.name) {
      setMoveDialogFor(null)
      return
    }
    setBusy(true)
    try {
      await movePlace(moveDialogFor.id, trimmed)
      setMoveDialogFor(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Move failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteCollection = async () => {
    const count = collection.saves.length
    const msg = count === 0
      ? `Delete empty collection "${collection.name}"?`
      : `Delete "${collection.name}" and all ${count} place${count === 1 ? '' : 's'} in it? This cannot be undone.`
    if (!window.confirm(msg)) return
    setBusy(true)
    try {
      await deleteCollection(collection.name)
      navigate('/gallery', { replace: true })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete collection')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (place: SavedPlace) => {
    if (!window.confirm(`Remove "${place.place_name}" from this collection?`)) return
    setBusy(true)
    try {
      await deletePlace(place.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="images-page-shell">
      <header className="images-page-header">
        <button type="button" className="images-page-back" onClick={() => navigate('/gallery')}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <div className="images-page-titles">
          {editingName ? (
            <input
              type="text"
              className="collection-rename-input"
              value={nameDraft}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => void commitRename()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitRename()
                if (e.key === 'Escape') {
                  setNameDraft(collection.name)
                  setEditingName(false)
                }
              }}
              disabled={busy}
            />
          ) : (
            <h2 className="images-page-title">
              {collection.name}
              <button
                type="button"
                className="collection-rename-btn"
                onClick={() => {
                  setNameDraft(collection.name)
                  setEditingName(true)
                }}
                aria-label="Rename collection"
              >
                ✎
              </button>
            </h2>
          )}
          <p className="images-page-meta">
            <MapPin size={14} aria-hidden="true" />
            <span>{collection.saves.length} places</span>
          </p>
        </div>

        <button
          type="button"
          className="button-secondary collection-delete-btn"
          onClick={() => void handleDeleteCollection()}
          disabled={busy}
          title="Delete this collection"
        >
          <Trash2 size={14} />
          <span>Delete collection</span>
        </button>
      </header>

      <section className="saved-places-grid">
        {collection.saves.map((place, idx) => {
          const url = absoluteImageUrl(place.image_url)
          return (
            <article key={place.id} className="saved-place-card">
              <button
                type="button"
                className="saved-place-photo saved-place-photo-button"
                onClick={() => setViewerIndex(idx)}
                aria-label={`View ${place.place_name}`}
              >
                {url ? <img src={url} alt={place.place_name} /> : <div className="saved-place-photo-empty">No image</div>}
              </button>
              <div className="saved-place-body">
                <h3>{place.place_name}</h3>
                <p className="saved-place-loc">
                  {[place.city, place.country].filter(Boolean).join(', ') || 'Location unknown'}
                </p>
                <div className="saved-place-actions">
                  <button
                    type="button"
                    className="button-secondary saved-place-action"
                    onClick={() => setMoveDialogFor(place)}
                    disabled={busy}
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    className="saved-place-delete"
                    onClick={() => void handleDelete(place)}
                    disabled={busy}
                    aria-label="Remove from gallery"
                  >
                    ×
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      {viewerIndex !== null ? (
        <PhotoViewer
          places={collection.saves}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onChange={setViewerIndex}
        />
      ) : null}

      {moveDialogFor ? (
        <MovePlaceDialog
          place={moveDialogFor}
          currentCollection={collection.name}
          otherCollections={otherCollections}
          busy={busy}
          onCancel={() => setMoveDialogFor(null)}
          onMove={(target) => void handleMove(target)}
        />
      ) : null}
    </div>
  )
}

function PhotoViewer({
  places,
  index,
  onClose,
  onChange,
}: {
  places: SavedPlace[]
  index: number
  onClose: () => void
  onChange: (next: number) => void
}) {
  const place = places[index]
  const url = absoluteImageUrl(place?.image_url ?? null)
  const total = places.length

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onChange((index - 1 + total) % total)
      if (e.key === 'ArrowRight') onChange((index + 1) % total)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [index, total, onClose, onChange])

  if (!place) return null

  return (
    <div className="photo-viewer" onClick={onClose}>
      <button
        type="button"
        className="photo-viewer-close"
        onClick={onClose}
        aria-label="Close viewer"
      >
        ×
      </button>

      {total > 1 ? (
        <>
          <button
            type="button"
            className="photo-viewer-arrow photo-viewer-arrow--left"
            onClick={(e) => {
              e.stopPropagation()
              onChange((index - 1 + total) % total)
            }}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            type="button"
            className="photo-viewer-arrow photo-viewer-arrow--right"
            onClick={(e) => {
              e.stopPropagation()
              onChange((index + 1) % total)
            }}
            aria-label="Next"
          >
            ›
          </button>
        </>
      ) : null}

      <div className="photo-viewer-stage" onClick={(e) => e.stopPropagation()}>
        {url ? <img src={url} alt={place.place_name} /> : <div className="photo-viewer-empty">No image</div>}
        <div className="photo-viewer-meta">
          <strong>{place.place_name}</strong>
          <p>{[place.city, place.country].filter(Boolean).join(', ') || 'Location unknown'}</p>
          <span className="photo-viewer-count">{index + 1} / {total}</span>
        </div>
      </div>
    </div>
  )
}

function MovePlaceDialog({
  place,
  currentCollection,
  otherCollections,
  busy,
  onCancel,
  onMove,
}: {
  place: SavedPlace
  currentCollection: string
  otherCollections: string[]
  busy: boolean
  onCancel: () => void
  onMove: (target: string) => void
}) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  return (
    <div className="save-dialog-backdrop" onClick={onCancel}>
      <div className="save-dialog-body save-dialog-floating" onClick={(e) => e.stopPropagation()}>
        <header className="save-dialog-header">
          <h3>Move "{place.place_name}"</h3>
          <button type="button" className="search-modal-close" onClick={onCancel}>×</button>
        </header>
        <p className="save-dialog-label">From: {currentCollection}</p>

        {!creating ? (
          <>
            {otherCollections.length > 0 ? (
              <div className="save-dialog-collections">
                {otherCollections.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="save-dialog-collection-pill"
                    disabled={busy}
                    onClick={() => onMove(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="save-dialog-empty">No other collections yet. Create one below.</p>
            )}
            <button type="button" className="save-dialog-new-link" onClick={() => setCreating(true)}>
              + New collection
            </button>
          </>
        ) : (
          <div className="save-dialog-new-row">
            <input
              type="text"
              autoFocus
              placeholder="e.g. Tokyo 2024"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="button" className="button-secondary" onClick={() => setCreating(false)}>Cancel</button>
            <button
              type="button"
              className="button-primary"
              disabled={busy || !newName.trim()}
              onClick={() => onMove(newName.trim())}
            >
              Create & move
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
