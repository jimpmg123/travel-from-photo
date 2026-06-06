import type { Candidate, SearchApiImageResponse, SearchUploadAnalysis, SearchUploadItem } from './types'

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:8000/api'

const SEARCH_API_URL = `${API_BASE_URL.replace(/\/$/, '')}/image`

async function analyzeSingleUpload(
  upload: SearchUploadItem,
  hints: {
    countryHint: string
    cityHint: string
    userHint?: string
    language?: string
    forceOpenaiRetry?: boolean
  },
): Promise<SearchUploadAnalysis> {
  const { cityHint, countryHint, forceOpenaiRetry, language, userHint } = hints
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
  if (language) {
    formData.append('language', language)
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

function pickMostCommon(values: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>()
  for (const v of values) {
    if (!v) continue
    const key = v.trim()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let bestKey: string | null = null
  let bestCount = 0
  for (const [k, c] of counts) {
    if (c > bestCount) {
      bestKey = k
      bestCount = c
    }
  }
  return bestKey
}

async function applyClusterDerivedRetry(
  analyses: SearchUploadAnalysis[],
  uploads: SearchUploadItem[],
  originalHints: { countryHint: string; cityHint: string },
): Promise<SearchUploadAnalysis[]> {
  if (uploads.length < 2) return analyses

  const anchors = analyses.filter((a) => {
    if (!a.ok) return false
    const top = a.response.candidates?.[0]
    if (!top) return false
    return (top.aggregated_score ?? 0) >= 0.6 && (a.response.verdict === 'confident' || a.response.verdict === 'likely')
  })
  if (anchors.length < 1) return analyses

  const dominantCountry = pickMostCommon(anchors.map((a) => a.ok ? a.response.candidates?.[0]?.country ?? null : null))
  const dominantCity = pickMostCommon(anchors.map((a) => a.ok ? a.response.candidates?.[0]?.city ?? null : null))

  if (!dominantCountry && !dominantCity) return analyses

  const toRetry: string[] = []
  for (const a of analyses) {
    if (!a.ok) {
      toRetry.push(a.uploadId)
      continue
    }
    const top = a.response.candidates?.[0]
    const verdict = a.response.verdict ?? 'failed'
    if (verdict === 'confident' && (top?.aggregated_score ?? 0) >= 0.7) continue

    const topCountry = top?.country?.trim().toLowerCase()
    const topCity = top?.city?.trim().toLowerCase()
    const cCountry = dominantCountry?.toLowerCase()
    const cCity = dominantCity?.toLowerCase()

    const countryMismatch = !!(topCountry && cCountry && topCountry !== cCountry)
    const cityMismatch = !!(topCity && cCity && topCity !== cCity)
    const missingLocation = !topCountry && !topCity

    if (countryMismatch || cityMismatch || missingLocation) {
      toRetry.push(a.uploadId)
    }
  }

  if (toRetry.length === 0) return analyses

  const retried = await Promise.all(
    toRetry.map(async (uploadId) => {
      const upload = uploads.find((u) => u.id === uploadId)
      if (!upload) return null
      return analyzeSingleUpload(upload, {
        countryHint: dominantCountry ?? originalHints.countryHint,
        cityHint: dominantCity ?? originalHints.cityHint,
        forceOpenaiRetry: true,
      })
    }),
  )

  const retryMap = new Map<string, SearchUploadAnalysis>()
  for (const r of retried) {
    if (r) retryMap.set(r.uploadId, r)
  }

  return analyses.map((a) => retryMap.get(a.uploadId) ?? a)
}

export async function analyzeSearchUploads(
  uploads: SearchUploadItem[],
  hints: {
    countryHint: string
    cityHint: string
    userHint?: string
    language?: string
  },
): Promise<SearchUploadAnalysis[]> {
  const tasks = uploads.map((upload) => analyzeSingleUpload(upload, hints))
  const analyses = await Promise.all(tasks)
  const phase1Reweighted = applyCrossImageClusterReweight(analyses)
  const phase2 = await applyClusterDerivedRetry(phase1Reweighted, uploads, hints)
  return applyCrossImageClusterReweight(phase2)
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
