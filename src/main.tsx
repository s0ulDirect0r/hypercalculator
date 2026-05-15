import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// When embedded as a Chrome extension surface (overlay iframe or side panel),
// flatten the standalone window frame so the app fills its container. Both
// surfaces pass an explicit ?context= — the overlay iframe and the side panel
// (via its manifest default_path). A bare extension-origin page has no context
// and renders as the standalone app.
const embedContext = new URLSearchParams(window.location.search).get('context')
if (embedContext) document.documentElement.dataset.context = embedContext

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
