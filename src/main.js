import {
  buildIinaUrl,
  getItemId,
  isPlayableVideo,
  restartIinaUrl,
  resumeSeconds
} from './core.js';

const MENU_ITEM_CLASS = 'jellyfinOpenInIinaMenuItem';
const MENU_TIMEOUT_MS = 10_000;
const ITEM_CACHE_TTL_MS = 30_000;
const ITEM_CACHE_LIMIT = 100;
const CARD_PLAY_SELECTOR = '[data-action="play"], [data-action="resume"]';
const DETAIL_PLAY_SELECTOR = '.itemDetailPage .btnPlay, .itemDetailPage .btnReplay';
const CONFIG_EVENT = 'jellyfin-iina-config-changed';
const CONFIG_STORAGE_KEY = 'jellyfin-iina-replace-card-play';
const iinaUrlCache = new Map();
let replaceCardPlay = document.currentScript?.dataset.replaceCardPlay !== 'false';
let pendingMenu = null;
let scheduled = false;
let requestId = 0;

class NonPlayableItemError extends Error {}

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

function reportError(error, message = 'Could not open in IINA') {
  console.error('[Jellyfin IINA]', error);
  const detail = error instanceof Error ? error.message : String(error);
  if (window.Dashboard?.alert) {
    window.Dashboard.alert(`${message}: ${detail}`);
  }
}

async function iinaUrlForItem(itemId) {
  const cached = iinaUrlCache.get(itemId);
  if (cached?.expiresAt > Date.now()) return cached.promise;

  const apiClient = window.ApiClient;
  if (!apiClient?.accessToken?.() || !apiClient?.serverAddress?.()) {
    throw new Error('Jellyfin is not authenticated');
  }

  const entry = {
    expiresAt: Date.now() + ITEM_CACHE_TTL_MS,
    promise: null,
    url: null
  };
  entry.promise = apiClient.getItem(apiClient.getCurrentUserId(), itemId)
    .then((item) => {
      if (!isPlayableVideo(item)) throw new NonPlayableItemError('This item is not a playable video');
      entry.url = buildIinaUrl({
        streamUrl: apiClient.getItemDownloadUrl(item.Id),
        startSeconds: resumeSeconds(item)
      });
      return entry.url;
    })
    .catch((error) => {
      if (iinaUrlCache.get(itemId) === entry) iinaUrlCache.delete(itemId);
      throw error;
    });

  iinaUrlCache.set(itemId, entry);
  if (iinaUrlCache.size > ITEM_CACHE_LIMIT) {
    iinaUrlCache.delete(iinaUrlCache.keys().next().value);
  }
  return entry.promise;
}

function cachedIinaUrl(itemId) {
  const cached = iinaUrlCache.get(itemId);
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return cached.url;
}

async function addMenuItem(actionSheet, itemId, request) {
  try {
    const iinaUrl = await iinaUrlForItem(itemId);
    if (request !== requestId || !actionSheet.isConnected) return;
    const button = makeMenuItem(iinaUrl);
    const anchor = actionSheet.querySelector('[data-id="copy-stream"]')
      ?? actionSheet.querySelector('[data-id="download"]');

    if (anchor) {
      anchor.after(button);
    } else {
      actionSheet.querySelector('.actionSheetScroller')?.append(button);
    }
  } catch (error) {
    if (error instanceof NonPlayableItemError) return;
    if (request === requestId) reportError(error, 'Could not add the IINA action');
  }
}

function cardForTarget(target) {
  const playButton = target.closest(CARD_PLAY_SELECTOR);
  const card = playButton?.closest('[data-id][data-serverid]');
  return card ? { card, playButton } : null;
}

function decoratePlayButton(button) {
  if (button.dataset.jellyfinIinaPlay === 'true') return;
  button.dataset.jellyfinIinaPlay = 'true';
}

