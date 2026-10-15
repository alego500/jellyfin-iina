# Jellyfin IINA Launcher Plugin

A Jellyfin server plugin for macOS users. It adds an **Open in IINA** action to
the **More** menu for playable videos across Jellyfin Web, including Home,
library/list, and item detail pages, and asks IINA to direct-play the original
file. By default, the native play and resume buttons on video cards and detail
pages open the same item in IINA without changing Jellyfin’s button appearance.

## Requirements

- macOS with [IINA](https://iina.io/) installed
- Jellyfin Server 12.0.0 for the standard build, or 10.7.7 for the legacy build
- Existing 10.11.11 installations can continue using the 0.1.3.0 release
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

To restore Jellyfin’s normal play behavior, open **Dashboard** → **Plugins** →
**IINA Launcher**, turn off **Use IINA for play buttons on item cards and detail
pages**, and save. The change applies immediately to open Jellyfin Web tabs; the
More-menu action remains available.

The plugin injects its client script into the served Jellyfin Web page in memory.
It does not modify `jellyfin-web/index.html` on disk and does not require a
userscript manager.

The repository manifest currently lists the existing 10.x releases. Until a
Jellyfin 12 release is published and added to the manifest, build the plugin
from source using the development commands below and install its ZIP manually.

### Manual installation

Release ZIPs can also be extracted into Jellyfin's plugin directory, for example
`/var/lib/jellyfin/plugins/IINA Launcher/`. Use the normal archive for Jellyfin
12.0.0 (`JellyfinIina_0.2.0.0.zip`) or the archive ending in `_jf10.7.7.zip`
for Jellyfin 10.7.7, then restart Jellyfin. Keep using the 0.1.3.0 archive for
Jellyfin 10.11.11; the new standard build targets Jellyfin 12.

## What the MVP supports

- Movies, episodes, music videos, trailers, and other video items
- Optional routing of native card and detail-page play buttons to IINA, enabled
  by default
- Direct play through Jellyfin Web’s authenticated download URL, with older
  token parameter spellings normalized to `ApiKey` for Jellyfin 12
- Explicit playback positioning from Jellyfin, including a zero start position
  for new videos
- Jellyfin installations hosted under a URL base path

## Recommended IINA companion plugin

For automatic Jellyfin subtitle availability and playback-progress reporting,
install [IINA Jellyfin Companion](https://github.com/yxwyoyoyo/iina-jellyfin-companion)
in IINA:

1. Open IINA → Settings → Plugins.
2. Choose **Install from GitHub…**.
3. Enter `yxwyoyoyo/iina-jellyfin-companion`.

This Jellyfin server plugin supplies the **Open in IINA** action in Jellyfin
Web and passes Jellyfin's saved start position. The companion plugin keeps
embedded subtitles available, downloads every external subtitle, and reports
playback progress back to Jellyfin.

## Current limitations

- The launcher itself does not report playback progress or automatically load
  external Jellyfin subtitles; use the recommended IINA companion plugin for
  those features.
- Alternate-version selection is not exposed yet.
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

## Jellyfin 12 compatibility

The standard build targets .NET 10 and Jellyfin 12.0.0. The plugin ID is unchanged
so the server recognizes it as an update. The separate Jellyfin 10.7.7 build
still targets .NET 5.

Jellyfin 12 rejects legacy `api_key` media URLs. Before opening IINA, the launcher
normalizes that parameter to the supported `ApiKey` spelling. An existing modern
credential takes priority over an older one; base paths, other stream options,
and resume positions are preserved.

`npm test` runs the JavaScript regression tests. `npm run check` rebuilds the
embedded client and also runs the .NET tests with warnings treated as errors.
The npm build commands use `dotnet` from PATH, so they work both inside mise and
with Node and .NET installed directly.
