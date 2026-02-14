import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n'
import { ThemeProvider } from './theme'
import { setupExternalLinkHandler } from './lib/tauri-bridge'

// Setup external link handler for Tauri (opens URLs in default browser)
setupExternalLinkHandler()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider defaultLocale="fr">
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
)
