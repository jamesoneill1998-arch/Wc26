import React from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted variable font (weight axis): no third-party
// requests, so the Content Security Policy can stay 'self'.
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/bricolage-grotesque/wght.css'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
