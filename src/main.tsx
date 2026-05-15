import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// When embedded as a Chrome extension surface (overlay iframe or side panel),
// flatten the standalone window frame so the app fills its container. The
// overlay passes ?context=overlay; the side panel loads this page directly,
// so any top-level chrome-extension:// page without a context is the panel.
const embedContext =
  new URLSearchParams(window.location.search).get('context') ??
  (window.location.protocol === 'chrome-extension:' ? 'sidepanel' : null)
if (embedContext) document.documentElement.dataset.context = embedContext

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
