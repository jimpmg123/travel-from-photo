/**
 * Tracks the currently-running Journal generation job so the toast persists
 * across page navigation. Only one active job per user (backend enforces too),
 * so a single context value is enough.
 *
 * Polling cadence is 2s — fast enough for the bottom popup to feel live, slow
 * enough that the FastAPI BackgroundTask isn't hammered while it iterates.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import { generateJournal, pollJournalJob, type JournalJobStatus } from '../services/journalApi'

const POLL_INTERVAL_MS = 2000
const STORAGE_KEY = 'tfp_journal_job'

type StoredJob = { jobId: number; totalImages: number }

type JournalJobContextValue = {
  job: JournalJobStatus | null
  totalImages: number
  isStarting: boolean
  start: (imageIds: number[], title?: string) => Promise<number>
  clear: () => void
}

const JournalJobContext = createContext<JournalJobContextValue | null>(null)

function readStored(): StoredJob | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredJob
    if (typeof parsed?.jobId !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function writeStored(value: StoredJob | null) {
  if (value === null) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

export function JournalJobProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<JournalJobStatus | null>(null)
  const [totalImages, setTotalImages] = useState(0)
  const [isStarting, setIsStarting] = useState(false)
  const pollTimerRef = useRef<number | null>(null)

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const pollOnce = useCallback(async (jobId: number) => {
    try {
      const next = await pollJournalJob(jobId)
      setJob(next)
      // Terminal states: stop polling so we don't drum on the API forever.
      if (next.status === 'done' || next.status === 'partial_success' || next.status === 'failed') {
        stopPolling()
      }
    } catch (error) {
      // Network blip — keep polling, but log so devtools shows the issue.
      console.warn('journal job poll failed:', error)
    }
  }, [stopPolling])

  const startPollingFor = useCallback((jobId: number) => {
    stopPolling()
    pollOnce(jobId)
    pollTimerRef.current = window.setInterval(() => pollOnce(jobId), POLL_INTERVAL_MS)
  }, [pollOnce, stopPolling])

  // Restore an in-flight job on page reload — the backend keeps running even
  // if the tab refreshed mid-generation.
  useEffect(() => {
    const stored = readStored()
    if (stored) {
      setTotalImages(stored.totalImages)
      startPollingFor(stored.jobId)
    }
    return () => stopPolling()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = useCallback(async (imageIds: number[], title?: string) => {
    setIsStarting(true)
    try {
      const accepted = await generateJournal(imageIds, title)
      setTotalImages(imageIds.length)
      writeStored({ jobId: accepted.job_id, totalImages: imageIds.length })
      setJob({
        job_id: accepted.job_id,
        status: accepted.status,
        journal_id: null,
      })
      startPollingFor(accepted.job_id)
      return accepted.job_id
    } finally {
      setIsStarting(false)
    }
  }, [startPollingFor])

  const clear = useCallback(() => {
    stopPolling()
    setJob(null)
    setTotalImages(0)
    writeStored(null)
  }, [stopPolling])

  return (
    <JournalJobContext.Provider value={{ job, totalImages, isStarting, start, clear }}>
      {children}
    </JournalJobContext.Provider>
  )
}

export function useJournalJob(): JournalJobContextValue {
  const value = useContext(JournalJobContext)
  if (value === null) throw new Error('useJournalJob must be used inside <JournalJobProvider>')
  return value
}
