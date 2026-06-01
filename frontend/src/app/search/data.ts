import type {
  SearchImageResult,
  SearchResultBundle,
  SearchUploadAnalysis,
  SearchUploadItem,
  UploadState,
} from './types'

export const maxUploadSizeBytes = 30 * 1024 * 1024

export const emptyUploadState: UploadState = {
  fileName: '',
  error: '',
}

export function formatFileSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024)
  return `${megabytes.toFixed(1)} MB`
}

function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

function summarizeVisualResult(summary: unknown): string | null {
  if (typeof summary === 'string' && summary.trim()) {
    return summary
  }

  if (summary && typeof summary === 'object') {
    const scene = 'scene' in summary ? summary.scene : null
    const gate = 'gate' in summary ? summary.gate : null

    if (typeof scene === 'string' && typeof gate === 'string') {
      return `${scene} (${gate})`
    }

    try {
      return JSON.stringify(summary)
    } catch {
      return 'Visual analysis completed, but the summary could not be formatted.'
    }
  }

  return null
}

function toSearchImageResult(
  upload: SearchUploadItem,
  analysis: SearchUploadAnalysis | undefined,
  countryHint: string,
): SearchImageResult {
  if (!analysis) {
    return {
      id: upload.id,
      imageName: upload.fileName,
      previewUrl: upload.previewUrl,
      status: 'failed',
      source: 'Upload request failed',
      summary: 'The frontend did not receive any backend response for this image.',
      coordinates: null,
      address: null,
      latitude: null,
      longitude: null,
      resolutionPath: 'Request failed',
      resolutionNote: 'The backend did not return any analysis payload for this image.',
      userHintUsed: null,
      ocrTextUsed: false,
      candidates: [],
      verdict: 'failed',
      tierReached: null,
      standardTags: [],
      chatLounges: [],
    }
  }

  if (!analysis.ok) {
    return {
      id: upload.id,
      imageName: upload.fileName,
      previewUrl: upload.previewUrl,
      status: 'failed',
      source: 'Upload request failed',
      summary: analysis.error,
      coordinates: null,
      address: null,
      latitude: null,
      longitude: null,
      resolutionPath: 'Request failed',
      resolutionNote: 'The HTTP request failed before image analysis could complete.',
      userHintUsed: null,
      ocrTextUsed: false,
      candidates: [],
      verdict: 'failed',
      tierReached: null,
      standardTags: [],
      chatLounges: [],
    }
  }

  const gps = analysis.response.gps
  const resolvedLocation = analysis.response.resolved_location
  const latitude = resolvedLocation?.latitude ?? gps?.latitude
  const longitude = resolvedLocation?.longitude ?? gps?.longitude
  const hasCoordinates = latitude != null && longitude != null
  const visualSummary = summarizeVisualResult(analysis.response.summary)
  const resolutionSource = analysis.response.resolution_source
  const userHintUsed =
    analysis.response.resolved_location?.metadata?.user_hint_used ||
    analysis.response.openai_candidate?.user_hint_used ||
    null
  const openaiPlaceName =
    analysis.response.resolved_location?.place_name || analysis.response.openai_candidate?.place_name || null
  const ocrTextUsed = Boolean(
    analysis.response.resolved_location?.metadata?.ocr_text_used ||
      analysis.response.openai_candidate?.ocr_text_used,
  )
  const sourceLabel =
    resolutionSource === 'landmark_detection'
      ? 'Landmark detection'
      : resolutionSource === 'openai_location'
        ? userHintUsed
          ? 'OpenAI retry'
          : 'OpenAI fallback'
        : resolutionSource === 'clip_gate'
          ? 'CLIP gate rejection'
          : analysis.response.has_gps
            ? 'GPS metadata'
            : 'Missing GPS metadata'
  const locationLabel =
    resolvedLocation?.formatted_address ||
    (analysis.response.city && analysis.response.city !== 'Unknown Location'
      ? [analysis.response.city, countryHint].filter(Boolean).join(', ')
      : null)

  // Pass the full candidate list through so SearchResults can render
  // "Top Match + Other Matches" per uploaded image.
  const candidates = analysis.response.candidates ?? []
  const verdict = analysis.response.verdict ?? null
  const tierReached = analysis.response.tier_reached ?? null
  const standardTags = analysis.response.tags ?? []
  const chatLounges = analysis.response.chat_lounges ?? []

  if (hasCoordinates) {
    const isApproximateOpenAi =
      resolutionSource === 'openai_location' && !openaiPlaceName

    return {
      id: upload.id,
      imageName: analysis.response.file_name || upload.fileName,
      previewUrl: upload.previewUrl,
      status: isApproximateOpenAi ? 'warning' : 'saved',
      source: sourceLabel,
      summary:
        isApproximateOpenAi
          ? visualSummary || 'OpenAI only recovered an approximate city-level location for this image.'
          : visualSummary || `${sourceLabel} resolved coordinates and returned a location label.`,
      coordinates: formatCoordinates(latitude, longitude),
      address: locationLabel,
      latitude,
      longitude,
      resolutionPath: sourceLabel,
      resolutionNote:
        isApproximateOpenAi
          ? `OpenAI did not return an exact place name, so this point is treated as an approximate warning${ocrTextUsed ? ' using OCR context' : ''}.`
          : sourceLabel === 'OpenAI retry'
            ? `This result was resolved through OpenAI using your hint${ocrTextUsed ? ' plus OCR text' : ''}.`
            : `This result was accepted through ${sourceLabel.toLowerCase()}${ocrTextUsed ? ' with OCR context' : ''}.`,
      userHintUsed,
      ocrTextUsed,
      candidates,
      verdict,
      tierReached,
      standardTags,
      chatLounges,
    }
  }

  return {
    id: upload.id,
    imageName: analysis.response.file_name || upload.fileName,
    previewUrl: upload.previewUrl,
    status: 'failed',
    source: sourceLabel,
    summary:
      analysis.response.failure_reason ||
      resolvedLocation?.failure_reason ||
      visualSummary ||
      'The current backend flow could not recover coordinates because the image did not include EXIF GPS data.',
    coordinates: null,
    address: locationLabel,
    latitude: null,
    longitude: null,
    resolutionPath: sourceLabel,
    resolutionNote:
      analysis.response.failure_reason ||
      resolvedLocation?.failure_reason ||
      'No coordinates were returned by the current search pipeline.',
    userHintUsed,
    ocrTextUsed,
    candidates,
    verdict,
    standardTags,
    chatLounges,
  }
}

