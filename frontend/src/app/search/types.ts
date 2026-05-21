export type UploadState = {
  fileName: string
  error: string
}

export type SearchUploadItem = {
  id: string
  fileName: string
  fileSizeBytes: number
  fileSizeLabel: string
  previewUrl: string
  file: File
}

export type SearchApiImageResponse = {
  file_name?: string
  captured_at?: string | null
  gps?: {
    latitude?: number | null
    longitude?: number | null
  } | null
  city?: string | null
  summary?: unknown
  has_gps?: boolean
  metadata_case?: string
  resolution_status?: 'resolved' | 'failed'
  resolution_source?: 'exif_gps' | 'landmark_detection' | 'openai_location' | 'clip_gate' | 'search_pipeline' | null
  failure_reason?: string | null
  resolved_location?: {
    status?: string
    source?: string | null
    latitude?: number | null
    longitude?: number | null
    formatted_address?: string | null
    country?: string | null
    city?: string | null
    region?: string | null
    place_name?: string | null
    failure_reason?: string | null
    metadata?: {
      user_hint_used?: string | null
      ocr_text_used?: boolean
    } | null
  } | null
  clip_gate?: {
    label?: string
    score?: number
    decision?: string
    is_location_candidate?: boolean
    reason?: string
  } | null
  openai_candidate?: {
    place_name?: string | null
    formatted_address?: string | null
    user_hint_used?: string | null
    ocr_text_used?: boolean
  } | null
}

export type SearchUploadAnalysis =
  | {
      uploadId: string
      ok: true
      response: SearchApiImageResponse
    }
  | {
      uploadId: string
      ok: false
      error: string
    }

export type SearchRun = {
  countryHint: string
  cityHint: string
  uploads: SearchUploadItem[]
  analyses: SearchUploadAnalysis[]
  bundle: SearchResultBundle
}

export type SearchResolutionSource =
  | 'GPS metadata'
  | 'Landmark detection'
  | 'OpenAI retry'
  | 'OpenAI fallback'
  | 'CLIP gate rejection'
  | 'Missing GPS metadata'
  | 'Upload request failed'

export type SearchImageResult = {
  id: string
  imageName: string
  previewUrl: string
  status: 'saved' | 'warning' | 'failed'
  source: SearchResolutionSource
  summary: string
  coordinates: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  resolutionPath: string
  resolutionNote: string
  userHintUsed: string | null
  ocrTextUsed: boolean
}

export type SearchResultBundle = {
  heading: string
  subheading: string
  topResolved: SearchImageResult | null
  results: SearchImageResult[]
  summaryCards: { label: string; value: string; detail: string }[]
}

export type SearchPageProps = {
  onRunSearch: (session: SearchRun) => void
}

export type SearchResultsPageProps = {
  isLoggedIn: boolean
  searchSession: SearchRun | null
  onRetryFailedImage: (uploadId: string, userHint: string) => Promise<void>
}
