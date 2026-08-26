import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import test from 'node:test';
import { uploadMedia } from '@workspace/media-upload';
import {
  commitBackupWrites,
  countUniqueConflicts,
  legacyBackupPages,
  mergeRecordsById,
  restoreMedia,
  runBackupCompensation,
  restoreRawStorageValue,
  validateGlobalBackup,
} from './globalBackup';

const image = {
  filename: 'cover.png',
  caption: '',
  alt: 'Cover',
  alignment: 'centre',
  size: '300',
  missing: false,
};

function page(id = 'page-1') {
  return {
    id,
    title: 'Page de test',
    subtitle: '',
    aliases: [],
    introduction: '',
    infobox: [],
    sections: [{
      title: 'Galerie',
      level: 2,
      blocks: [{ type: 'gallery', images: [image] }],
    }],
    links: [],
    references: [],
    bibliography: [],
    categories: [],
    category: 'Test',
    type: 'Article',
    sourceText: '[TITRE]\nPage de test',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    history: [],
    isTrashed: false,
    infoboxImageOverride: image,
    infoboxJerseys: [{ name: 'Domicile', colors: ['#123456', '#ffffff'], image }],
  };
}

function backup() {
  return {
    schema: 'caledoraos-global-backup',
    version: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    wikibase: { pages: [page()] },
    instagram: { version: 1, profiles: [], posts: [], stories: [], highlights: [] },
    twitter: { tweets: [] },
    media: [],
  };
}

test('accepts valid WikiBase pages with nested galleries and image overrides', () => {
  assert.ok(validateGlobalBackup(backup()));
});

test('keeps Twitter profile media valid and discoverable in a global backup', () => {
  const withProfileMedia = backup();
  withProfileMedia.instagram.profiles = [{
    id: 'profile-twitter-media',
    username: 'profile.twitter.media',
    displayName: 'Profil Twitter média',
    verified: false,
    accountType: 'artiste / personnalité',
    category: 'Test',
    bio: 'Profil de test',
    avatar: 'profile.svg',
    reputation: 'populaire',
    personality: 'familier',
    communicationTone: 'proche des fans',
    status: 'populaire',
    followers: 12,
    following: 4,
    relations: [],
    twitter: {
      handle: '@ProfileTwitterMedia',
      avatar: '/api/images/twitter/avatar.png',
      banner: '/api/images/twitter/banner.webp',
    },
  }];
  withProfileMedia.media = [
    { source: '/api/images/twitter/avatar.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=', mimeType: 'image/png' },
    { source: '/api/images/twitter/banner.webp', dataUrl: 'data:image/webp;base64,UklGRgAAAABXRUJQ', mimeType: 'image/webp' },
  ];

  const validated = validateGlobalBackup(withProfileMedia);
  assert.ok(validated);
  const twitter = validated.instagram.profiles.find(profile => profile.id === 'profile-twitter-media')?.twitter;
  assert.equal(twitter?.handle, '@ProfileTwitterMedia');
  assert.equal(twitter?.avatar, '/api/images/twitter/avatar.png');
  assert.equal(twitter?.banner, '/api/images/twitter/banner.webp');
  assert.deepEqual(validated.media.map(media => media.source), [
    '/api/images/twitter/avatar.png',
    '/api/images/twitter/banner.webp',
  ]);
});

test('rejects malformed nested WikiBase content before an import can begin', () => {
  const invalid = backup();
  invalid.wikibase.pages[0].sections[0].blocks[0] = {
    type: 'gallery',
    images: [{ ...image, missing: 'false' }],
  };

  assert.equal(validateGlobalBackup(invalid), null);
});

test('rejects a malformed visual jersey image before an import can begin', () => {
  const invalid = backup();
  invalid.wikibase.pages[0].infoboxJerseys[0].image = { ...image, filename: 42 };
  assert.equal(validateGlobalBackup(invalid), null);
});

test('rejects an invalid Instagram envelope before any media hydration', () => {
  const invalid = backup();
  invalid.instagram = {};
  invalid.media = [{
    source: '/api/images/wikibase/original.png',
    dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    mimeType: 'image/png',
  }];
  assert.equal(validateGlobalBackup(invalid), null);
});

