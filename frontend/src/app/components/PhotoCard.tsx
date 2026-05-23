import type { KeyboardEvent } from 'react'
import { Lock, Pencil } from 'lucide-react'

import type { GalleryGroup } from '../types'

type PhotoCardProps = {
  group: GalleryGroup
  index?: number
  onRename: (groupId: number, title: string) => void
  onViewImages: (group: GalleryGroup) => void
}

export function PhotoCard({ group, index = 0, onRename, onViewImages }: PhotoCardProps) {
  const thumbnailTheme = group.images[0]?.theme ?? group.theme
  const photoLabel = group.images.length === 1 ? 'photo' : 'photos'

  const handleOpen = () => onViewImages(group)

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOpen()
    }
  }

  const handleRename = () => {
    const nextTitle = window.prompt('Rename collection', group.title)
    if (nextTitle && nextTitle.trim()) {
      onRename(group.id, nextTitle.trim())
    }
  }

  return (
    <article
      className="photo-card"
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleCardKeyDown}
      aria-label={`Open ${group.title} collection`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className={`photo-frame photo-frame--${thumbnailTheme}`}>
        {group.isLocked && (
          <span className="photo-card-locked" aria-label="Locked collection">
            <Lock size={12} />
            <span>Locked</span>
          </span>
        )}
        <button
          type="button"
          className="photo-card-rename"
          onClick={(event) => {
            event.stopPropagation()
            handleRename()
          }}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label="Rename collection"
        >
          <Pencil size={14} />
        </button>
      </div>
      <div className="photo-card-info">
        <h3 className="photo-card-title">{group.title}</h3>
        <span className="photo-card-count">{group.images.length} {photoLabel}</span>
      </div>
    </article>
  )
}
