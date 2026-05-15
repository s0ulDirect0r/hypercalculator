import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildExtensionScripts = process.env.BUILD_TARGET === 'extension-scripts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: buildExtensionScripts
    ? {
        // Second pass: emit the MV3 service worker and content script with
        // stable, non-hashed filenames so manifest.json can reference them.
        // These two files import nothing, so Rollup emits each as one
        // self-contained file (a classic content script cannot ES-import).
        emptyOutDir: false,
        rollupOptions: {
          input: {
            background: resolve(__dirname, 'src/extension/background.ts'),
            content: resolve(__dirname, 'src/extension/content.ts'),
          },
          output: {
            format: 'es',
            entryFileNames: '[name].js',
          },
        },
      }
    : {
        // First pass: the calculator app (index.html). The popup/side-panel
        // host pages live in public/ and are copied verbatim.
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
})
