import React from 'react'

type JournalSegmentCard = {
  id: string
  imageUrls: string[]
  segmentType: string
  isInferred: boolean
  city: string
  location: string
  startTime: string
  endTime: string
  durationMinutes: number | null
  photoCount: number
  travelMode: string | null
  travelDistanceKm: number | null
}

interface JournalResultProps {
  segments: JournalSegmentCard[]
  rejectedCount: number
  observationCount: number
  onDiscard: () => void
}

export const JournalResult: React.FC<JournalResultProps> = ({
  segments,
  rejectedCount,
  observationCount,
  onDiscard,
}) => {
  const [activeSegmentIndex, setActiveSegmentIndex] = React.useState<number | null>(null)
  const [activeImageIndex, setActiveImageIndex] = React.useState(0)

  const activeSegment = activeSegmentIndex === null ? null : segments[activeSegmentIndex]
  const activeImageUrl =
    activeSegment && activeSegment.imageUrls.length > 0
      ? activeSegment.imageUrls[activeImageIndex]
      : null

  const openLightbox = (segmentIndex: number) => {
    setActiveSegmentIndex(segmentIndex)
    setActiveImageIndex(0)
  }

  const closeLightbox = () => {
    setActiveSegmentIndex(null)
    setActiveImageIndex(0)
  }

  const showPreviousImage = () => {
    if (!activeSegment || activeSegment.imageUrls.length <= 1) {
      return
    }

    setActiveImageIndex((current) =>
      current === 0 ? activeSegment.imageUrls.length - 1 : current - 1,
    )
  }

  const showNextImage = () => {
    if (!activeSegment || activeSegment.imageUrls.length <= 1) {
      return
    }

    setActiveImageIndex((current) =>
      current === activeSegment.imageUrls.length - 1 ? 0 : current + 1,
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: '30px',
          paddingBottom: '20px',
          borderBottom: '1px solid #eaeaea',
        }}
      >
        <div>
          <h2
            style={{ fontSize: '22px', fontWeight: 'bold', color: '#26215C', marginBottom: '12px' }}
          >
            Journal preview timeline
          </h2>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            {segments.length} segments, {observationCount} observations, {rejectedCount} rejected
            images
          </p>
        </div>

        <button
          onClick={onDiscard}
          style={{
            padding: '10px 20px',
            backgroundColor: '#f1f3f5',
            color: '#495057',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
          }}
        >
          Back
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {segments.length === 0 && (
          <div
            style={{
              padding: '24px',
              border: '1px dashed #ced4da',
              borderRadius: '12px',
              color: '#666',
              backgroundColor: '#fafafa',
              textAlign: 'center',
            }}
          >
            No journal segments were created from the uploaded files.
          </div>
        )}

        {segments.map((segment, segmentIndex) => (
          <div
            key={segment.id}
            style={{
              display: 'flex',
              gap: '20px',
              padding: segment.segmentType === 'transit' ? '16px 20px' : '20px',
              border: '1px solid #E1F5EE',
              borderRadius: '12px',
              backgroundColor: segment.segmentType === 'transit' ? '#f5fbf8' : '#fafafa',
              alignItems: segment.segmentType === 'transit' ? 'center' : 'stretch',
            }}
          >
            {segment.segmentType !== 'transit' && segment.imageUrls[0] && (
              <img
                src={segment.imageUrls[0]}
                alt={segment.location}
                onClick={() => openLightbox(segmentIndex)}
                style={{
                  width: '120px',
                  height: '120px',
                  objectFit: 'cover',
                  borderRadius: '10px',
                  cursor: 'zoom-in',
                }}
              />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: '#534AB7', fontWeight: 'bold' }}>
                  {segment.city}
                </span>
                <span style={{ fontSize: '12px', color: '#888' }}>
                  {segment.segmentType}
                  {segment.isInferred ? ' inferred' : ''}
                </span>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <strong style={{ display: 'block', fontSize: '16px', color: '#26215C' }}>
                  {segment.location}
                </strong>
                <span style={{ fontSize: '13px', color: '#666' }}>
                  {segment.startTime} to {segment.endTime}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#EEEDFE',
                    color: '#534AB7',
                    fontSize: '12px',
                    borderRadius: '20px',
                    fontWeight: 'bold',
                  }}
                >
                  {segment.durationMinutes === null ? 'Unknown' : `${segment.durationMinutes} min`}
                </span>

                {segment.segmentType === 'transit' ? (
                  <>
                    <span
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#E9F7F2',
                        color: '#0F6E56',
                        fontSize: '12px',
                        borderRadius: '20px',
                        fontWeight: 'bold',
                      }}
                    >
                      {segment.travelMode === 'walk' ? 'Walk 6 km/h' : 'Taxi 40 km/h'}
                    </span>
                    {segment.travelDistanceKm !== null && (
                      <span
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#F3F4F6',
                          color: '#495057',
                          fontSize: '12px',
                          borderRadius: '20px',
                          fontWeight: 'bold',
                        }}
                      >
                        {segment.travelDistanceKm} km
                      </span>
                    )}
                  </>
                ) : (
                  <span
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#E1F5EE',
                      color: '#0F6E56',
                      fontSize: '12px',
                      borderRadius: '20px',
                      fontWeight: 'bold',
                    }}
                  >
                    {segment.photoCount} photos
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeSegment && activeImageUrl && (
        <div
          onClick={closeLightbox}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '32px',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          >
            {activeSegment.imageUrls.length > 1 && (
              <button
                onClick={showPreviousImage}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: 'rgba(255,255,255,0.92)',
                  color: '#26215C',
                  fontSize: '22px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ‹
              </button>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
              <img
                src={activeImageUrl}
                alt={activeSegment.location}
                style={{
                  maxWidth: 'min(80vw, 960px)',
                  maxHeight: '75vh',
                  borderRadius: '12px',
                  objectFit: 'contain',
                  backgroundColor: '#111',
                }}
              />

              {activeSegment.imageUrls.length > 1 && (
                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    color: '#26215C',
                    fontSize: '13px',
                    fontWeight: 'bold',
                  }}
                >
                  {activeImageIndex + 1} / {activeSegment.imageUrls.length}
                </div>
              )}
            </div>

            {activeSegment.imageUrls.length > 1 && (
              <button
                onClick={showNextImage}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: 'rgba(255,255,255,0.92)',
                  color: '#26215C',
                  fontSize: '22px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ›
              </button>
            )}

            <button
              onClick={closeLightbox}
              style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                width: '36px',
                height: '36px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: 'rgba(255,255,255,0.95)',
                color: '#26215C',
                fontSize: '18px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
