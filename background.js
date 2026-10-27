// Opens the app in a new tab when the toolbar icon is clicked.
// If the app is already open in this window, that tab is focused instead.
const APP_URL = chrome.runtime.getURL('app/index.html');

chrome.action.onClicked.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({ url: APP_URL + '*', currentWindow: true });
    if (tabs.length) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      return;
    }
  } catch (e) { /* fall through and open a fresh tab */ }
  chrome.tabs.create({ url: APP_URL });
});
