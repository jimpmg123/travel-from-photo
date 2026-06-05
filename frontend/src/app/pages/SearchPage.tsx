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

      {/* Polaroid wall decoration — desktop only, aria-hidden */}
      <div className="polaroid-scene" aria-hidden="true">
        <svg
          className="polaroid-strings"
          viewBox="0 0 1400 700"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="700" cy="22" r="5" fill="#A07840" opacity="0.65" />
          <path d="M 700,22 Q 430,92 158,168" stroke="#A07840" strokeWidth="1.4" fill="none" opacity="0.45" />
          <path d="M 700,22 Q 530,144 320,256" stroke="#A07840" strokeWidth="1.4" fill="none" opacity="0.45" />
          <path d="M 700,22 Q 870,144 1080,256" stroke="#A07840" strokeWidth="1.4" fill="none" opacity="0.45" />
          <path d="M 700,22 Q 970,92 1242,168" stroke="#A07840" strokeWidth="1.4" fill="none" opacity="0.45" />
          <circle cx="158" cy="168" r="3" fill="#A07840" opacity="0.5" />
          <circle cx="320" cy="256" r="3" fill="#A07840" opacity="0.5" />
          <circle cx="1080" cy="256" r="3" fill="#A07840" opacity="0.5" />
          <circle cx="1242" cy="168" r="3" fill="#A07840" opacity="0.5" />
        </svg>

        <div className="polaroid polaroid--left-far">
          <div className="polaroid-photo polaroid-photo--city" />
          <p className="polaroid-caption">night city</p>
        </div>
        <div className="polaroid polaroid--left-near">
          <div className="polaroid-photo polaroid-photo--ocean" />
          <p className="polaroid-caption">santorini</p>
        </div>
        <div className="polaroid polaroid--right-near">
          <div className="polaroid-photo polaroid-photo--mountain" />
          <p className="polaroid-caption">kyoto</p>
        </div>
        <div className="polaroid polaroid--right-far">
          <div className="polaroid-photo polaroid-photo--sunset" />
          <p className="polaroid-caption">golden hour</p>
        </div>
      </div>

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
