import { useState, type ChangeEvent } from 'react'

import { SearchLoadingOverlay } from '../search/components/SearchLoadingOverlay'
import { formatFileSize, maxUploadSizeBytes } from '../search/data'
import type { SearchPageProps, SearchUploadItem } from '../search/types'
import { getUploadValidationError } from '../search/utils'

export function SearchPage({ onStartSearch, isSearching }: SearchPageProps) {
  const [hint, setHint] = useState('')
  const [uploads, setUploads] = useState<SearchUploadItem[]>([])
  const [uploadError, setUploadError] = useState('')

  const isReady = uploads.length > 0 && !isSearching

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])

    if (files.length === 0) {
      return
    }

    const firstInvalidFile = files.find((file) => getUploadValidationError(file))

    if (firstInvalidFile) {
      uploads.forEach((upload) => URL.revokeObjectURL(upload.previewUrl))
      setUploads([])
      setUploadError(getUploadValidationError(firstInvalidFile) ?? 'Image upload failed.')
      event.target.value = ''
      return
    }

    uploads.forEach((upload) => URL.revokeObjectURL(upload.previewUrl))
    setUploads(
      files.map((file, index) => ({
        id: `${file.name}-${file.size}-${index}`,
        fileName: file.name,
        fileSizeBytes: file.size,
        fileSizeLabel: formatFileSize(file.size),
        previewUrl: URL.createObjectURL(file),
        file,
      })),
    )
    setUploadError('')
  }

  const handleSearch = () => {
    if (uploads.length === 0) {
      setUploadError('Upload at least one travel image before running the image search.')
      return
    }
    setUploadError('')
    onStartSearch({
      uploads,
      hint: hint.trim(),
    })
  }

  return (
    <div className="search-main-shell search-main-shell--hero">
      {isSearching ? <SearchLoadingOverlay /> : null}
      <section className="search-hero-shell">
        <div className="search-hero-copy">
          <h1 className="search-page-title">
            Show us a photo.
            <br />
            <span className="search-page-title-accent">We'll find where you've been.</span>
          </h1>
          <p className="search-page-subtitle search-subtitle-hide-mobile">
            Upload any travel photo — we pinpoint the location using landmark detection,
            visual AI, and GPS metadata. Then we help you build a travel journal.
          </p>
        </div>

        <article className="panel content-panel search-entry-card search-entry-card--hero">
          <p className="search-hint-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              <strong>Tip:</strong> uploading multiple photos from the same trip noticeably improves accuracy.
            </span>
          </p>

          <label className="upload-zone upload-zone--hero">
            <span className="zone-kicker">Photo upload</span>
            <strong>Drop your photo here</strong>
            <p>or click to browse from your device</p>
            <div className="upload-actions upload-actions--hero">
              <span className="upload-picker">
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} />
                Choose images
              </span>
              <span className={`upload-status ${uploads.length > 0 ? 'is-ready' : ''}`}>
                {uploads.length > 0
                  ? `${uploads.length} image${uploads.length > 1 ? 's' : ''} ready`
                  : `Up to ${Math.round(maxUploadSizeBytes / (1024 * 1024))}MB per image.`}
              </span>
            </div>
          </label>

          {uploads.length > 0 ? (
            <div className="upload-list">
              {uploads.map((upload) => (
                <div key={upload.id} className="upload-list-item">
                  <div className="upload-list-item-main">
                    <img
                      src={upload.previewUrl}
                      alt={upload.fileName}
                      className="upload-list-item-thumb"
                    />
                    <div className="upload-list-item-copy">
                      <strong>{upload.fileName}</strong>
                      <span>{upload.fileSizeLabel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="search-hint-field">
            <label className="search-hint-label" htmlFor="search-hint-input">
              <span className="search-hint-label-text">// Hint for AI</span>
              <span className="search-hint-label-opt">optional</span>
            </label>
            <textarea
              id="search-hint-input"
              className="search-hint-textarea"
              value={hint}
              onChange={(event) => setHint(event.target.value)}
              placeholder="e.g. Shot in Japan in summer 2023, near a canal in Amsterdam, café district..."
              rows={2}
            />
          </div>

          {uploadError ? <p className="field-error">{uploadError}</p> : null}

          <div className="search-entry-footer search-entry-footer--hero">
            <button
              type="button"
              className="button-primary"
              onClick={handleSearch}
              disabled={!isReady}
            >
              {isSearching ? 'Running search...' : 'Run search'}
            </button>
          </div>
        </article>
      </section>
    </div>
  )
}
