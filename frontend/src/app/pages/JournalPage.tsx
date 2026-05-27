import React, { useState } from 'react'

import { JournalResult } from '../components/JournalResult'
import { JournalUpload } from '../components/JournalUpload'
import { previewJournalFromAPI } from '../services/journalApi'
import type { JournalPreviewResponse } from '../services/journalApi'

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

const containsNonLatin = (value: string) => /[^\u0000-\u024f]/.test(value)

const buildDisplayLocation = (
  location: string,
  formattedAddress: string | null,
  englishLocationHint: string | null,
  city: string,
) => {
  if (!location) {
    return city || 'Unknown location'
  }

  const addressLabel = formattedAddress || englishLocationHint

  if (
    containsNonLatin(location) &&
    addressLabel &&
    addressLabel.toLowerCase() !== location.toLowerCase()
  ) {
    return `${location} (${addressLabel})`
  }

  return location
}

const formatDateTime = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString()
}

export const JournalPage: React.FC = () => {
  const [step, setStep] = useState<'upload' | 'loading' | 'result'>('upload')
  const [preview, setPreview] = useState<JournalPreviewResponse | null>(null)
  const [segmentCards, setSegmentCards] = useState<JournalSegmentCard[]>([])

  const openPreviewResult = () => {
    setPreview({
      eligible_images: [],
      rejected_images: [],
      observations: [],
      segments: [],
      counts: {
        eligible_images: 0,
        rejected_images: 0,
        observations: 0,
        segments: 2,
      },
    })
    setSegmentCards([
      {
        id: 'preview-1',
        imageUrls: ['https://placehold.co/320x240?text=Stay+Segment'],
        segmentType: 'stay',
        isInferred: false,
        city: 'Kyoto',
        location: 'Temple approach',
        startTime: '2026. 04. 21 09:10',
        endTime: '2026. 04. 21 09:40',
        durationMinutes: 30,
        photoCount: 3,
        travelMode: null,
        travelDistanceKm: null,
      },
      {
        id: 'preview-2',
        imageUrls: [
          'https://placehold.co/320x240?text=Transit+Segment',
          'https://placehold.co/320x240?text=Transit+Segment+2',
        ],
        segmentType: 'transit',
        isInferred: true,
        city: 'Kyoto',
        location: 'Default transit',
        startTime: '2026. 04. 21 09:40',
        endTime: '2026. 04. 21 10:00',
        durationMinutes: 20,
        photoCount: 2,
        travelMode: 'walk',
        travelDistanceKm: 1.8,
      },
    ])
    setStep('result')
  }

  const handleGenerate = async (files: File[]) => {
    setStep('loading')

    try {
      const apiResults = await previewJournalFromAPI(files)
      const imageUrlMap = new Map<number, string>()
      files.forEach((file, index) => {
        imageUrlMap.set(index + 1, URL.createObjectURL(file))
      })

      const mappedSegments = apiResults.segments.map((segment) => ({
        id: segment.segment_id,
        imageUrls:
          segment.image_ids.map(
            (imageId) => imageUrlMap.get(imageId) ?? 'https://placehold.co/320x240?text=Journal+Preview',
          ),
        segmentType: segment.segment_type,
        isInferred: segment.is_inferred,
        city: segment.city || 'Unknown city',
        location: buildDisplayLocation(
          segment.location_name || '',
          segment.formatted_address,
          segment.english_location_hint,
          segment.city || 'Unknown city',
        ),
        startTime: formatDateTime(segment.start_time),
        endTime: formatDateTime(segment.end_time),
        durationMinutes: segment.duration_minutes,
        photoCount: segment.image_ids.length,
        travelMode: segment.travel_mode,
        travelDistanceKm: segment.travel_distance_km,
      }))

      setPreview(apiResults)
      setSegmentCards(mappedSegments)
      setStep('result')
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to generate journal preview.')
      setStep('upload')
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '760px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          padding: '40px',
          border: '1px solid #eaeaea',
        }}
      >
        {step === 'upload' && (
          <JournalUpload onGenerate={handleGenerate} onOpenPreview={openPreviewResult} />
        )}

        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '20px' }}>AI</div>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#26215C' }}>
              Building journal preview
            </h3>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
              EXIF filtering, observation grouping, and segment classification are running now.
            </p>
          </div>
        )}

        {step === 'result' && preview && (
          <JournalResult
            segments={segmentCards}
            rejectedCount={preview.counts.rejected_images}
            observationCount={preview.counts.observations}
            onDiscard={() => setStep('upload')}
          />
        )}
      </div>
    </div>
  )
}