test('rejects invalid Twitter/X publications and duplicate identifiers', () => {
  const invalidTweet = backup();
  invalidTweet.twitter.tweets = [{
    id: 'tweet-1',
    acct: { handle: '@Caledora', name: 'Caledora', initials: 'CA', avatarColor: '#123456', category: 'WIKI_OFFICIAL', badge: 'gold' },
    text: 'Bonjour',
    ts: Date.now(),
    likes: '10',
    retweets: 1,
    views: 100,
    liked: false,
    retweeted: false,
    replies: [],
  }];
  assert.equal(validateGlobalBackup(invalidTweet), null);

  const duplicatePage = backup();
  duplicatePage.wikibase.pages.push(page('page-1'));
  assert.equal(validateGlobalBackup(duplicatePage), null);
  assert.equal(legacyBackupPages([page('legacy-page'), page('legacy-page')]), null);
});

test('rejects malformed and oversized encoded media', () => {
  const malformed = backup();
  malformed.media = [{ source: 'upload:image-1', dataUrl: 'data:image/png;base64,not*base64', mimeType: 'image/png' }];
  assert.equal(validateGlobalBackup(malformed), null);

  const fakeImage = backup();
  fakeImage.media = [{ source: 'upload:image-1', dataUrl: 'data:image/png;base64,aGVsbG8=', mimeType: 'image/png' }];
  assert.equal(validateGlobalBackup(fakeImage), null);

  const malformedSvg = backup();
  malformedSvg.media = [{ source: 'upload:image-1', dataUrl: 'data:image/svg+xml;base64,PHN2ZyBicm9rZW4=', mimeType: 'image/svg+xml' }];
  assert.equal(validateGlobalBackup(malformedSvg), null);

  const valuelessSvgAttribute = backup();
  valuelessSvgAttribute.media = [{ source: 'upload:image-1', dataUrl: 'data:image/svg+xml;base64,PHN2ZyBicm9rZW4+', mimeType: 'image/svg+xml' }];
  assert.equal(validateGlobalBackup(valuelessSvgAttribute), null);

  const oversized = backup();
  oversized.media = [{
    source: 'upload:image-1',
    dataUrl: `data:image/png;base64,${'A'.repeat(Math.ceil(12 * 1024 * 1024 * 4 / 3) + 9)}`,
    mimeType: 'image/png',
  }];
  assert.equal(validateGlobalBackup(oversized), null);
});

test('reports each updated identifier once and lets imports replace it', () => {
  assert.equal(countUniqueConflicts([{ id: 'same' }, { id: 'local' }], [{ id: 'same' }, { id: 'same' }]), 1);
  assert.deepEqual(
    mergeRecordsById([{ id: 'same', label: 'local' }, { id: 'local', label: 'keep' }], [{ id: 'same', label: 'backup' }]),
    [{ id: 'same', label: 'backup' }, { id: 'local', label: 'keep' }],
  );
});

test('keeps the pre-import state when IndexedDB or localStorage writes fail', async () => {
  const state = { pages: 'before', instagram: 'before', tweets: 'before' };
  await assert.rejects(
    commitBackupWrites({
      writePages: async () => { state.pages = 'after'; throw new Error('IndexedDB unavailable'); },
      writeInstagram: () => { state.instagram = 'after'; },
      writeTweets: () => { state.tweets = 'after'; },
      rollbackPages: async () => { state.pages = 'before'; },
      rollbackInstagram: () => { state.instagram = 'before'; },
      rollbackTweets: () => { state.tweets = 'before'; },
    }),
    /IndexedDB unavailable/,
  );
  assert.deepEqual(state, { pages: 'before', instagram: 'before', tweets: 'before' });

  await assert.rejects(
    commitBackupWrites({
      writePages: async () => { state.pages = 'after'; },
      writeInstagram: () => { state.instagram = 'after'; },
      writeTweets: () => { state.tweets = 'after'; throw new Error('localStorage quota exceeded'); },
      rollbackPages: async () => { state.pages = 'before'; },
      rollbackInstagram: () => { state.instagram = 'before'; },
      rollbackTweets: () => { state.tweets = 'before'; },
    }),
    /localStorage quota exceeded/,
  );
  assert.deepEqual(state, { pages: 'before', instagram: 'before', tweets: 'before' });
});

