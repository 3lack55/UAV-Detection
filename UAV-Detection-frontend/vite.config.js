import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Polling is required for file-change detection to work inside a Docker
    // container when the source is bind-mounted from a Windows host.
    watch: {
      usePolling: true,
    },
  },
})
