import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Never inline assets as data: URIs; the Content Security Policy only allows files from our own origin.
  build: { assetsInlineLimit: 0 },
  plugins: [react()],
})
