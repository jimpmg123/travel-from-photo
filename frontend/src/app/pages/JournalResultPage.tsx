/**
 * Read-and-edit view of a freshly generated (or revisited) Journal.
 *
 * Spec behaviors:
 *  - Date pulled from earliest captured_at of the entries
 *  - Title is editable inline (Journal default = "Journal Title")
 *  - Each entry: photo + auto tags + editable journal_text
 *  - Save / Discard only on the LAST entry
 *  - Save -> popup with "Go to Collection" / "Go to Home"
 *
 * On mount we clear the global GenerationToast — once the user reaches the
 * result, the persistent popup has done its job.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, MapPin, Pencil, Save, Sparkles, Trash2, X } from 'lucide-react'

import { useJournalJob } from '../context/JournalJobContext'
import {
  discardJournal,
  editJournal,
  getJournalDetail,
  type JournalDetail,
  type JournalEntry,
} from '../services/journalApi'
import { humanizeTag } from '../utils/tags'
import { absoluteImageUrl } from '../services/galleryApi'

const DEFAULT_TITLE = 'Journal Title'

const formatHeaderDate = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()} Journal`
}

const collectTags = (entry: JournalEntry): string[] => {
  // v3: clip_* are all multi-label arrays. Show at most a handful per card so
  // the entry doesn't drown in chips; stats panel is where the full distribution
  // belongs.
  const tags: string[] = []
  for (const t of (entry.clip_subject ?? []).slice(0, 2)) tags.push(t)
  for (const t of (entry.clip_activity ?? []).slice(0, 2)) tags.push(t)
  for (const t of (entry.clip_atmosphere ?? []).slice(0, 2)) tags.push(t)
  if (entry.gpt_time_of_day) tags.push(entry.gpt_time_of_day)
  if (entry.gpt_cultural_layer) tags.push(entry.gpt_cultural_layer)
  return tags
}

export function JournalResultPage() {
  const navigate = useNavigate()
  const { journalId } = useParams<{ journalId: string }>()
  const { clear } = useJournalJob()

  const [detail, setDetail] = useState<JournalDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [title, setTitle] = useState(DEFAULT_TITLE)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [entryTextById, setEntryTextById] = useState<Record<number, string>>({})
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showSavedDialog, setShowSavedDialog] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Fetch the journal once on mount (or when id changes).
  useEffect(() => {
    if (!journalId) return
    let cancelled = false

    getJournalDetail(Number(journalId))
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        setTitle(d.title?.trim() ? d.title : DEFAULT_TITLE)
        const initial: Record<number, string> = {}
        for (const entry of d.entries) {
          initial[entry.id] = entry.journal_text ?? ''
        }
        setEntryTextById(initial)
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : 'Failed to load journal.')
      })

    return () => {
      cancelled = true
    }
  }, [journalId])

  // Once we've landed on this page, the bottom toast has served its purpose.
  useEffect(() => clear(), [clear])

  const headerDate = useMemo(() => {
    if (!detail?.entries.length) return null
    const first = [...detail.entries]
      .filter((e) => e.captured_at)
      .sort((a, b) => (a.captured_at ?? '').localeCompare(b.captured_at ?? ''))[0]
    return formatHeaderDate(first?.captured_at ?? null)
  }, [detail])

  const handleSave = useCallback(async () => {
    if (!detail) return
    setIsSaving(true)
    try {
      const payload = {
        title: title === DEFAULT_TITLE ? null : title,
        entries: detail.entries.map((entry) => ({
          id: entry.id,
          journal_text: entryTextById[entry.id] ?? null,
        })),
      }
      const updated = await editJournal(detail.id, payload)
      setDetail(updated)
      setShowSavedDialog(true)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }, [detail, title, entryTextById])

  const handleDiscard = useCallback(async () => {
    if (!detail) return
    const ok = window.confirm('Discard this journal? This deletes it permanently.')
    if (!ok) return
    try {
      await discardJournal(detail.id)
      navigate('/journal')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Discard failed.')
    }
  }, [detail, navigate])

  if (loadError) {
    return (
      <div className="journal-result-shell">
        <p className="field-error">{loadError}</p>
        <button type="button" className="button-secondary" onClick={() => navigate('/journal')}>
          Back to Journal home
        </button>
      </div>
    )
  }

  if (detail === null) {
    return (
      <div className="journal-result-shell">
        <p className="muted-copy">Loading journal…</p>
      </div>
    )
  }

  const entries = detail.entries
  const total = entries.length
  const entry = entries[currentIndex]
  const tags = collectTags(entry)
  const value = entryTextById[entry.id] ?? ''
  const isEditing = editingEntryId === entry.id
  const isLast = currentIndex === total - 1

  return (
    <div className="journal-result-shell">
      <header className="journal-result-header">
        <button
          type="button"
          className="journal-picker-back"
          onClick={() => navigate('/journal')}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <div className="journal-result-titles">
          <span className="journal-result-date">{headerDate}</span>
          {isEditingTitle ? (
            <input
              type="text"
              className="journal-result-title-input"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setIsEditingTitle(false)
              }}
            />
          ) : (
            <button
              type="button"
              className="journal-result-title-button"
              onClick={() => setIsEditingTitle(true)}
              aria-label="Edit title"
            >
              <span>{title}</span>
              <Pencil size={14} />
            </button>
          )}
        </div>
      </header>

      <section className="journal-diary-stage">
        <button
          type="button"
          className="journal-diary-arrow journal-diary-arrow--left"
          onClick={() => { setCurrentIndex((i) => Math.max(0, i - 1)); setEditingEntryId(null) }}
          disabled={currentIndex === 0}
          aria-label="Previous entry"
        >
          ‹
        </button>

        <article className="journal-result-entry">
          <div className="journal-diary-card-top">
            <span className="journal-diary-card-counter">{currentIndex + 1} / {total}</span>
            <span className="journal-diary-card-location">
              <MapPin size={13} />
              {[entry.place_name, entry.city, entry.country].filter(Boolean).join(' · ') || 'Unknown place'}
            </span>
          </div>

          {entry.image_url ? (
            <img
              className="journal-result-photo"
              src={absoluteImageUrl(entry.image_url) ?? undefined}
              alt={`Photo ${currentIndex + 1}`}
            />
          ) : (
            <div className="journal-result-photo photo-frame photo-frame--coast" />
          )}

          <div className="journal-result-content">
            {tags.length > 0 && (
              <div className="journal-result-tags">
                {tags.map((tag) => (
                  <span key={tag} className="journal-result-tag">{humanizeTag(tag)}</span>
                ))}
              </div>
            )}

            {isEditing ? (
              <textarea
                className="journal-result-text-input"
                value={value}
                autoFocus
                onChange={(e) =>
                  setEntryTextById((current) => ({ ...current, [entry.id]: e.target.value }))
                }
                onBlur={() => setEditingEntryId(null)}
              />
            ) : (
              <button
                type="button"
                className="journal-result-text"
                onClick={() => setEditingEntryId(entry.id)}
              >
                {value || <em>Add a note…</em>}
              </button>
            )}

            {isLast && (
              <div className="journal-result-final-actions">
                <button type="button" className="button-secondary" onClick={handleDiscard}>
                  <Trash2 size={14} />
                  <span>Discard</span>
                </button>
                <button type="button" className="button-primary" onClick={handleSave} disabled={isSaving}>
                  <Save size={14} />
                  <span>{isSaving ? 'Saving…' : 'Save to Collections'}</span>
                </button>
              </div>
            )}
          </div>
        </article>

        <button
          type="button"
          className="journal-diary-arrow journal-diary-arrow--right"
          onClick={() => { setCurrentIndex((i) => Math.min(total - 1, i + 1)); setEditingEntryId(null) }}
          disabled={currentIndex === total - 1}
          aria-label="Next entry"
        >
          ›
        </button>
      </section>

      {total > 1 && (
        <div className="journal-diary-dots">
          {entries.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`journal-diary-dot${idx === currentIndex ? ' is-active' : ''}`}
              onClick={() => { setCurrentIndex(idx); setEditingEntryId(null) }}
              aria-label={`Go to entry ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {showSavedDialog && (
        <div className="journal-saved-overlay" onClick={() => setShowSavedDialog(false)}>
          <div className="journal-saved-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pin-modal-close"
              onClick={() => setShowSavedDialog(false)}
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <div className="journal-saved-icon">
              <Check size={20} />
            </div>
            <h3>Saved to your collections</h3>
            <p>Where do you want to go next?</p>
            <div className="journal-saved-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => navigate('/journal')}
              >
                <Sparkles size={14} />
                <span>Journal Home</span>
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={() => navigate('/journal/collections')}
              >
                <span>Open Collections</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