test('retries failed rollback and media cleanup operations', async () => {
  const state = { instagram: 'after', mediaPresent: true };
  let instagramRollbackAttempts = 0;
  await assert.rejects(
    commitBackupWrites({
      writePages: async () => undefined,
      writeInstagram: () => undefined,
      writeTweets: () => { throw new Error('localStorage quota exceeded'); },
      rollbackPages: async () => undefined,
      rollbackInstagram: () => {
        instagramRollbackAttempts += 1;
        if (instagramRollbackAttempts === 1) throw new Error('localStorage rollback temporarily unavailable');
        state.instagram = 'before';
      },
      rollbackTweets: () => undefined,
    }),
    /localStorage quota exceeded/,
  );
  assert.equal(instagramRollbackAttempts, 2);
  assert.equal(state.instagram, 'before');

  let mediaDeleteAttempts = 0;
  await runBackupCompensation([async () => {
    mediaDeleteAttempts += 1;
    if (mediaDeleteAttempts === 1) throw new Error('DELETE temporarily failed');
    state.mediaPresent = false;
  }]);
  assert.equal(mediaDeleteAttempts, 2);
  assert.equal(state.mediaPresent, false);
});

test('reports persistent rollback and media-cleanup failures', async () => {
  await assert.rejects(
    commitBackupWrites({
      writePages: async () => undefined,
      writeInstagram: () => undefined,
      writeTweets: () => { throw new Error('localStorage quota exceeded'); },
      rollbackPages: async () => undefined,
      rollbackInstagram: () => { throw new Error('localStorage rollback failed'); },
      rollbackTweets: () => undefined,
    }),
    error => error instanceof AggregateError
      && error.message === 'L’import et son annulation ont échoué.',
  );
  await assert.rejects(
    runBackupCompensation([async () => { throw new Error('IndexedDB delete failed'); }]),
    error => error instanceof AggregateError
      && error.message === 'La restauration partielle n’a pas pu être annulée complètement.',
  );
});

test('retries and reports a persistent production localStorage rollback failure', async () => {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let rollbackAttempts = 0;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: (key: string) => {
        if (key === 'caledora-instagram-v1') {
          rollbackAttempts += 1;
          throw new Error('localStorage rollback failed');
        }
      },
      removeItem: () => undefined,
    },
  });
  try {
    await assert.rejects(
      commitBackupWrites({
        writePages: async () => undefined,
        writeInstagram: () => undefined,
        writeTweets: () => { throw new Error('twitter storage write failed'); },
        rollbackPages: async () => undefined,
        rollbackInstagram: () => restoreRawStorageValue('caledora-instagram-v1', 'before'),
        rollbackTweets: () => undefined,
      }),
      error => error instanceof AggregateError
        && error.message === 'L’import et son annulation ont échoué.',
    );
    assert.equal(rollbackAttempts, 3);
  } finally {
    if (localStorageDescriptor) Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('removes a restored server image when its media-library write fails', async () => {
  const originalFetch = globalThis.fetch;
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const requests: Array<{ url: string; method?: string }> = [];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => '[]',
      setItem: () => { throw new Error('localStorage quota exceeded'); },
    },
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, method: init?.method });
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    return new Response(JSON.stringify({
      success: true,
      filename: 'restored-import.png',
      path: '/api/images/wikibase/restored-import.png',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    await assert.rejects(
      uploadMedia(new File([new Uint8Array([137, 80, 78, 71])], 'restored-import.png', { type: 'image/png' }), 'wikibase'),
      /localStorage quota exceeded/,
    );
    assert.deepEqual(requests, [
      { url: '/api/upload-media', method: 'POST' },
      { url: '/api/images/wikibase/restored-import.png', method: 'DELETE' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (localStorageDescriptor) Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('fails media restoration when upload cleanup cannot delete the new server file', async () => {
  const originalFetch = globalThis.fetch;
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const requests: Array<{ url: string; method?: string }> = [];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => '[]',
      setItem: () => { throw new Error('localStorage quota exceeded'); },
    },
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, method: init?.method });
    if (init?.method === 'DELETE') return new Response(null, { status: 500 });
    return new Response(JSON.stringify({
      success: true,
      filename: 'restored-import.png',
      path: '/api/images/wikibase/restored-import.png',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    await assert.rejects(
      restoreMedia([{
        source: '/api/images/wikibase/original.png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        mimeType: 'image/png',
      }]),
      error => error instanceof AggregateError
        && error.message === 'Media library persistence and cleanup both failed.',
    );
    assert.deepEqual(requests, [
      { url: '/api/upload-media', method: 'POST' },
      { url: '/api/images/wikibase/restored-import.png', method: 'DELETE' },
      { url: '/api/images/wikibase/restored-import.png', method: 'DELETE' },
      { url: '/api/images/wikibase/restored-import.png', method: 'DELETE' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (localStorageDescriptor) Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});