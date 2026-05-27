import { useState, type ChangeEvent } from 'react'

import { SectionIntro } from '../components/SectionIntro'
import { formatFileSize, maxUploadSizeBytes } from '../search/data'
import type { SearchPageProps, SearchUploadItem } from '../search/types'
import { getUploadValidationError } from '../search/utils'

export function SearchPage({ onRunSearch, onOpenPage }: SearchPageProps) {
  const [countryHint, setCountryHint] = useState('')
  const [cityHint, setCityHint] = useState('')
  const [uploads, setUploads] = useState<SearchUploadItem[]>([])
  const [uploadError, setUploadError] = useState('')

  const isReady = uploads.length > 0 && countryHint.trim().length > 0

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])

    if (files.length === 0) {
      return
    }

    const firstInvalidFile = files.find((file) => getUploadValidationError(file))

    if (firstInvalidFile) {
      setUploads([])
      setUploadError(getUploadValidationError(firstInvalidFile) ?? 'Image upload failed.')
      event.target.value = ''
      return
    }

    setUploads(
      files.map((file, index) => ({
        id: `${file.name}-${file.size}-${index}`,
        fileName: file.name,
        fileSizeBytes: file.size,
        fileSizeLabel: formatFileSize(file.size),
      })),
    )
    setUploadError('')
  }

  const handleSearch = () => {
    if (!countryHint.trim()) {
      setUploadError(
        'Country hint is required because every inferred location is validated against it.',
      )
      return
    }

    if (uploads.length === 0) {
      setUploadError('Upload at least one travel image before running the search flow.')
      return
    }

    setUploadError('')
    onRunSearch({
      countryHint: countryHint.trim(),
      cityHint: cityHint.trim(),
      uploads,
    })
  }

  return (
    <div className="stack-xl search-main-shell">
      <section className="search-page-header">
        <p className="eyebrow">Search</p>
        <h2>Travel from Photo</h2>
        <p className="section-copy">
          Upload one or more travel images, add country and city hints, and stage the temporary
          frontend flow for EXIF extraction, landmark recognition, CLIP scene cues, and OpenAI
          fallback inference.
        </p>
      </section>

      <section className="search-entry-layout">
        <article className="panel content-panel search-entry-card">
          <SectionIntro
            title="Travel image intake"
            detail="Food-photo handling is removed. This screen is focused only on travel-photo based location recovery."
          />

          <label className="upload-zone upload-zone--large">
            <span className="zone-kicker">Multi-image upload</span>
            <strong>Drop travel images here or choose multiple files</strong>
            <p>
              The real backend will run EXIF first, then landmark recognition, then CLIP and
              OpenAI fallback only for unresolved images.
            </p>
            <div className="upload-actions">
              <span className="upload-picker">
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} />
                Choose images
              </span>
              <span className={`upload-status ${uploads.length > 0 ? 'is-ready' : ''}`}>
                {uploads.length > 0
                  ? `${uploads.length} image${uploads.length > 1 ? 's' : ''} ready`
                  : `Any image file up to ${Math.round(maxUploadSizeBytes / (1024 * 1024))}MB per file is accepted in this temporary flow.`}
              </span>
            </div>
          </label>

          {uploads.length > 0 ? (
            <div className="upload-list">
              {uploads.map((upload) => (
                <div key={upload.id} className="upload-list-item">
                  <strong>{upload.fileName}</strong>
                  <span>{upload.fileSizeLabel}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="field-grid">
            <label className="field">
              <span>Country hint</span>
              <input
                type="text"
                value={countryHint}
                onChange={(event) => setCountryHint(event.target.value)}
                placeholder="Japan"
              />
            </label>
            <label className="field">
              <span>City hint</span>
              <input
                type="text"
                value={cityHint}
                onChange={(event) => setCityHint(event.target.value)}
                placeholder="Kyoto"
              />
            </label>
          </div>

          {uploadError ? <p className="field-error">{uploadError}</p> : null}

          <div className="search-entry-footer">
            <button
              type="button"
              className="button-secondary"
              onClick={() => onOpenPage('travelize-1')}
            >
              Open Travelize
            </button>
            <button
              type="button"
              className="button-primary"
              onClick={handleSearch}
              disabled={!isReady}
            >
              Run temporary search
            </button>
          </div>
        </article>
      </section>

      <section className="search-pipeline-grid">
        <article className="panel content-panel result-card">
          <span className="metric-label">Stage 1</span>
          <strong className="metric-value">EXIF service</strong>
          <p>
            Extract metadata from every uploaded image and save GPS immediately when it already
            exists.
          </p>
        </article>

        <article className="panel content-panel result-card">
          <span className="metric-label">Stage 2</span>
          <strong className="metric-value">Landmark recognition</strong>
          <p>
            Run only for images with missing GPS metadata and check whether the top candidate fits
            the hinted country.
          </p>
        </article>

        <article className="panel content-panel result-card">
          <span className="metric-label">Stage 3</span>
          <strong className="metric-value">CLIP + OpenAI</strong>
          <p>
            Use scene understanding and language reasoning as the fallback path when landmark
            recognition fails.
          </p>
        </article>

        <article className="panel content-panel result-card">
          <span className="metric-label">Stage 4</span>
          <strong className="metric-value">Backend image update</strong>
          <p>
            Store latitude and longitude only when the resolved location can be accepted inside the
            user hint country.
          </p>
        </article>
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">Output</p>
          <h2>What the temporary results page will show</h2>
        </div>
        <p className="section-copy">
          The next screen lists each uploaded image, the source that resolved it, whether its
          coordinates were saved, and the temporary address shown to the user.
        </p>
      </section>
    </div>
  )
}
