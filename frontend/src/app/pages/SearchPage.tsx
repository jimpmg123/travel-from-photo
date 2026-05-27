import { useEffect, useState, type ChangeEvent } from 'react'

import { analyzeSearchUploads } from '../search/api'
import { buildSearchResultBundle, formatFileSize, maxUploadSizeBytes } from '../search/data'
import type { SearchPageProps, SearchUploadItem } from '../search/types'
import { getUploadValidationError } from '../search/utils'

export function SearchPage({ onRunSearch }: SearchPageProps) {
  const [countryHint, setCountryHint] = useState('')
  const [cityHint, setCityHint] = useState('')
  const [uploads, setUploads] = useState<SearchUploadItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const isReady = uploads.length > 0 && !isSearching

  useEffect(() => {
    return () => {
      uploads.forEach((upload) => URL.revokeObjectURL(upload.previewUrl))
    }
  }, [uploads])

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

  const handleSearch = async () => {
    if (uploads.length === 0) {
      setUploadError('Upload at least one travel image before running the image search.')
      return
    }

    setUploadError('')

    setIsSearching(true)

    try {
      const country = countryHint.trim()
      const city = cityHint.trim()
      const analyses = await analyzeSearchUploads(uploads, {
        countryHint: country,
        cityHint: city,
      })

      onRunSearch({
        countryHint: country,
        cityHint: city,
        uploads,
        analyses,
        bundle: buildSearchResultBundle({
          countryHint: country,
          cityHint: city,
          uploads,
          analyses,
        }),
      })
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="search-main-shell search-main-shell--hero">
      <section className="search-hero-shell">
        <div className="search-hero-copy">
          <h1 className="search-page-title">Search</h1>
          <p className="search-page-subtitle">
            Upload a travel photo and we'll identify where it was taken — landmarks,
            shops, streets — using a fusion of vision APIs and AI reasoning.
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
              <strong>Tip:</strong> add a country or city hint, and upload multiple
              photos from the same trip — both noticeably improve accuracy.
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

          <div className="field-grid search-hint-grid">
            <label className="field">
              <span>Country</span>
              <input
                type="text"
                value={countryHint}
                onChange={(event) => setCountryHint(event.target.value)}
                placeholder="Japan"
              />
            </label>
            <label className="field">
              <span>City</span>
              <input
                type="text"
                value={cityHint}
                onChange={(event) => setCityHint(event.target.value)}
                placeholder="Kyoto"
              />
            </label>
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
