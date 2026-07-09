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

All computation runs locally in the browser. The extension does not use
analytics, accounts, tracking scripts, cookies, remote APIs, or remote font
requests, and it collects no data. It requests only `activeTab`, so it can act
on a page only when you explicitly invoke it; it has no standing access to your
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

### Publish with the Chrome Web Store API

The API flow uses Google's Chrome Web Store API v2: refresh an OAuth access
token, upload the ZIP package, then submit the item for publishing. Before
publishing for the first time, fill out the Store listing and Privacy tabs in
the Chrome Web Store Developer Dashboard. The v2 upload endpoint targets an
existing store item, so create the item in the dashboard first if needed, then
use that item ID as `CWS_EXTENSION_ID`.

Create `.env.local` (or `.env` — copy `.env.example` to get started) or export
these variables in your shell; shell variables win over `.env.local`, which
wins over `.env`:

```bash
CWS_PUBLISHER_ID=...
CWS_EXTENSION_ID=...
CWS_CLIENT_ID=...
CWS_CLIENT_SECRET=...
CWS_REFRESH_TOKEN=...
```

Then use:

```bash
npm run cws:status
npm run cws:upload
npm run cws:submit
npm run cws:publish
```

`npm run cws:publish` runs `npm run package`, uploads the resulting
`hypercalculator-v<version>.zip`, and submits it for review. Add
`-- --staged` to stage the release after approval, `-- --skip-review` to ask
Google to skip review for eligible changes, or `-- --deploy-percentage 25` for
an initial rollout percentage. To upload an exact archive without rebuilding,
pass `-- --zip <path>` to `cws:upload` or `cws:publish`.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Verify

```bash
npm run lint
npm run test
npm run build
npm run package
```
