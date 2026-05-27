export type JournalPreviewImage = {
  image_id: number
  file_name: string | null
  captured_at: string | null
  city: string | null
  country: string | null
}

export type JournalPreviewRejection = {
  image_id: number
  reason_code: string
  reason: string
}

export type JournalPreviewObservation = {
  observation_id: string
  observation_order: number
  image_ids: number[]
  observation_kind: string
  start_time: string
  end_time: string
  city_snapshot: string | null
  country_snapshot: string | null
  formatted_address: string | null
  english_location_hint: string | null
  poi_name: string | null
  poi_primary_type: string | null
  scene_label: string | null
  suggested_segment_type: string | null
  classification_reason: string | null
}

export type JournalPreviewSegment = {
  segment_id: string
  segment_order: number
  segment_type: string
  is_inferred: boolean
  image_ids: number[]
  location_name: string | null
  city: string | null
  country: string | null
  formatted_address: string | null
  english_location_hint: string | null
  start_time: string
  end_time: string
  duration_minutes: number | null
  travel_mode: string | null
  travel_distance_km: number | null
  generated_text: string | null
  edited_text: string | null
}

export type JournalPreviewResponse = {
  eligible_images: JournalPreviewImage[]
  rejected_images: JournalPreviewRejection[]
  observations: JournalPreviewObservation[]
  segments: JournalPreviewSegment[]
  counts: {
    eligible_images: number
    rejected_images: number
    observations: number
    segments: number
  }
}

export const previewJournalFromAPI = async (files: File[]): Promise<JournalPreviewResponse> => {
  const formData = new FormData()
  files.forEach((file) => {
    formData.append('files', file)
  })

  const response = await fetch('http://localhost:8000/api/journal/preview', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Journal preview failed: ${response.status} ${detail}`)
  }

  return await response.json()
}
