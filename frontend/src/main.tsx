import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './index.css'
import { AuthProvider } from './app/context/AuthContext'
import { JournalJobProvider } from './app/context/JournalJobContext'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <JournalJobProvider>
          <App />
        </JournalJobProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
