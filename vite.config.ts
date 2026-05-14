import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('node_modules/lucide-react')) return 'icons'
          if (id.includes('node_modules/mathjs') || id.includes('node_modules/nerdamer')) return 'math'
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/react-dom') || /node_modules\/react\//.test(id)) return 'react'
        },
      },
    },
  },
  plugins: [react()],
})
