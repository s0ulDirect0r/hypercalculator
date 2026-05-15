# Hypercalculator

A visual math-object workbench built with React, TypeScript, Vite, Three.js, Math.js, and lucide-react.

The current prototype treats expressions as mathematical objects with matching analysis and visualization:

- a macOS-inspired calculator window
- stable 2D graphing for algebraic functions like `x^2 - 4`
- a 2D geometry lab for points, segments, circles, and triangles
- root solving over `[-10, 10]`
- symbolic derivative and antiderivative modes powered by Nerdamer
- signed integral-area context over `[-2, 2]`
- vector input such as `<3, 4>`
- complex number input such as `3 + 4i`
- surface visualization for two-variable functions like `sin(x) * cos(y)`
- optional orbit for 3D objects
- concept-aware example generation for same type, easier, harder, and surprise prompts
- a dense scientific keypad with memory, angle mode, history, and keyboard input

## Chrome extension

Hypercalculator also ships as a Manifest V3 Chrome extension. It adds two
surfaces to the browser:

- **Side panel** — click the toolbar icon, or press `Alt+Shift+H`.
- **Floating overlay** — a draggable calculator on top of the current page.
  Press `Alt+Shift+C`, or right-click and choose *Toggle Hypercalculator
  overlay*.

All computation runs locally in the browser — the extension makes no network
requests and collects no data. It requests only `activeTab`, so it can act on a
page only when you explicitly invoke it; it has no standing access to your
browsing.

### Install from source

```bash
npm install
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load
unpacked**, and select the `dist/` folder.

### Package for the Chrome Web Store

```bash
npm run package
```

This builds the extension and writes `hypercalculator-v<version>.zip` (the
version comes from `public/manifest.json`) — upload that archive to the store.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Verify

```bash
npm run lint
npm run build
```
