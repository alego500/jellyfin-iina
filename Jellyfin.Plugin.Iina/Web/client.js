(() => {
  // src/core.js
  var VIDEO_TYPES = /* @__PURE__ */ new Set(["Video", "Movie", "Episode", "MusicVideo", "Trailer"]);
  function getItemId(locationLike) {
    const url = new URL(locationLike.href);
    const directId = url.searchParams.get("id");
    if (directId) return directId;
    const queryIndex = url.hash.indexOf("?");
    if (queryIndex === -1) return null;
    return new URLSearchParams(url.hash.slice(queryIndex + 1)).get("id");
  }
  function isPlayableVideo(item) {
    return Boolean(item?.Id) && (item.MediaType === "Video" || VIDEO_TYPES.has(item.Type));
  }
  function buildIinaUrl({ streamUrl, startSeconds = 0, fullscreen = false }) {
    const url = new URL("iina://open");
    url.searchParams.set("url", streamUrl);
    url.searchParams.set("new_window", "1");
    if (fullscreen) url.searchParams.set("full_screen", "1");
    const position = Number(startSeconds);
    url.searchParams.set(
      "mpv_start",
      String(Number.isFinite(position) && position > 0 ? Math.floor(position) : 0)
    );
    return url.toString();
  }
  function resumeSeconds(item) {
    const ticks = Number(item?.UserData?.PlaybackPositionTicks ?? 0);
    return Number.isFinite(ticks) && ticks > 0 ? ticks / 1e7 : 0;
  }

  // src/main.js
  var MENU_ITEM_CLASS = "jellyfinOpenInIinaMenuItem";
  var MENU_TIMEOUT_MS = 1e4;
  var pendingMenu = null;
  var scheduled = false;
  var requestId = 0;
  function activeDetailsPage() {
    return [...document.querySelectorAll(".itemDetailPage")].find((page) => !page.classList.contains("hide")) ?? null;
  }
  function selectedItemId(page) {
    return page.querySelector(".selectSource")?.value || getItemId(window.location);
  }
  function makeMenuItem(iinaUrl) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `listItem listItem-button actionSheetMenuItem ${MENU_ITEM_CLASS}`;
    button.dataset.id = "open-in-iina";
    button.setAttribute("is", "emby-button");
    button.innerHTML = [
      '<span class="actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons open_in_new" aria-hidden="true"></span>',
      '<div class="listItemBody actionsheetListItemBody">',
      '<div class="listItemBodyText actionSheetItemText">Open in IINA</div>',
      "</div>"
    ].join("");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.closest(".dialogContainer")?.click();
      window.location.assign(iinaUrl);
    });
    return button;
  }
  function reportError(error) {
    console.error("[Jellyfin IINA]", error);
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
      const anchor = actionSheet.querySelector('[data-id="copy-stream"]') ?? actionSheet.querySelector('[data-id="download"]');
      if (anchor) {
        anchor.after(button);
      } else {
        actionSheet.querySelector(".actionSheetScroller")?.append(button);
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
    const actionSheet = [...document.querySelectorAll(".actionSheet.opened")].find((sheet) => !sheet.dataset.jellyfinIinaProcessed);
    if (!actionSheet) return;
    actionSheet.dataset.jellyfinIinaProcessed = "true";
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
    const detailButton = target.closest(".btnMoreCommands");
    if (detailButton && page?.contains(detailButton)) {
      return selectedItemId(page);
    }
    const cardMenuButton = target.closest('[data-action="menu"]');
    const itemElement = cardMenuButton?.closest("[data-id][data-serverid]");
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
  if (document.querySelector('meta[name="application-name"][content="Jellyfin"]')) {
    document.addEventListener("click", onMoreMenuClick, true);
    new MutationObserver(scheduleSync).observe(document.body, { childList: true, subtree: true });
  }
})();
