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
    }
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === OVERLAY_MENU_ID && tab?.id !== undefined) {
    void toggleOverlay(tab.id)
  }
})

chrome.commands.onCommand.addListener((command, tab) => {
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
