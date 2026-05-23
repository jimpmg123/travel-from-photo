import { useEffect, useState } from 'react'
import { Check, Loader2, RotateCcw, Sparkles } from 'lucide-react'

import type { GalleryImage } from '../types'

type ImageModalProps = {
  image: GalleryImage | null
  images: GalleryImage[]
  onClose: () => void
  onNavigate: (direction: 'prev' | 'next') => void
}

type VerifyStatus = 'idle' | 'verifying' | 'confirmed' | 'updated'

export function ImageModal({ image, images, onClose, onNavigate }: ImageModalProps) {
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')

  useEffect(() => {
    setVerifyStatus('idle')
  }, [image?.id])

  if (!image) {
    return null
  }

  const currentIndex = images.findIndex((item) => item.id === image.id)

  const handleVerify = () => {
    if (verifyStatus === 'verifying') return
    setVerifyStatus('verifying')
    window.setTimeout(() => {
      setVerifyStatus(image.id % 2 === 0 ? 'confirmed' : 'updated')
    }, 1500)
  }

  const renderVerifyButton = () => {
    if (verifyStatus === 'verifying') {
      return (
        <button type="button" className="verify-location-button is-busy" disabled>
          <Loader2 size={14} className="verify-spinner" />
          <span>Verifying…</span>
        </button>
      )
    }

    if (verifyStatus === 'confirmed') {
      return (
        <button type="button" className="verify-location-button is-confirmed" onClick={handleVerify}>
          <Check size={14} />
          <span>Location verified</span>
        </button>
      )
    }

    if (verifyStatus === 'updated') {
      return (
        <button type="button" className="verify-location-button is-updated" onClick={handleVerify}>
          <Sparkles size={14} />
          <span>Updated estimate ready</span>
        </button>
      )
    }

    return (
      <button type="button" className="verify-location-button" onClick={handleVerify}>
        <RotateCcw size={14} />
        <span>Verify location</span>
      </button>
    )
  }

  return (
    <div className="image-modal-overlay" onClick={onClose}>
      <div className="image-modal" onClick={(event) => event.stopPropagation()}>
        <div className="image-modal-close-row">
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close image modal">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6.7 5.64 12 10.94l5.3-5.3 1.06 1.06-5.3 5.3 5.3 5.3-1.06 1.06-5.3-5.3-5.3 5.3-1.06-1.06 5.3-5.3-5.3-5.3 1.06-1.06Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        <div className={`image-modal-preview photo-frame photo-frame--${image.theme}`}>
          <div className="image-modal-preview-copy">
            <div className="image-modal-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Zm4.55 4.35a1.3 1.3 0 1 0-1.3-1.3 1.3 1.3 0 0 0 1.3 1.3Zm8.25 6.65-3.25-4.1a1.1 1.1 0 0 0-1.7 0l-2.05 2.57-1-1.22a1.1 1.1 0 0 0-1.7.02L5.7 17.5h11.1Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <p>Large preview: {image.title}</p>
          </div>

          <button
            type="button"
            className="image-modal-nav image-modal-nav--left"
            onClick={() => onNavigate('prev')}
            aria-label="Previous image"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m14.7 17.3-5.3-5.3 5.3-5.3 1.06 1.06L11.53 12l4.23 4.24-1.06 1.06Z" fill="currentColor" />
            </svg>
          </button>

          <button
            type="button"
            className="image-modal-nav image-modal-nav--right"
            onClick={() => onNavigate('next')}
            aria-label="Next image"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9.3 17.3-1.06-1.06L12.47 12 8.24 7.76 9.3 6.7l5.3 5.3-5.3 5.3Z" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div className="image-modal-meta">
          <div className="image-modal-meta-headline">
            <h3>{image.title}</h3>
            {renderVerifyButton()}
          </div>
          <div className="image-modal-meta-row">
            <span>{image.date}</span>
            <span>{image.category}</span>
            <span>
              Image {currentIndex + 1} of {images.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
