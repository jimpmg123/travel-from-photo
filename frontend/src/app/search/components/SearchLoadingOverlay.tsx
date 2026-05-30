import { useEffect, useState } from 'react'

const MESSAGES = [
  '당신의 추억 속으로 들어가보는 중입니다',
  '사진의 단서를 모으는 중입니다',
  '세계 곳곳의 풍경과 맞춰보는 중입니다',
  '거의 다 왔어요',
]

export function SearchLoadingOverlay() {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setMessageIndex((i) => (i + 1) % MESSAGES.length)
    }, 2600)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="search-loading-overlay" role="status" aria-live="polite">
      <div className="search-loading-card">
        <div className="search-loading-sky">
          <div className="search-loading-cloud search-loading-cloud--a" />
          <div className="search-loading-cloud search-loading-cloud--b" />
          <div className="search-loading-cloud search-loading-cloud--c" />
          <div className="search-loading-plane" aria-hidden="true">
            <svg viewBox="0 0 64 64" width={64} height={64}>
              <path
                d="M2 34 L60 22 L62 18 L52 16 L40 22 L20 18 L14 22 L26 26 L18 32 L8 30 L4 32 Z"
                fill="#2d5a4c"
                stroke="#1a3a30"
                strokeWidth="0.8"
                strokeLinejoin="round"
              />
            </svg>
            <span className="search-loading-trail" />
          </div>
        </div>
        <p className="search-loading-message" key={messageIndex}>
          {MESSAGES[messageIndex]}
        </p>
        <div className="search-loading-bar">
          <div className="search-loading-bar-fill" />
        </div>
      </div>
    </div>
  )
}
