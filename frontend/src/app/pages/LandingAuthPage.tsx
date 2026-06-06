import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiRegister, apiVerifyOtp } from '../services/authApi'

type View = 'login' | 'register' | 'verify'

const TEAL = '#14b8a6'
const TEAL_DARK = '#0d9488'

export function LandingAuthPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [view, setView] = useState<View>('login')
  const [pendingEmail, setPendingEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [userId, setUserId] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')

  const [otpCode, setOtpCode] = useState('')

  const switchTo = (v: View) => { setError(''); setView(v) }

  const passwordRules = [
    { label: '8+ characters', met: regPassword.length >= 8 },
    { label: 'One letter', met: /[a-zA-Z]/.test(regPassword) },
    { label: 'One number', met: /[0-9]/.test(regPassword) },
  ]
  const passwordValid = passwordRules.every((r) => r.met)
  const confirmMatch = regPassword === regConfirm

  const handleLogin = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(loginEmail, loginPassword)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError('')
    if (!passwordValid) { setError('Password does not meet all requirements'); return }
    if (!confirmMatch) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await apiRegister({
        first_name: firstName,
        last_name: lastName,
        user_id: userId,
        email: regEmail,
        password: regPassword,
      })
      setPendingEmail(regEmail)
      switchTo('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiVerifyOtp(pendingEmail, otpCode)
      setLoginEmail(pendingEmail)
      switchTo('login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing-shell">
      <div className="landing-left" style={{ background: '#0f172a', color: 'white' }}>
        <div style={{ marginBottom: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <div style={{ width: '6px', height: '44px', background: TEAL, borderRadius: '3px', flexShrink: 0 }} />
            <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
              Travel From Photo
            </h1>
          </div>
          <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: 1.7, margin: 0, paddingLeft: '20px' }}>
            Upload your travel photos.<br />
            Your journey journal is generated automatically.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <Feature
            icon="📍"
            title="AI Location Finder"
            desc="Identify where each photo was taken using EXIF metadata and visual AI."
          />
          <Feature
            icon="🍽️"
            title="Restaurant Recommendation"
            desc="Upload a food photo — find matching restaurants anywhere in the world."
          />
          <Feature
            icon="📖"
            title="Auto Trip Journal"
            desc="Photos, time, and location combine into a beautiful travel journal."
          />
        </div>
      </div>

      <div className="landing-right" style={{ background: '#f0fdfa' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {view === 'login' && (
            <>
              <p style={badge}>Welcome back</p>
              <h2 style={heading}>Sign in to your account</h2>
              <form onSubmit={handleLogin} style={form}>
                <Field
                  placeholder="Email"
                  type="email"
                  value={loginEmail}
                  onChange={(v) => setLoginEmail(v)}
                />
                <Field
                  placeholder="Password"
                  type="password"
                  value={loginPassword}
                  onChange={(v) => setLoginPassword(v)}
                />
                {error && <p style={errorText}>{error}</p>}
                <Btn loading={loading}>{loading ? 'Signing in…' : 'Sign in'}</Btn>
              </form>
              <Switch>
                Don't have an account?{' '}
                <Anchor onClick={() => switchTo('register')}>Register</Anchor>
              </Switch>
            </>
          )}

          {view === 'register' && (
            <>
              <p style={badge}>New here?</p>
              <h2 style={heading}>Create your account</h2>
              <form onSubmit={handleRegister} style={form}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Field
                    placeholder="First name"
                    value={firstName}
                    onChange={(v) => setFirstName(v)}
                  />
                  <Field
                    placeholder="Last name"
                    value={lastName}
                    onChange={(v) => setLastName(v)}
                  />
                </div>
                <Field
                  placeholder="Username"
                  value={userId}
                  onChange={(v) => setUserId(v)}
                />
                <Field
                  placeholder="Email"
                  type="email"
                  value={regEmail}
                  onChange={(v) => setRegEmail(v)}
                />
                <div>
                  <Field
                    placeholder="Password"
                    type="password"
                    value={regPassword}
                    onChange={(v) => setRegPassword(v)}
                  />
                  {regPassword && (
                    <div style={{ display: 'flex', gap: '14px', marginTop: '8px', paddingLeft: '2px' }}>
                      {passwordRules.map((r) => (
                        <span
                          key={r.label}
                          style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            color: r.met ? '#10b981' : '#9ca3af',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'color 0.2s',
                          }}
                        >
                          {r.met ? '✓' : '○'} {r.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Field
                    placeholder="Confirm password"
                    type="password"
                    value={regConfirm}
                    onChange={(v) => setRegConfirm(v)}
                  />
                  {regConfirm && (
                    <p
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        marginTop: '8px',
                        marginBottom: 0,
                        color: confirmMatch ? '#10b981' : '#ef4444',
                      }}
                    >
                      {confirmMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </p>
                  )}
                </div>
                {error && <p style={errorText}>{error}</p>}
                <Btn loading={loading}>{loading ? 'Creating account…' : 'Register'}</Btn>
              </form>
              <Switch>
                Already have an account?{' '}
                <Anchor onClick={() => switchTo('login')}>Sign in</Anchor>
              </Switch>
            </>
          )}

          {view === 'verify' && (
            <>
              <p style={badge}>Almost there</p>
              <h2 style={heading}>Verify your email</h2>
              <p style={{ color: '#64748b', marginBottom: '28px', fontSize: '14px', lineHeight: 1.6 }}>
                We sent a 6-digit code to <strong style={{ color: '#0f172a' }}>{pendingEmail}</strong>.
                <br />
                Check your inbox and enter it below.
              </p>
              <form onSubmit={handleVerify} style={form}>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  required
                  style={{
                    ...fieldBase,
                    letterSpacing: '14px',
                    textAlign: 'center',
                    fontSize: '26px',
                    fontWeight: 700,
                    paddingLeft: '24px',
                  }}
                />
                {error && <p style={errorText}>{error}</p>}
                <Btn loading={loading}>{loading ? 'Verifying…' : 'Verify'}</Btn>
              </form>
              <Switch>
                <Anchor onClick={() => switchTo('login')}>← Back to sign in</Anchor>
              </Switch>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'rgba(20,184,166,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>{title}</p>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.6 }}>{desc}</p>
      </div>
    </div>
  )
}

function Field({
  placeholder,
  type = 'text',
  value,
  onChange,
  required,
}: {
  placeholder: string
  type?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      placeholder={placeholder}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...fieldBase,
        borderColor: focused ? TEAL : '#e2e8f0',
        boxShadow: focused ? `0 0 0 3px rgba(20,184,166,0.12)` : 'none',
      }}
    />
  )
}

function Btn({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: '13px',
        borderRadius: '10px',
        background: loading ? '#94a3b8' : hovered ? TEAL_DARK : TEAL,
        color: 'white',
        fontSize: '15px',
        fontWeight: 700,
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        marginTop: '4px',
        transition: 'background 0.15s',
        letterSpacing: '0.2px',
      }}
    >
      {children}
    </button>
  )
}

function Switch({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#64748b' }}>
      {children}
    </p>
  )
}

function Anchor({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: 'none', border: 'none', color: TEAL, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '14px' }}
    >
      {children}
    </button>
  )
}


const heading: CSSProperties = {
  fontSize: '26px',
  fontWeight: 800,
  color: '#0f172a',
  margin: '0 0 28px',
  letterSpacing: '-0.3px',
}

const badge: CSSProperties = {
  display: 'inline-block',
  background: 'rgba(20,184,166,0.12)',
  color: TEAL,
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
  padding: '4px 10px',
  borderRadius: '6px',
  marginBottom: '12px',
}

const form: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
}

const fieldBase: CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: '9px',
  border: '1.5px solid #e2e8f0',
  fontSize: '14px',
  background: 'white',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  color: '#0f172a',
}

const errorText: CSSProperties = {
  fontSize: '13px',
  color: '#ef4444',
  margin: 0,
  fontWeight: 500,
}
