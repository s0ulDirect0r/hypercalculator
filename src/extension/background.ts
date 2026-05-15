// MV3 service worker. Imports nothing so Rollup emits it as one standalone file.

const SIDE_PANEL_MENU_ID = 'hypercalculator-open-side-panel'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: SIDE_PANEL_MENU_ID,
    title: 'Open Hypercalculator side panel',
    contexts: ['all'],
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== SIDE_PANEL_MENU_ID || tab?.id === undefined) return
  void chrome.sidePanel.open({ tabId: tab.id })
})

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-overlay') return
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id
    if (tabId === undefined) return
    chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_OVERLAY' }).catch(() => {
      // No content script on this page (e.g. chrome:// pages) — ignore.
    })
  })
})
