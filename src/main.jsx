import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'

// Two apps live in this project, code-split so each visitor only downloads the
// one they asked for: WC26 at "/", the Pokémon card tracker at "/pokemon".
const isBinder = window.location.pathname.toLowerCase().replace(/\/+$/, '').startsWith('/pokemon')

// Each lazy() wraps its own import() so Vite can attach that chunk's CSS.
const App = isBinder
  ? lazy(() => import('./pokemon/PokemonApp.jsx'))
  : lazy(() => import('./App.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0d0d0d' }} />}>
      <App />
    </Suspense>
  </StrictMode>
)
