// MV3 service worker. Imports nothing so Rollup emits it as one standalone file.

const OVERLAY_MENU_ID = 'hypercalculator-toggle-overlay'

chrome.runtime.onInstalled.addListener(() => {
  // Clicking the toolbar icon opens the side panel.
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Hypercalculator: setPanelBehavior failed', error))

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

// Toggle the floating overlay. The content script is declared for all pages,
// but pages already open when the extension loaded never received it — so if
// messaging fails, inject content.js on demand and retry.
async function toggleOverlay(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_OVERLAY' })
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
      await chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_OVERLAY' })
    } catch (error) {
      console.error('Hypercalculator: cannot show overlay on this page', error)
      flashUnsupportedBadge(tabId)
    }
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === OVERLAY_MENU_ID && tab?.id !== undefined) {
    void toggleOverlay(tab.id)
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
  chrome.sidePanel
    .open({ windowId: tab.windowId })
    .catch((error) => console.error('Hypercalculator: cannot open side panel', error))
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'open-side-panel') {
    openSidePanel(tab)
    return
  }
  if (command !== 'toggle-overlay') return
  if (tab?.id !== undefined) {
    void toggleOverlay(tab.id)
    return
  }
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id
    if (tabId !== undefined) void toggleOverlay(tabId)
  })
})
