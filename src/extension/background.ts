// MV3 service worker. Imports nothing so Rollup emits it as one standalone file.

const OVERLAY_MENU_ID = 'hypercalculator-toggle-overlay'
type PanelMessageType = 'TOGGLE_OVERLAY' | 'TOGGLE_SIDE_PANEL'

function getSidePanelApi(): Partial<typeof chrome.sidePanel> | undefined {
  return chrome.sidePanel as Partial<typeof chrome.sidePanel> | undefined
}

chrome.runtime.onInstalled.addListener(() => {
  // Clicking the toolbar icon opens the side panel when the browser supports
  // Chrome's sidePanel API. Arc accepts Chrome extensions but does not expose
  // that API, so fall back to an in-page side panel instead of aborting setup.
  const sidePanel = getSidePanelApi()
  if (typeof sidePanel?.setPanelBehavior === 'function') {
    sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('Hypercalculator: setPanelBehavior failed', error))
  } else {
    void chrome.action.setTitle({ title: 'Hypercalculator — click to open side panel' })
  }

  chrome.contextMenus.create({
    id: OVERLAY_MENU_ID,
    title: 'Toggle Hypercalculator overlay',
    contexts: ['all'],
  })
})

// Flash a brief badge on the toolbar icon when the overlay cannot run on the
// current page. Content scripts are disallowed on chrome:// pages, the Chrome
// Web Store, view-source:, the new-tab page, and other extensions' pages — on
// those, toggleOverlay throws and the user would otherwise see nothing happen.
// The badge and title are per-tab so they do not leak into unrelated tabs, and
// clear after a few seconds so the icon returns to its resting state.
function flashUnsupportedBadge(tabId: number) {
  void chrome.action.setBadgeText({ tabId, text: '!' })
  void chrome.action.setBadgeBackgroundColor({ tabId, color: '#d8463f' })
  void chrome.action.setTitle({
    tabId,
    title: 'Hypercalculator can’t open the overlay on this page — use the side panel instead',
  })
  setTimeout(() => {
    // Empty string clears the per-tab override, falling back to the manifest
    // default_title and no badge.
    void chrome.action.setBadgeText({ tabId, text: '' })
    void chrome.action.setTitle({ tabId, title: '' })
  }, 4000)
}

// Toggle an in-page extension surface. The extension uses activeTab rather than
// a broad host permission, so there is no declarative content script: the first
// toggle on a page always fails the sendMessage and falls through to inject
// content.js on demand. Every toggle after that reaches the now-present content
// script directly via sendMessage.
async function toggleInPageSurface(tabId: number, type: PanelMessageType) {
  try {
    await chrome.tabs.sendMessage(tabId, { type })
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
      await chrome.tabs.sendMessage(tabId, { type })
    } catch (error) {
      console.error('Hypercalculator: cannot show calculator on this page', error)
      flashUnsupportedBadge(tabId)
    }
  }
}

function toggleOverlay(tabId: number) {
  void toggleInPageSurface(tabId, 'TOGGLE_OVERLAY')
}

function toggleSidePanelFallback(tabId: number) {
  void toggleInPageSurface(tabId, 'TOGGLE_SIDE_PANEL')
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === OVERLAY_MENU_ID && tab?.id !== undefined) {
    toggleOverlay(tab.id)
  }
})

// Open the side panel. chrome.sidePanel.open() needs a user gesture, so call it
// straight away with the gesture-carrying tab from the command event — never
// behind an await, which would let the gesture expire first. That is also why
// there is no windows.getLastFocused() fallback like toggle-overlay has:
// resolving a window asynchronously would expire the gesture. A keyboard
// command from a focused window always carries a tab; if it somehow does not,
// fail loudly rather than silently open nothing.
function openSidePanel(tab?: chrome.tabs.Tab) {
  if (tab?.windowId === undefined) {
    console.error('Hypercalculator: no window to open the side panel in')
    return
  }
  const sidePanel = getSidePanelApi()
  if (typeof sidePanel?.open === 'function') {
    sidePanel
      .open({ windowId: tab.windowId })
      .catch((error) => console.error('Hypercalculator: cannot open side panel', error))
    return
  }
  if (tab.id !== undefined) toggleSidePanelFallback(tab.id)
}

if (typeof getSidePanelApi()?.setPanelBehavior !== 'function') {
  chrome.action.onClicked.addListener(openSidePanel)
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'open-side-panel') {
    openSidePanel(tab)
    return
  }
  if (command !== 'toggle-overlay') return
  if (tab?.id !== undefined) {
    toggleOverlay(tab.id)
    return
  }
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id
    if (tabId !== undefined) toggleOverlay(tabId)
  })
})
