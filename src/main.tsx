import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setupExternalLinkHandler } from './lib/tauri-bridge'

// Setup external link handler for Tauri (opens URLs in default browser)
setupExternalLinkHandler()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
