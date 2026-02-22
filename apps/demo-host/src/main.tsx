import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Debug: logs paso a paso del engine (intent, state, active step, decision)
;(globalThis as any).__LUMA_ENGINE_DEBUG__ = true

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
