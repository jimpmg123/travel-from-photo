import type { SearchImageResult, SearchResultBundle, SearchSession, UploadState } from './types'

export const maxUploadSizeBytes = 30 * 1024 * 1024

export const emptyUploadState: UploadState = {
  fileName: '',
  error: '',
}

function formatHintLocation(countryHint: string, cityHint: string): string {
  return cityHint ? `${cityHint}, ${countryHint}` : countryHint
}

function createCoordinatePair(index: number): string {
  const latitude = (34.85 + index * 0.173).toFixed(4)
  const longitude = (128.62 + index * 0.241).toFixed(4)
  return `${latitude}, ${longitude}`
}

export function formatFileSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024)
  return `${megabytes.toFixed(1)} MB`
}

export function buildSearchResultBundle(session: SearchSession): SearchResultBundle {
  const locationLabel = formatHintLocation(session.countryHint, session.cityHint)

  const results: SearchImageResult[] = session.uploads.map((upload, index) => {
    const pattern = index % 4

    if (pattern === 0) {
      const coordinates = createCoordinatePair(index)

      return {
        id: upload.id,
        imageName: upload.fileName,
        status: 'saved',
        source: 'EXIF metadata',
        summary: `GPS metadata was present, so the image was stored immediately after matching the user hint country ${session.countryHint}.`,
        coordinates,
        address: `Temporary address near ${locationLabel}`,
        backendRecord: 'Latitude and longitude saved to the image metadata record from EXIF.',
      }
    }

    if (pattern === 1) {
      const coordinates = createCoordinatePair(index)

      return {
        id: upload.id,
        imageName: upload.fileName,
        status: 'saved',
        source: 'Landmark recognition',
        summary: `EXIF GPS was missing, landmark recognition returned a top candidate, and the country check passed against ${session.countryHint}.`,
        coordinates,
        address: `Temporary landmark-matched address inside ${locationLabel}`,
        backendRecord: 'Latitude and longitude saved after landmark recognition and country validation.',
      }
    }

    if (pattern === 2) {
      const coordinates = createCoordinatePair(index)

      return {
        id: upload.id,
        imageName: upload.fileName,
        status: 'saved',
        source: 'CLIP + OpenAI fallback',
        summary: `Landmark recognition failed, so CLIP scene cues and OpenAI reasoning were used to infer a candidate location inside ${session.countryHint}.`,
        coordinates,
        address: `Temporary OpenAI-assisted address near ${locationLabel}`,
        backendRecord: 'Latitude and longitude saved after fallback inference and user-hint country validation.',
      }
    }

    return {
      id: upload.id,
      imageName: upload.fileName,
      status: 'failed',
      source: 'Location inference failed',
      summary: `Neither EXIF, landmark recognition, nor the CLIP and OpenAI fallback produced a location that could be accepted inside ${session.countryHint}.`,
      coordinates: null,
      address: null,
      backendRecord: 'No latitude or longitude stored. Show failure state in the result screen.',
    }
  })

  const savedResults = results.filter((result) => result.status === 'saved')
  const failedResults = results.length - savedResults.length

  return {
    heading: 'Temporary search results',
    subheading:
      'This page shows how per-image success, fallback, and failure states will render before the real backend pipeline is connected.',
    topResolved: savedResults[0] ?? null,
    results,
    summaryCards: [
      {
        label: 'Uploaded images',
        value: `${session.uploads.length}`,
        detail: 'Multiple travel images are processed in a single search run.',
      },
      {
        label: 'Saved coordinates',
        value: `${savedResults.length}`,
        detail: 'These images passed a location check and would be written to backend image metadata.',
      },
      {
        label: 'Failed images',
        value: `${failedResults}`,
        detail: 'These images remain unresolved and should show a failure state to the user.',
      },
      {
        label: 'User hints',
        value: locationLabel,
        detail: 'Country is the required validation boundary. City narrows the address display if provided.',
      },
    ],
    processingNotes: [
      {
        label: '1. EXIF service',
        value: 'Extract metadata first. If GPS exists, use it as the primary source.',
      },
      {
        label: '2. Landmark recognition',
        value: 'Run only when GPS metadata is missing, then validate whether the returned landmark fits the hinted country.',
      },
      {
        label: '3. CLIP + OpenAI',
        value: 'If landmark recognition fails, use scene cues and language reasoning to infer a candidate inside the user hint boundary.',
      },
      {
        label: '4. Backend save rule',
        value: 'Store latitude and longitude only when the inferred result can be accepted for the user hint country.',
      },
    ],
    serviceNotes: [
      {
        label: 'Landmark recognition',
        value: 'Used for landmark-first recovery when an image has no GPS metadata.',
      },
      {
        label: 'CLIP',
        value: 'Used for scene understanding so the fallback prompt has structured visual cues.',
      },
      {
        label: 'OpenAI',
        value: 'Used to reason over the image context and the user hints when landmark recognition fails.',
      },
      {
        label: 'Address output',
        value: 'The coordinates shown here are temporary placeholders until reverse geocoding is wired to the backend.',
      },
    ],
  }
}
