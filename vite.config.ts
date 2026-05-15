import { resolve } from 'node:path'
import { build, defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Emits the MV3 service worker and content script as standalone, non-hashed
// files once the main app build has finished — within the same `vite build`
// run. Folding the second pass into the first removes the two-command ordering
// that used to be a foot-gun: running the app build alone wiped these scripts
// (emptyOutDir), running the script build alone left no app. background.ts and
// content.ts import nothing, so Rollup emits each as one self-contained file
// (a classic content script cannot ES-import at runtime).
function extensionScripts(): Plugin {
  return {
    name: 'hypercalculator-extension-scripts',
    apply: 'build',
    async closeBundle() {
      await build({
        // configFile:false + no plugins => this child build cannot re-trigger
        // this plugin, so there is no recursion.
        configFile: false,
        build: {
          // The app build already populated dist/ — extend it, never wipe it.
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
        },
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), extensionScripts()],
  build: {
    // The calculator app (index.html). The side-panel host page lives in
    // public/ and is copied verbatim.
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
