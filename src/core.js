const VIDEO_TYPES = new Set(['Video', 'Movie', 'Episode', 'MusicVideo', 'Trailer']);

export function getItemId(locationLike) {
  const url = new URL(locationLike.href);
  const directId = url.searchParams.get('id');
  if (directId) return directId;

  const queryIndex = url.hash.indexOf('?');
  if (queryIndex === -1) return null;
  return new URLSearchParams(url.hash.slice(queryIndex + 1)).get('id');
}

export function isPlayableVideo(item) {
  return Boolean(item?.Id) && (
    item.MediaType === 'Video' || VIDEO_TYPES.has(item.Type)
  );
}

export function buildIinaUrl({ streamUrl, startSeconds = 0, fullscreen = false }) {
  // Jellyfin 12 rejects the old api_key spelling. Use its supported media URL
  // parameter so IINA can also open the file without a companion plugin.
  const mediaUrl = new URL(streamUrl);
  const tokenKeys = [...mediaUrl.searchParams.keys()]
    .filter((key) => ['api_key', 'api-key', 'x-emby-token', 'apikey'].includes(key.toLowerCase()));
  const tokenKey = tokenKeys.find((key) => key.toLowerCase() === 'apikey') ?? tokenKeys[0];
  const token = tokenKey ? mediaUrl.searchParams.get(tokenKey) : null;
  for (const key of tokenKeys) mediaUrl.searchParams.delete(key);
  if (token) mediaUrl.searchParams.set('ApiKey', token);

  const url = new URL('iina://open');
  url.searchParams.set('url', mediaUrl.toString());
  url.searchParams.set('new_window', '1');
  if (fullscreen) url.searchParams.set('full_screen', '1');
  const position = Number(startSeconds);
  url.searchParams.set(
    'mpv_start',
    String(Number.isFinite(position) && position > 0 ? Math.floor(position) : 0)
  );
  return url.toString();
}

export function resumeSeconds(item) {
  const ticks = Number(item?.UserData?.PlaybackPositionTicks ?? 0);
  return Number.isFinite(ticks) && ticks > 0 ? ticks / 10_000_000 : 0;
}

export function restartIinaUrl(iinaUrl) {
  const url = new URL(iinaUrl);
  url.searchParams.set('mpv_start', '0');
  return url.toString();
}
