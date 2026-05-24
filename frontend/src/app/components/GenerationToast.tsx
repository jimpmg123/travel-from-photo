/**
 * Persistent bottom-right popup that survives page navigation while a Journal
 * generation job is in flight. Reads from JournalJobContext, so any page that
 * routes the user away will still see the same toast tick along.
 *
 * Spec: shows percentage while processing, flips to a "Show Result" button on
 * completion, surfaces error on failure. Dismissable in terminal states.
 */
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle, Loader2, Sparkles, X } from 'lucide-react'

import { useJournalJob } from '../context/JournalJobContext'

export function GenerationToast() {
  const navigate = useNavigate()
  const { job, totalImages, clear } = useJournalJob()

  if (job === null) return null

  const isTerminal =
    job.status === 'done' || job.status === 'partial_success' || job.status === 'failed'
  const isFailed = job.status === 'failed'
  const isReady = job.status === 'done' || job.status === 'partial_success'

  const created = job.entries_created ?? 0
  // While processing, the % is the ratio of persisted entries to the requested
  // batch. We clamp to 99% so the bar doesn't briefly hit 100% before status
  // flips to 'done' (which can feel like a glitch).
  let percent = 0
  if (totalImages > 0) {
    percent = Math.min(99, Math.round((created / totalImages) * 100))
  }
  if (isReady) percent = 100

  const handleShowResult = () => {
    if (job.journal_id !== null) {
      navigate(`/journal/result/${job.journal_id}`)
    }
    // We keep the job in context until the result page mounts and clears it,
    // so a quick second click before navigation lands isn't a no-op.
  }

  return (
    <div className={`generation-toast ${isFailed ? 'is-failed' : isReady ? 'is-ready' : 'is-busy'}`}>
      <div className="generation-toast-icon">
        {isFailed ? <AlertTriangle size={18} /> : isReady ? <CheckCircle size={18} /> : <Loader2 size={18} className="verify-spinner" />}
      </div>

      <div className="generation-toast-body">
        <strong>
          {isFailed
            ? 'Generation failed'
            : isReady
              ? 'Journal ready'
              : 'Generating journal…'}
        </strong>
        {isFailed ? (
          <span>{job.error ?? 'Unknown error.'}</span>
        ) : (
          <span>
            {created} / {totalImages} photos
            {!isReady && ` · ${percent}%`}
          </span>
        )}

        {!isFailed && (
          <div className="generation-toast-bar" aria-hidden="true">
            <div className="generation-toast-bar-fill" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>

      {isReady && (
        <button
          type="button"
          className="button-primary generation-toast-action"
          onClick={handleShowResult}
        >
          <Sparkles size={14} />
          <span>Show Result</span>
        </button>
      )}

      {isTerminal && (
        <button
          type="button"
          className="generation-toast-close"
          onClick={clear}
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
