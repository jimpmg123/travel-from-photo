import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useSavedPlaces } from '../hooks/useSavedPlaces'
import { absoluteImageUrl } from '../services/galleryApi'

export function GalleryPage() {
  const navigate = useNavigate()
  const { collections, loading, error, createEmptyCollection, deleteCollection } = useSavedPlaces()
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [deletingName, setDeletingName] = useState<string | null>(null)

  const handleCreate = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    createEmptyCollection(trimmed)
    setNewName('')
    setShowNewDialog(false)
  }

  const handleDeleteCollection = async (name: string, count: number) => {
    const msg = count === 0
      ? `Delete empty collection "${name}"?`
      : `Delete "${name}" and all ${count} place${count === 1 ? '' : 's'} in it? This cannot be undone.`
    if (!window.confirm(msg)) return
    setDeletingName(name)
    try {
      await deleteCollection(name)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete collection')
    } finally {
      setDeletingName(null)
    }
  }

  if (loading) {
    return (
      <div className="gallery-page-shell">
        <p className="gallery-empty-line">Loading gallery...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="gallery-page-shell">
        <div className="gallery-empty">
          <strong>Could not load gallery</strong>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="gallery-page-shell">
      <header className="gallery-page-header">
        <div>
          <h2>Your Gallery</h2>
          <p>{collections.length} collection{collections.length === 1 ? '' : 's'}</p>
        </div>
        <button
          type="button"
          className="button-primary gallery-new-collection-btn"
          onClick={() => setShowNewDialog(true)}
        >
          + New collection
        </button>
      </header>

      {collections.length === 0 ? (
        <div className="gallery-empty">
          <strong>No saved places yet</strong>
          <p>
            Run a search and click <em>Save to Gallery</em> on a result, or create an empty collection above.
          </p>
        </div>
      ) : (
        <section className="gallery-grid gallery-grid--groups">
          {collections.map((col) => {
            const cover = col.saves[0]
            const coverUrl = absoluteImageUrl(cover?.image_url ?? null)
            const countries = Array.from(
              new Set(col.saves.map((s) => s.country).filter(Boolean) as string[]),
            )
            return (
              <div key={col.name} className="gallery-collection-card-wrap">
                <button
                  type="button"
                  className="gallery-collection-card"
                  onClick={() => navigate(`/gallery/collection/${encodeURIComponent(col.name)}`)}
                >
                  <div className="gallery-collection-cover">
                    {coverUrl ? (
                      <img src={coverUrl} alt={col.name} />
                    ) : (
                      <div className="gallery-collection-cover-empty">Empty collection</div>
                    )}
                  </div>
                  <div className="gallery-collection-meta">
                    <h3>{col.name}</h3>
                    <p>
                      {col.saves.length} place{col.saves.length === 1 ? '' : 's'}
                      {countries.length > 0 ? ` · ${countries.slice(0, 2).join(', ')}` : ''}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  className="gallery-collection-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleDeleteCollection(col.name, col.saves.length)
                  }}
                  disabled={deletingName === col.name}
                  aria-label={`Delete collection ${col.name}`}
                  title="Delete collection"
                >
                  ×
                </button>
              </div>
            )
          })}
        </section>
      )}

      {showNewDialog ? (
        <div className="save-dialog-backdrop" onClick={() => setShowNewDialog(false)}>
          <div className="save-dialog-body save-dialog-floating" onClick={(e) => e.stopPropagation()}>
            <header className="save-dialog-header">
              <h3>New collection</h3>
              <button type="button" className="search-modal-close" onClick={() => setShowNewDialog(false)}>×</button>
            </header>
            <div className="save-dialog-new-row">
              <input
                type="text"
                autoFocus
                placeholder="e.g. Tokyo 2024"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') setShowNewDialog(false)
                }}
              />
              <button
                type="button"
                className="button-primary"
                disabled={!newName.trim()}
                onClick={handleCreate}
              >
                Create
              </button>
            </div>
            <p className="save-dialog-empty">
              Empty collection is kept locally until you save your first place into it.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
