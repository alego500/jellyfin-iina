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

export function buildIinaUrl({ streamUrl, fullscreen = false }) {
  const url = new URL('iina://open');
  url.searchParams.set('url', streamUrl);
  url.searchParams.set('new_window', '1');
  if (fullscreen) url.searchParams.set('full_screen', '1');
  return url.toString();
}
