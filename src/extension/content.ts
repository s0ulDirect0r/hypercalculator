// Content script. Imports nothing so Rollup emits it as one standalone file.
// Injects a draggable floating calculator (an iframe, for full CSS isolation
// from the host page) and toggles it on a message from the service worker.

const CONTAINER_ID = 'hypercalculator-overlay-root'

let container: HTMLDivElement | null = null

function buildOverlay(): HTMLDivElement {
  const root = document.createElement('div')
  root.id = CONTAINER_ID
  Object.assign(root.style, {
    position: 'fixed',
    top: '24px',
    right: '24px',
    width: '420px',
    height: '620px',
    zIndex: '2147483647',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: '0 24px 70px rgba(0, 0, 0, 0.6)',
    background: '#050607',
    border: '1px solid rgba(126, 238, 255, 0.25)',
  } satisfies Partial<CSSStyleDeclaration>)

  const header = document.createElement('div')
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 6px 6px 12px',
    cursor: 'move',
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
  close.addEventListener('click', hideOverlay)

  header.append(title, close)

  const frame = document.createElement('iframe')
  frame.src = chrome.runtime.getURL('index.html?context=overlay')
  frame.title = 'Hypercalculator'
  Object.assign(frame.style, {
    flex: '1',
    width: '100%',
    border: '0',
  } satisfies Partial<CSSStyleDeclaration>)

  root.append(header, frame)
  enableDrag(root, header, frame)
  return root
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
      root.style.left = `${originLeft + move.clientX - startX}px`
      root.style.top = `${originTop + move.clientY - startY}px`
      root.style.right = 'auto'
    }
    const onUp = (up: PointerEvent) => {
      frame.style.pointerEvents = ''
      handle.releasePointerCapture(up.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  })
}

function hideOverlay() {
  if (container) container.style.display = 'none'
}

function toggleOverlay() {
  if (!container) {
    container = buildOverlay()
    document.body.appendChild(container)
    return
  }
  container.style.display = container.style.display === 'none' ? 'flex' : 'none'
}

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type === 'TOGGLE_OVERLAY') toggleOverlay()
})