function iinaUrlForCard(card) {
  const apiClient = window.ApiClient;
  const itemId = card.dataset.id;
  if (
    card.dataset.mediatype?.toLowerCase() !== 'video'
    || !itemId
    || !apiClient?.accessToken?.()
    || !apiClient?.serverAddress?.()
  ) {
    return null;
  }

  return buildIinaUrl({
    streamUrl: apiClient.getItemDownloadUrl(itemId),
    startSeconds: Number(card.dataset.positionticks ?? 0) / 10_000_000
  });
}

function decorateCard(card) {
  if (!iinaUrlForCard(card)) return;
  card.querySelectorAll(CARD_PLAY_SELECTOR).forEach(decoratePlayButton);
}

function primeDetailPage(page) {
  if (!replaceCardPlay || !page) return;
  const itemId = selectedItemId(page);
  if (!itemId) return;

  void iinaUrlForItem(itemId)
    .then(() => {
      if (!page.isConnected || selectedItemId(page) !== itemId) return;
      page.querySelectorAll('.btnPlay, .btnReplay').forEach((button) => {
        button.dataset.jellyfinIinaDetailPlay = 'true';
      });
    })
    .catch(() => {
      // Leave Jellyfin's native detail buttons untouched if the item cannot be
      // resolved. A later render, hover, or focus event will retry.
    });
}

function onCardPointerOrFocus(event) {
  if (!replaceCardPlay) return;
  const target = event.target instanceof Element ? event.target : null;
  const card = target?.closest('[data-id][data-serverid]');
  if (card) decorateCard(card);
  if (target?.closest(DETAIL_PLAY_SELECTOR)) primeDetailPage(activeDetailsPage());
}

function onCardPlayClick(event) {
  if (!replaceCardPlay) return;
  const target = event.target instanceof Element ? event.target : null;
  const context = target ? cardForTarget(target) : null;
  if (!context || context.playButton.dataset.jellyfinIinaPlay !== 'true') return;

  const iinaUrl = iinaUrlForCard(context.card);
  if (!iinaUrl) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  window.location.assign(iinaUrl);
}

function onDetailPlayClick(event) {
  if (!replaceCardPlay) return;
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest(DETAIL_PLAY_SELECTOR);
  const page = button?.closest('.itemDetailPage');
  if (!button || !page || button.dataset.jellyfinIinaDetailPlay !== 'true') return;

  const itemId = selectedItemId(page);
  const cachedUrl = itemId ? cachedIinaUrl(itemId) : null;
  if (!cachedUrl) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  window.location.assign(button.classList.contains('btnReplay')
    ? restartIinaUrl(cachedUrl)
    : cachedUrl);
}

function syncMenu() {
  scheduled = false;
  primeDetailPage(activeDetailsPage());
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

function updateReplaceCardPlay(value) {
  if (typeof value !== 'boolean') return;
  replaceCardPlay = value;
  if (value) scheduleSync();
}

function onConfigChanged(event) {
  updateReplaceCardPlay(event.detail?.replaceCardPlayButton);
}

function onConfigStorageChanged(event) {
  if (event.key !== CONFIG_STORAGE_KEY || event.newValue === null) return;
  updateReplaceCardPlay(event.newValue === 'true');
}

// The server plugin only loads this asset in Jellyfin Web. Keep the meta check as
// a defensive guard in case the endpoint is embedded elsewhere.
if (document.querySelector('meta[name="application-name"][content="Jellyfin"]')) {
  document.addEventListener('click', onMoreMenuClick, true);
  document.addEventListener('click', onCardPlayClick, true);
  document.addEventListener('click', onDetailPlayClick, true);
  document.addEventListener('pointerover', onCardPointerOrFocus, true);
  document.addEventListener('focusin', onCardPointerOrFocus, true);
  document.addEventListener(CONFIG_EVENT, onConfigChanged);
  window.addEventListener('storage', onConfigStorageChanged);
  new MutationObserver(scheduleSync).observe(document.body, { childList: true, subtree: true });
  scheduleSync();
}
