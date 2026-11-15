import React from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted variable font (weight axis): no third-party
// requests, so the Content Security Policy can stay 'self'.
import '@fontsource-variable/hanken-grotesk/wght.css'
import '@fontsource-variable/spline-sans-mono/wght.css'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Offline support: the service worker is built with each release (see vite.config.js).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* private mode or blocked: the site works without it */ }) })
}
