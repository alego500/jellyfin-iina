import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIinaUrl,
  getItemId,
  isPlayableVideo,
  resumeSeconds
} from '../src/core.js';

test('extracts item IDs from current and legacy Jellyfin routes', () => {
  assert.equal(getItemId({ href: 'https://media.test/web/#/details?id=abc123' }), 'abc123');
  assert.equal(getItemId({ href: 'https://media.test/web/index.html#!/details?id=old456' }), 'old456');
  assert.equal(getItemId({ href: 'https://media.test/web/details?id=query789' }), 'query789');
});

test('recognizes videos', () => {
  const item = { Id: 'abc', Type: 'Episode', MediaType: 'Video', MediaSources: [{ Id: 'source-1' }] };
  assert.equal(isPlayableVideo(item), true);
  assert.equal(isPlayableVideo({ Id: 'folder', Type: 'Folder' }), false);
});

test('explicitly starts new videos at the beginning', () => {
  const copyStreamUrl = 'https://media.test/Items/abc/Download?api_key=secret-token';
  const result = buildIinaUrl({ streamUrl: copyStreamUrl });
  const url = new URL(result);
  assert.equal(url.protocol, 'iina:');
  assert.equal(url.host, 'open');
  assert.equal(url.searchParams.get('mpv_start'), '0');
  assert.equal(url.searchParams.has('mpv_http-header-fields'), false);
  assert.equal(url.searchParams.get('url'), copyStreamUrl);
});

test('passes Jellyfin resume position to IINA', () => {
  const result = buildIinaUrl({
    streamUrl: 'https://media.test/Items/abc/Download?api_key=secret-token',
    startSeconds: 62.9
  });
  assert.equal(new URL(result).searchParams.get('mpv_start'), '62');
});

test('converts Jellyfin ticks to seconds', () => {
  assert.equal(resumeSeconds({ UserData: { PlaybackPositionTicks: 125_000_000 } }), 12.5);
  assert.equal(resumeSeconds({}), 0);
});
