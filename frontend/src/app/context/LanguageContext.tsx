import { createContext, useContext, useState, type ReactNode } from 'react'

export const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'ru', label: 'Русский' },
]

type LanguageContextType = {
  language: string
  languageLabel: string
  setLanguage: (code: string) => void
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ko',
  languageLabel: '한국어',
  setLanguage: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(
    () => localStorage.getItem('tfp_language') ?? 'ko',
  )

  const setLanguage = (code: string) => {
    localStorage.setItem('tfp_language', code)
    setLanguageState(code)
  }

  const languageLabel = LANGUAGE_OPTIONS.find((o) => o.code === language)?.label ?? language

  return (
    <LanguageContext.Provider value={{ language, languageLabel, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