export function buildSearchResultBundle(params: {
  countryHint: string
  cityHint: string
  uploads: SearchUploadItem[]
  analyses: SearchUploadAnalysis[]
}): SearchResultBundle {
  const { analyses, countryHint, uploads } = params

  const results = uploads.map((upload) =>
    toSearchImageResult(
      upload,
      analyses.find((analysis) => analysis.uploadId === upload.id),
      countryHint,
    ),
  )

  const savedResults = results.filter((result) => result.status === 'saved')
  const warningResults = results.filter((result) => result.status === 'warning')
  const failedResults = results.filter((result) => result.status === 'failed')

  return {
    heading: 'Image search results',
    subheading:
      'Each uploaded image shows whether location recovery succeeded and which backend path produced the result.',
    topResolved: savedResults[0] ?? warningResults[0] ?? null,
    results,
    summaryCards: [
      {
        label: 'Uploaded images',
        value: `${uploads.length}`,
        detail: 'All selected images were sent to the backend image search route.',
      },
      {
        label: 'Exact matches',
        value: `${savedResults.length}`,
        detail: 'These images returned coordinates with a specific location result.',
      },
      {
        label: 'Warnings',
        value: `${warningResults.length}`,
        detail: 'These images mapped only to an approximate city-level result.',
      },
      {
        label: 'Unresolved',
        value: `${failedResults.length}`,
        detail: 'Only unresolved images expose a retry hint field for another OpenAI pass.',
      },
    ],
  }
}
