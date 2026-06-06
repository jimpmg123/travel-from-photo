import { useEffect, useState, type ChangeEvent } from 'react'
import {
  BookText,
  Brain,
  Building2,
  Satellite,
  Target,
  Upload,
} from 'lucide-react'

import { useLanguage } from '../context/LanguageContext'
import { getTranslation } from '../i18n/translations'
import { SearchLoadingOverlay } from '../search/components/SearchLoadingOverlay'
import { formatFileSize } from '../search/data'
import type { SearchPageProps, SearchUploadItem } from '../search/types'
import { getUploadValidationError } from '../search/utils'

const STEP_ICONS = [
  <Upload size={20} />,
  <Satellite size={20} />,
  <Building2 size={20} />,
  <Brain size={20} />,
  <Target size={20} />,
  <BookText size={20} />,
]

function ScrollArrow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="snap-arrow" onClick={onClick} aria-label={label}>
      <span className="snap-arrow-label">{label}</span>
      <span className="snap-arrow-rail" aria-hidden="true">
        <span className="snap-arrow-dot" />
        <span className="snap-arrow-tip" />
      </span>
    </button>
  )
}

function scrollSnapNext() {
  const ps = document.querySelector('.page-surface')
  if (ps) ps.scrollBy({ top: ps.clientHeight, behavior: 'smooth' })
}

