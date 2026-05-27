import type { PageId } from '../types'

export type UploadState = {
  fileName: string
  error: string
}

export type SearchUploadItem = {
  id: string
  fileName: string
  fileSizeBytes: number
  fileSizeLabel: string
}

export type SearchSession = {
  countryHint: string
  cityHint: string
  uploads: SearchUploadItem[]
}

export type SearchResolutionSource =
  | 'EXIF metadata'
  | 'Landmark recognition'
  | 'CLIP + OpenAI fallback'
  | 'Location inference failed'

export type SearchImageResult = {
  id: string
  imageName: string
  status: 'saved' | 'failed'
  source: SearchResolutionSource
  summary: string
  coordinates: string | null
  address: string | null
  backendRecord: string
}

export type SearchResultBundle = {
  heading: string
  subheading: string
  topResolved: SearchImageResult | null
  results: SearchImageResult[]
  summaryCards: { label: string; value: string; detail: string }[]
  processingNotes: { label: string; value: string }[]
  serviceNotes: { label: string; value: string }[]
}

export type SearchPageProps = {
  onRunSearch: (session: SearchSession) => void
  onOpenPage: (page: PageId) => void
}

export type SearchResultsPageProps = {
  isLoggedIn: boolean
  searchSession: SearchSession | null
  onOpenPage: (page: PageId) => void
}
