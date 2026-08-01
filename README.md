# Jellyfin IINA Launcher Plugin

A Jellyfin server plugin for macOS users. It adds an **Open in IINA** action to
the **More** menu for playable videos across Jellyfin Web, including Home,
library/list, and item detail pages, and asks IINA to direct-play the original
file.

## Requirements

- macOS with [IINA](https://iina.io/) installed
- Jellyfin Server 10.7.7 or 10.11.11
- A browser using the Jellyfin Web client served by that server

## Install

1. In Jellyfin, open **Dashboard** → **Plugins** → **Repositories**.
2. Add a repository named `IINA Launcher` with this URL:

   ```text
   https://raw.githubusercontent.com/yxwyoyoyo/jellyfin-iina/main/manifest.json
   ```

3. Open the plugin catalog, select **IINA Launcher**, and install it.
4. Restart Jellyfin and force-refresh Jellyfin Web.
5. Open **More** for a movie or episode, select **Open in IINA**, and allow the
   browser to open IINA when prompted.

The plugin injects its client script into the served Jellyfin Web page in memory.
It does not modify `jellyfin-web/index.html` on disk and does not require a
userscript manager.

The repository manifest includes builds for both supported Jellyfin versions and
the catalog automatically selects the compatible package.

### Manual installation

Release ZIPs can also be extracted into Jellyfin's plugin directory, for example
`/var/lib/jellyfin/plugins/IINA Launcher/`. Use the normal archive for Jellyfin
10.11.11 or the archive ending in `_jf10.7.7.zip` for Jellyfin 10.7.7, then
restart Jellyfin.

## What the MVP supports

- Movies, episodes, music videos, trailers, and other video items
- Direct play through the same authenticated URL produced by Jellyfin Web’s
  **Copy Stream URL** action
- Resume from the position stored in Jellyfin
- Jellyfin installations hosted under a URL base path

## Current limitations

- IINA playback progress is not reported back to Jellyfin. That requires a
  companion IINA plugin and is the natural next milestone.
- External subtitle selection and alternate-version selection are not exposed yet.
- Direct play only; there is no transcoding fallback.
- The UI hook targets the server-hosted Jellyfin Web client. Native clients and
  clients with a bundled web UI do not receive the injected script.

## Development

```sh
mise install
mise exec -- npm ci
mise run check
mise run package
mise run package-legacy
```

Node and .NET versions are pinned in `mise.toml`. Installable archives are
written to `out/`.