export function SearchPage({ onStartSearch, isSearching }: SearchPageProps) {
  const [hint, setHint] = useState('')
  const [uploads, setUploads] = useState<SearchUploadItem[]>([])
  const [uploadError, setUploadError] = useState('')
  const { language } = useLanguage()
  const t = getTranslation(language)

  useEffect(() => {
    const ps = document.querySelector('.page-surface') as HTMLElement | null
    if (!ps) return

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    const rafId = requestAnimationFrame(() => {
      const offset = Math.round(ps.getBoundingClientRect().top)
      ps.style.setProperty('--snap-offset', `${offset}px`)
      ps.classList.add('snap-mode')
    })

    return () => {
      cancelAnimationFrame(rafId)
      ps.classList.remove('snap-mode')
      ps.style.removeProperty('--snap-offset')
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  const isReady = uploads.length > 0 && !isSearching

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

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

  const handleImageAdd = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    const firstInvalidFile = files.find((file) => getUploadValidationError(file))
    if (firstInvalidFile) {
      setUploadError(getUploadValidationError(firstInvalidFile) ?? 'Image upload failed.')
      event.target.value = ''
      return
    }

    const base = uploads.length
    setUploads((prev) => [
      ...prev,
      ...files.map((file, index) => ({
        id: `${file.name}-${file.size}-${base + index}`,
        fileName: file.name,
        fileSizeBytes: file.size,
        fileSizeLabel: formatFileSize(file.size),
        previewUrl: URL.createObjectURL(file),
        file,
      })),
    ])
    setUploadError('')
  }

  const handleSearch = () => {
    if (uploads.length === 0) {
      setUploadError(t.uploadAtLeastOne)
      return
    }
    setUploadError('')
    onStartSearch({ uploads, hint: hint.trim() })
  }

  return (
    <>
      {/* ── Section 1: Hero ── */}
      <div className="search-main-shell search-main-shell--hero">
        {isSearching ? <SearchLoadingOverlay /> : null}

        <div className="pol-col pol-col--left" aria-hidden="true">
          <div className="new-pol pol-left-2">
            <div className="new-pol-clip" />
            <img
              src="https://images.unsplash.com/photo-1663071999931-dccb6c9cf0e7?w=400&q=75"
              alt=""
              className="new-pol-photo"
              loading="lazy"
              draggable={false}
            />
            <p className="new-pol-caption">mountain view</p>
          </div>
          <div className="new-pol pol-left-1">
            <div className="new-pol-clip" />
            <img
              src="https://images.unsplash.com/photo-1683009427590-dd987135e66c?w=400&q=75"
              alt=""
              className="new-pol-photo"
              loading="lazy"
              draggable={false}
            />
            <p className="new-pol-caption">desert</p>
          </div>
        </div>

        <section className="search-hero-shell">
          <div className="search-hero-copy">
            <h1 className="search-page-title">
              {t.heroLine1}
              <br />
              <span className="search-page-title-accent">{t.heroLine2}</span>
            </h1>
            <p className="search-page-subtitle search-subtitle-hide-mobile">
              {t.heroSubtitle}
            </p>
          </div>

          <article className="panel content-panel search-entry-card search-entry-card--hero">
            <p className="search-hint-note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>{t.uploadTip}</span>
            </p>

            <label className="upload-zone upload-zone--hero">
              {uploads.length === 0 ? (
                <>
                  <span className="zone-kicker">{t.uploadKicker}</span>
                  <strong>{t.uploadTitle}</strong>
                  <p>{t.uploadSubtitle}</p>
                  <div className="upload-actions upload-actions--hero">
                    <span className="upload-picker">
                      <input type="file" accept="image/*" multiple onChange={handleImageUpload} />
                      {t.uploadChoose}
                    </span>
                    <span className="upload-status">{t.uploadMaxSize}</span>
                  </div>
                </>
              ) : (
                <div className="upload-thumb-strip">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="upload-thumb-input"
                    onChange={handleImageAdd}
                  />
                  <div className="upload-thumb-row">
                    {uploads.map((upload) => (
                      <img
                        key={upload.id}
                        src={upload.previewUrl}
                        alt={upload.fileName}
                        className="upload-thumb-img"
                        draggable={false}
                      />
                    ))}
                    <span className="upload-thumb-add" aria-hidden="true">+</span>
                  </div>
                  <span className="upload-thumb-meta">
                    {uploads.length} image{uploads.length > 1 ? 's' : ''} ready
                  </span>
                </div>
              )}
            </label>

            <div className="search-hint-field">
              <label className="search-hint-label" htmlFor="search-hint-input">
                <span className="search-hint-label-text">{t.hintLabel}</span>
                <span className="search-hint-label-opt">{t.hintOptional}</span>
              </label>
              <textarea
                id="search-hint-input"
                className="search-hint-textarea"
                value={hint}
                onChange={(event) => setHint(event.target.value)}
                placeholder={t.hintPlaceholder}
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
                {isSearching ? t.runningSearch : t.runSearch}
              </button>
            </div>
          </article>
        </section>

        <div className="pol-col pol-col--right" aria-hidden="true">
          <div className="new-pol pol-right-1">
            <div className="new-pol-clip" />
            <img
              src="https://images.unsplash.com/photo-1643892151836-07fe5562d0f2?w=400&q=75"
              alt=""
              className="new-pol-photo"
              loading="lazy"
              draggable={false}
            />
            <p className="new-pol-caption">rock formation</p>
          </div>
          <div className="new-pol pol-right-2">
            <div className="new-pol-clip" />
            <img
              src="https://images.unsplash.com/photo-1708037429826-de89ac0dd6c7?w=400&q=75"
              alt=""
              className="new-pol-photo"
              loading="lazy"
              draggable={false}
            />
            <p className="new-pol-caption">coastal city</p>
          </div>
        </div>

        {!isSearching && (
          <ScrollArrow label={t.arrowHowItWorks} onClick={scrollSnapNext} />
        )}
      </div>

      {/* ── Section 2: How it works ── */}
      <section className="landing-info-shell">
        <div className="landing-info-inner">
          <div className="how-it-works">
            <p className="how-it-works-eyebrow">{t.howItWorksPipeline}</p>
            <h2 className="how-it-works-title">{t.howItWorksTitle}</h2>
            <div className="how-it-works-steps">
              {t.steps.map((step, i) => (
                <div key={i} className="step-card">
                  <div className="step-number">{String(i + 1).padStart(2, '0')}</div>
                  <div className="step-icon">{STEP_ICONS[i]}</div>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-desc">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <ScrollArrow label={t.arrowServiceIntro} onClick={scrollSnapNext} />
      </section>

      {/* ── Section 3: About us ── */}
      <section className="landing-info-shell landing-info-shell--last">
        <div className="landing-info-inner">
          <div className="service-intro">
            <h2 className="service-intro-title">{t.serviceTitle}</h2>
            <p className="service-intro-body">{t.serviceBody}</p>
            <div className="service-intro-tags">
              {t.serviceTags.map((tag) => (
                <span key={tag} className="service-tag">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
