import {
  buildIinaUrl,
  getItemId,
  isPlayableVideo,
  resumeSeconds
} from './core.js';

const MENU_ITEM_CLASS = 'jellyfinOpenInIinaMenuItem';
const MENU_TIMEOUT_MS = 10_000;
let pendingMenu = null;
let scheduled = false;
let requestId = 0;

function activeDetailsPage() {
  return [...document.querySelectorAll('.itemDetailPage')]
    .find((page) => !page.classList.contains('hide')) ?? null;
}

function selectedItemId(page) {
  return page.querySelector('.selectSource')?.value || getItemId(window.location);
}

function makeMenuItem(iinaUrl) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `listItem listItem-button actionSheetMenuItem ${MENU_ITEM_CLASS}`;
  button.dataset.id = 'open-in-iina';
  button.setAttribute('is', 'emby-button');
  button.innerHTML = [
    '<span class="actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons open_in_new" aria-hidden="true"></span>',
    '<div class="listItemBody actionsheetListItemBody">',
    '<div class="listItemBodyText actionSheetItemText">Open in IINA</div>',
    '</div>'
  ].join('');
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Clicking the dialog container uses Jellyfin's own action-sheet close path.
    button.closest('.dialogContainer')?.click();
    window.location.assign(iinaUrl);
  });
  return button;
}

function reportError(error) {
  console.error('[Jellyfin IINA]', error);
  const message = error instanceof Error ? error.message : String(error);
  if (window.Dashboard?.alert) {
    window.Dashboard.alert(`Could not add the IINA action: ${message}`);
  }
}

async function addMenuItem(actionSheet, itemId, request) {
  const apiClient = window.ApiClient;
  if (!apiClient?.accessToken?.() || !apiClient?.serverAddress?.()) return;

  try {
    const item = await apiClient.getItem(apiClient.getCurrentUserId(), itemId);
    if (request !== requestId || !actionSheet.isConnected || !isPlayableVideo(item)) return;

    const streamUrl = apiClient.getItemDownloadUrl(item.Id);
    const iinaUrl = buildIinaUrl({
      streamUrl,
      startSeconds: resumeSeconds(item)
    });
    const button = makeMenuItem(iinaUrl);
    const anchor = actionSheet.querySelector('[data-id="copy-stream"]')
      ?? actionSheet.querySelector('[data-id="download"]');

    if (anchor) {
      anchor.after(button);
    } else {
      actionSheet.querySelector('.actionSheetScroller')?.append(button);
    }
  } catch (error) {
    if (request === requestId) reportError(error);
  }
}

function syncMenu() {
  scheduled = false;
  if (!pendingMenu) return;
  if (Date.now() > pendingMenu.expiresAt) {
    pendingMenu = null;
    return;
  }

  const actionSheet = [...document.querySelectorAll('.actionSheet.opened')]
    .find((sheet) => !sheet.dataset.jellyfinIinaProcessed);
  if (!actionSheet) return;

  actionSheet.dataset.jellyfinIinaProcessed = 'true';
  const { itemId, request } = pendingMenu;
  pendingMenu = null;
  void addMenuItem(actionSheet, itemId, request);
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(syncMenu);
}

function menuItemId(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return null;

  const page = activeDetailsPage();
  const detailButton = target.closest('.btnMoreCommands');
  if (detailButton && page?.contains(detailButton)) {
    return selectedItemId(page);
  }

  const cardMenuButton = target.closest('[data-action="menu"]');
  const itemElement = cardMenuButton?.closest('[data-id][data-serverid]');
  return itemElement?.dataset.id || null;
}

function onMoreMenuClick(event) {
  const itemId = menuItemId(event);
  if (!itemId) return;

  pendingMenu = {
    itemId,
    request: ++requestId,
    expiresAt: Date.now() + MENU_TIMEOUT_MS
  };
  scheduleSync();
}

// The server plugin only loads this asset in Jellyfin Web. Keep the meta check as
// a defensive guard in case the endpoint is embedded elsewhere.
if (document.querySelector('meta[name="application-name"][content="Jellyfin"]')) {
  document.addEventListener('click', onMoreMenuClick, true);
  new MutationObserver(scheduleSync).observe(document.body, { childList: true, subtree: true });
}
