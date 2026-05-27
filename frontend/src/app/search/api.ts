import type { Candidate, SearchApiImageResponse, SearchUploadAnalysis, SearchUploadItem } from './types'

const SEARCH_API_URL = 'http://localhost:8000/api/image'

async function analyzeSingleUpload(
  upload: SearchUploadItem,
  hints: {
    countryHint: string
    cityHint: string
    userHint?: string
    forceOpenaiRetry?: boolean
  },
): Promise<SearchUploadAnalysis> {
  const { cityHint, countryHint, forceOpenaiRetry, userHint } = hints
  const formData = new FormData()
  formData.append('file', upload.file)

  if (countryHint.trim()) {
    formData.append('country_hint', countryHint.trim())
  }
  if (cityHint.trim()) {
    formData.append('city_hint', cityHint.trim())
  }
  if (userHint?.trim()) {
    formData.append('user_hint', userHint.trim())
  }
  if (forceOpenaiRetry) {
    formData.append('force_openai_retry', 'true')
  }

  try {
    const response = await fetch(SEARCH_API_URL, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const body = await response.text()
      return {
        uploadId: upload.id,
        ok: false,
        error: `Backend request failed (${response.status}). ${body || 'No response body.'}`.trim(),
      } satisfies SearchUploadAnalysis
    }

    const payload = (await response.json()) as SearchApiImageResponse
    return {
      uploadId: upload.id,
      ok: true,
      response: payload,
    } satisfies SearchUploadAnalysis
  } catch (error) {
    return {
      uploadId: upload.id,
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'The backend request failed before a response was returned.',
    } satisfies SearchUploadAnalysis
  }
}

const EARTH_RADIUS_KM = 6371

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function clusterMultiplierFor(distanceKm: number): number {
  if (distanceKm < 5) return 1.35
  if (distanceKm < 20) return 1.20
  if (distanceKm < 100) return 1.00
  if (distanceKm < 500) return 0.65
  return 0.35
}

export function applyCrossImageClusterReweight(
  analyses: SearchUploadAnalysis[],
): SearchUploadAnalysis[] {
  const anchorPoints: { lat: number; lng: number; score: number }[] = []
  for (const analysis of analyses) {
    if (!analysis.ok) continue
    const cands = analysis.response.candidates ?? []
    if (cands.length === 0) continue
    const top = cands[0]
    if (top.latitude == null || top.longitude == null) continue
    if ((top.aggregated_score ?? 0) < 0.5) continue
    anchorPoints.push({
      lat: top.latitude,
      lng: top.longitude,
      score: top.aggregated_score ?? 0,
    })
  }

  if (anchorPoints.length < 2) {
    return analyses
  }

  const centerLat = median(anchorPoints.map((p) => p.lat))
  const centerLng = median(anchorPoints.map((p) => p.lng))

  return analyses.map((analysis) => {
    if (!analysis.ok) return analysis
    const cands = analysis.response.candidates
    if (!cands || cands.length === 0) return analysis

    const reweighted: Candidate[] = cands.map((c) => {
      if (c.latitude == null || c.longitude == null) return c
      const km = haversineKm(centerLat, centerLng, c.latitude, c.longitude)
      const multiplier = clusterMultiplierFor(km)
      const baseScore = c.aggregated_score ?? 0
      const newScore = Math.min(baseScore * multiplier, 1)
      const tag =
        multiplier > 1
          ? `same-trip cluster (${Math.round(km)} km from group)`
          : multiplier < 1
            ? `far from same-trip cluster (${Math.round(km)} km away)`
            : null
      const reasoning = tag
        ? c.reasoning
          ? `${c.reasoning} · ${tag}`
          : tag
        : c.reasoning
      return { ...c, aggregated_score: Number(newScore.toFixed(4)), reasoning }
    })

    reweighted.sort(
      (a, b) => (b.aggregated_score ?? 0) - (a.aggregated_score ?? 0),
    )
    reweighted.forEach((c, idx) => {
      c.rank = idx + 1
    })

    return {
      ...analysis,
      response: { ...analysis.response, candidates: reweighted },
    }
  })
}

export async function analyzeSearchUploads(
  uploads: SearchUploadItem[],
  hints: {
    countryHint: string
    cityHint: string
  },
): Promise<SearchUploadAnalysis[]> {
  const tasks = uploads.map((upload) => analyzeSingleUpload(upload, hints))
  const analyses = await Promise.all(tasks)
  return applyCrossImageClusterReweight(analyses)
}

export async function retryFailedSearchUpload(
  upload: SearchUploadItem,
  hints: {
    countryHint: string
    cityHint: string
    userHint: string
  },
): Promise<SearchUploadAnalysis> {
  return analyzeSingleUpload(upload, {
    ...hints,
    forceOpenaiRetry: true,
  })
}
