// Content script. Imports nothing so Rollup emits it as one standalone file.
// Injects an iframe calculator surface, either as a draggable overlay or as an
// in-page side-panel fallback for browsers that do not expose chrome.sidePanel.

const CONTAINER_ID = 'hypercalculator-overlay-root'

let container: HTMLDivElement | null = null
let activeMode: 'overlay' | 'sidepanel' | null = null

function makeHeader(cursor: string): HTMLDivElement {
  const header = document.createElement('div')
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 6px 6px 12px',
    cursor,
    userSelect: 'none',
    font: "600 12px/1.4 system-ui, -apple-system, Segoe UI, sans-serif",
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(196, 246, 255, 0.86)',
    background: 'rgba(2, 4, 7, 0.95)',
    borderBottom: '1px solid rgba(126, 238, 255, 0.14)',
  } satisfies Partial<CSSStyleDeclaration>)

  const title = document.createElement('span')
  title.textContent = 'Hypercalculator'

  const close = document.createElement('button')
  close.textContent = '✕'
  Object.assign(close.style, {
    all: 'unset',
    cursor: 'pointer',
    padding: '4px 9px',
    borderRadius: '8px',
    color: 'rgba(196, 246, 255, 0.7)',
    fontSize: '13px',
  } satisfies Partial<CSSStyleDeclaration>)
  // Stop the header's drag handler from capturing the pointer, which would
  // otherwise swallow the button's click event.
  close.addEventListener('pointerdown', (event) => event.stopPropagation())
  close.addEventListener('click', hideOverlay)

  header.append(title, close)
  return header
}

function makeFrame(context: 'overlay' | 'sidepanel'): HTMLIFrameElement {
  const frame = document.createElement('iframe')
  frame.src = chrome.runtime.getURL(`index.html?context=${context}`)
  frame.title = 'Hypercalculator'
  Object.assign(frame.style, {
    flex: '1',
    width: '100%',
    border: '0',
  } satisfies Partial<CSSStyleDeclaration>)
  return frame
}

function buildOverlay(mode: 'overlay' | 'sidepanel'): HTMLDivElement {
  const root = document.createElement('div')
  root.id = CONTAINER_ID
  applyContainerMode(root, mode)

  const header = makeHeader(mode === 'overlay' ? 'move' : 'default')
  const frame = makeFrame(mode)
  root.append(header, frame)
  if (mode === 'overlay') enableDrag(root, header, frame)
  return root
}

function applyContainerMode(root: HTMLDivElement, mode: 'overlay' | 'sidepanel') {
  activeMode = mode
  const baseStyles: Partial<CSSStyleDeclaration> = {
    position: 'fixed',
    zIndex: '2147483647',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 70px rgba(0, 0, 0, 0.6)',
    background: '#050607',
    border: '1px solid rgba(126, 238, 255, 0.25)',
  }
  const modeStyles: Partial<CSSStyleDeclaration> =
    mode === 'overlay'
      ? {
          top: '24px',
          right: '24px',
          left: 'auto',
          bottom: 'auto',
          width: '420px',
          height: 'min(1240px, calc(100vh - 48px))',
          borderRadius: '14px',
        }
      : {
          top: '0',
          right: '0',
          left: 'auto',
          bottom: '0',
          width: 'min(420px, 100vw)',
          height: '100vh',
          borderRadius: '0',
        }
  Object.assign(root.style, baseStyles, modeStyles)
}

function enableDrag(root: HTMLDivElement, handle: HTMLElement, frame: HTMLIFrameElement) {
  let startX = 0
  let startY = 0
  let originLeft = 0
  let originTop = 0

  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    const rect = root.getBoundingClientRect()
    originLeft = rect.left
    originTop = rect.top
    startX = event.clientX
    startY = event.clientY
    // The iframe would swallow pointer events mid-drag — disable it briefly.
    frame.style.pointerEvents = 'none'
    handle.setPointerCapture(event.pointerId)

    const onMove = (move: PointerEvent) => {
      // Clamp so a sliver of the overlay always stays on screen — a drag past
      // an edge would otherwise strand the header (and its close button).
      const margin = 48
      const left = originLeft + move.clientX - startX
      const top = originTop + move.clientY - startY
      root.style.left = `${Math.min(Math.max(left, margin - rect.width), window.innerWidth - margin)}px`
      root.style.top = `${Math.min(Math.max(top, 0), window.innerHeight - margin)}px`
      root.style.right = 'auto'
    }
    // pointerup ends a normal release; pointercancel fires when the browser
    // takes the pointer away (touch interruption, OS gesture). Both must run
    // the same teardown, or the iframe stays click-blocked and listeners leak.
    const endDrag = (end: PointerEvent) => {
      frame.style.pointerEvents = ''
      if (handle.hasPointerCapture(end.pointerId)) handle.releasePointerCapture(end.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', endDrag)
      handle.removeEventListener('pointercancel', endDrag)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', endDrag)
    handle.addEventListener('pointercancel', endDrag)
  })
}

function hideOverlay() {
  if (container) container.style.display = 'none'
}

function toggleOverlay(mode: 'overlay' | 'sidepanel') {
  if (!container || activeMode !== mode) {
    if (container) container.remove()
    container = buildOverlay(mode)
    document.body.appendChild(container)
    return
  }
  container.style.display = container.style.display === 'none' ? 'flex' : 'none'
}

// The service worker injects this script on demand — with activeTab there is no
// declarative content script, so every in-page extension surface starts here.
// Guard the listener so a script injected more than once never registers
// duplicate listeners and toggles the overlay twice per command.
const overlayWindow = window as typeof window & { hypercalculatorOverlayBound?: boolean }
if (!overlayWindow.hypercalculatorOverlayBound) {
  overlayWindow.hypercalculatorOverlayBound = true
  chrome.runtime.onMessage.addListener((message: { type?: string }) => {
    if (message?.type === 'TOGGLE_OVERLAY') toggleOverlay('overlay')
    if (message?.type === 'TOGGLE_SIDE_PANEL') toggleOverlay('sidepanel')
  })
}
