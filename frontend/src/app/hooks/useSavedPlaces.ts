import { useCallback, useEffect, useState } from 'react'

import {
  type Collection,
  deleteSavedPlace,
  fetchCollections,
  renameCollection,
  updateSavedPlace,
} from '../services/galleryApi'

const EMPTY_COLLECTIONS_KEY = 'tfp_empty_collections'

function loadEmptyCollections(): string[] {
  try {
    const raw = localStorage.getItem(EMPTY_COLLECTIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveEmptyCollections(names: string[]): void {
  try {
    localStorage.setItem(EMPTY_COLLECTIONS_KEY, JSON.stringify(names))
  } catch {
    // ignore
  }
}

export function useSavedPlaces() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchCollections()
      const emptyNames = loadEmptyCollections()
      const existingNames = new Set(result.map((c) => c.name))
      const stillEmpty = emptyNames.filter((name) => !existingNames.has(name))
      saveEmptyCollections(stillEmpty)
      const merged: Collection[] = [
        ...result,
        ...stillEmpty.map((name) => ({ name, saves: [] })),
      ]
      merged.sort((a, b) => a.name.localeCompare(b.name))
      setCollections(merged)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gallery')
    } finally {
      setLoading(false)
    }
  }, [])

  const createEmptyCollection = useCallback(
    (name: string) => {
      const trimmed = name.trim().slice(0, 120)
      if (!trimmed) return
      const existing = loadEmptyCollections()
      if (existing.includes(trimmed)) return
      const next = [...existing, trimmed]
      saveEmptyCollections(next)
      setCollections((cur) => {
        if (cur.some((c) => c.name === trimmed)) return cur
        const merged = [...cur, { name: trimmed, saves: [] }]
        merged.sort((a, b) => a.name.localeCompare(b.name))
        return merged
      })
    },
    [],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  const renameCollectionAction = useCallback(
    async (oldName: string, newName: string) => {
      await renameCollection(oldName, newName)
      await reload()
    },
    [reload],
  )

  const movePlace = useCallback(
    async (placeId: number, targetCollectionName: string) => {
      await updateSavedPlace(placeId, { collectionName: targetCollectionName })
      await reload()
    },
    [reload],
  )

  const deletePlace = useCallback(
    async (placeId: number) => {
      await deleteSavedPlace(placeId)
      await reload()
    },
    [reload],
  )

  return {
    collections,
    loading,
    error,
    reload,
    renameCollection: renameCollectionAction,
    movePlace,
    deletePlace,
    createEmptyCollection,
  }
}
