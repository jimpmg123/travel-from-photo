import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Lock, X } from 'lucide-react'

const DEMO_PIN = '1234'

type PinPromptModalProps = {
  collectionTitle: string
  onCancel: () => void
  onSuccess: () => void
}

export function PinPromptModal({ collectionTitle, onCancel, onSuccess }: PinPromptModalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (pin === DEMO_PIN) {
      onSuccess()
      return
    }
    setError('Incorrect PIN. Try again.')
    setShake(true)
    setPin('')
    window.setTimeout(() => setShake(false), 400)
    inputRef.current?.focus()
  }

  return (
    <div className="pin-overlay" onClick={onCancel}>
      <form
        className={`pin-modal ${shake ? 'is-shake' : ''}`}
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <button
          type="button"
          className="pin-modal-close"
          onClick={onCancel}
          aria-label="Cancel unlock"
        >
          <X size={16} />
        </button>

        <div className="pin-modal-icon">
          <Lock size={20} />
        </div>

        <h3 className="pin-modal-title">Locked collection</h3>
        <p className="pin-modal-subtitle">
          Enter PIN to open <strong>{collectionTitle}</strong>
        </p>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          className="pin-modal-input"
          value={pin}
          onChange={(event) => {
            setPin(event.target.value.replace(/[^0-9]/g, ''))
            if (error) setError('')
          }}
          aria-label="PIN"
        />

        {error ? <p className="pin-modal-error">{error}</p> : <p className="pin-modal-hint">Demo PIN: 1234</p>}

        <div className="pin-modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="button-primary" disabled={pin.length !== 4}>
            Unlock
          </button>
        </div>
      </form>
    </div>
  )
}
