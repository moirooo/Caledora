import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadInstagramDatabase,
  saveInstagramDatabase,
  validateImportedInstagram,
  type InstagramDatabase,
} from './instagramStorage';

const database: InstagramDatabase = {
  version: 1,
  profiles: [{
    id: 'twitter-media-profile',
    username: 'twitter.media.profile',
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
    followers: 10,
    following: 2,
    relations: [],
    twitter: {
      handle: '@TwitterMediaProfile',
      avatar: '/api/images/twitter/avatar.png',
      banner: '/api/images/twitter/banner.webp',
    },
  }],
  posts: [],
  stories: [],
  highlights: [],
};

test('preserves canonical Twitter profile media through local storage', () => {
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    },
  });
  const originalDispatchEvent = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { dispatchEvent: () => undefined },
  });

  try {
    const validated = validateImportedInstagram(database, []);
    assert.ok(validated);
    saveInstagramDatabase(validated, 'twitter');
    const restored = loadInstagramDatabase([]);
    const twitter = restored.profiles.find(profile => profile.id === 'twitter-media-profile')?.twitter;
    assert.equal(twitter?.handle, '@TwitterMediaProfile');
    assert.equal(twitter?.avatar, '/api/images/twitter/avatar.png');
    assert.equal(twitter?.banner, '/api/images/twitter/banner.webp');
  } finally {
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (originalDispatchEvent) Object.defineProperty(globalThis, 'window', { configurable: true, value: originalDispatchEvent });
    else Reflect.deleteProperty(globalThis, 'window');
  }
});