import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './index.css'
import { AuthProvider } from './app/context/AuthContext'
import { JournalJobProvider } from './app/context/JournalJobContext'
import { LanguageProvider } from './app/context/LanguageContext'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <JournalJobProvider>
            <App />
          </JournalJobProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
