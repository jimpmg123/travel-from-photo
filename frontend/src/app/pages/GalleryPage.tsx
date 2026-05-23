import { useState } from 'react'

import { PhotoCard } from '../components/PhotoCard'
import { PinPromptModal } from '../components/PinPromptModal'
import type { GalleryGroup } from '../types'

type GalleryPageProps = {
  groups: GalleryGroup[]
  unlockedGroupIds: Set<number>
  onMarkUnlocked: (groupId: number) => void
  onRenameGroup: (groupId: number, title: string) => void
  onViewImages: (group: GalleryGroup) => void
}

export function GalleryPage({
  groups,
  unlockedGroupIds,
  onMarkUnlocked,
  onRenameGroup,
  onViewImages,
}: GalleryPageProps) {
  const [pendingGroup, setPendingGroup] = useState<GalleryGroup | null>(null)

  const handleCardClick = (group: GalleryGroup) => {
    if (group.isLocked && !unlockedGroupIds.has(group.id)) {
      setPendingGroup(group)
      return
    }
    onViewImages(group)
  }

  const handleUnlockSuccess = () => {
    if (!pendingGroup) return
    onMarkUnlocked(pendingGroup.id)
    const target = pendingGroup
    setPendingGroup(null)
    onViewImages(target)
  }

  return (
    <div className="gallery-page-shell">
      <section className="gallery-grid gallery-grid--groups">
        {groups.map((group, index) => (
          <PhotoCard
            key={group.id}
            group={group}
            index={index}
            onRename={onRenameGroup}
            onViewImages={handleCardClick}
          />
        ))}
      </section>

      {pendingGroup && (
        <PinPromptModal
          collectionTitle={pendingGroup.title}
          onCancel={() => setPendingGroup(null)}
          onSuccess={handleUnlockSuccess}
        />
      )}
    </div>
  )
}
