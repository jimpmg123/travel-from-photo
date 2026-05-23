import { useState } from 'react'

import { galleryGroups } from '../data'
import type { GalleryGroup, GalleryImage } from '../types'

type ImageDirection = 'prev' | 'next'

export function useGalleryBrowser() {
  const [galleryState, setGalleryState] = useState<GalleryGroup[]>(galleryGroups)
  const [selectedGalleryGroupId, setSelectedGalleryGroupId] = useState<number | null>(null)
  const [selectedGalleryImageId, setSelectedGalleryImageId] = useState<number | null>(null)
  const [unlockedGroupIds, setUnlockedGroupIds] = useState<Set<number>>(() => new Set())

  const selectedGalleryGroup =
    galleryState.find((group) => group.id === selectedGalleryGroupId) ?? galleryState[0] ?? null
  const selectedGalleryImage =
    selectedGalleryGroup?.images.find((image) => image.id === selectedGalleryImageId) ?? null

  const renameGroup = (groupId: number, title: string) => {
    setGalleryState((current) =>
      current.map((group) => (group.id === groupId ? { ...group, title } : group)),
    )
  }

  const toggleGroupLock = (groupId: number) => {
    setGalleryState((current) =>
      current.map((group) =>
        group.id === groupId ? { ...group, isLocked: !group.isLocked } : group,
      ),
    )
  }

  const markGroupUnlocked = (groupId: number) => {
    setUnlockedGroupIds((current) => {
      if (current.has(groupId)) return current
      const next = new Set(current)
      next.add(groupId)
      return next
    })
  }

  const openGroup = (group: GalleryGroup) => {
    setSelectedGalleryGroupId(group.id)
    setSelectedGalleryImageId(null)
  }

  const openImage = (image: GalleryImage) => {
    setSelectedGalleryImageId(image.id)
  }

  const closeImage = () => {
    setSelectedGalleryImageId(null)
  }

  const navigateImage = (direction: ImageDirection) => {
    if (!selectedGalleryGroup || !selectedGalleryImage) {
      return
    }

    const currentIndex = selectedGalleryGroup.images.findIndex(
      (image) => image.id === selectedGalleryImage.id,
    )

    if (currentIndex === -1) {
      return
    }

    const nextIndex =
      direction === 'prev'
        ? currentIndex === 0
          ? selectedGalleryGroup.images.length - 1
          : currentIndex - 1
        : currentIndex === selectedGalleryGroup.images.length - 1
          ? 0
          : currentIndex + 1

    setSelectedGalleryImageId(selectedGalleryGroup.images[nextIndex]?.id ?? null)
  }

  return {
    closeImage,
    galleryState,
    markGroupUnlocked,
    navigateImage,
    openGroup,
    openImage,
    renameGroup,
    selectedGalleryGroup,
    selectedGalleryImage,
    toggleGroupLock,
    unlockedGroupIds,
  }
}
