import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// When embedded as a Chrome extension surface (popup / overlay / side panel),
// flatten the standalone window frame so the app fills its container.
const embedContext = new URLSearchParams(window.location.search).get('context')
if (embedContext) document.documentElement.dataset.context = embedContext

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
