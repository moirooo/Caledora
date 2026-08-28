import { loadPages, savePagesAsync, type WikiPage } from '@/lib/wikibase';
import {
  loadInstagramDatabase,
  saveInstagramDatabase,
  type InstagramDatabase,
} from './instagramStorage';
import { readInstagramImage } from './instagramMediaStorage';
import { getUploadedMedia, uploadMedia, type UploadedMedia } from '@workspace/media-upload';

export const SERVER_STATE_VERSION = 1;
export const INSTAGRAM_STORAGE_KEY = 'caledora-instagram-v1';
export const TWITTER_STORAGE_KEY = 'caledora-x-tweets';
export const APPEARANCE_STORAGE_KEY = 'wikibase-appearance';

export type ServerAppearance = {
  theme: 'auto' | 'light' | 'dark';
  width: 'standard' | 'large';
};

export type ServerSnapshot = {
  version: number;
  pages: WikiPage[];
  instagram: InstagramDatabase;
  tweets: unknown[];
  appearance: ServerAppearance;
  media: UploadedMedia[];
};

export type ServerStateResponse = {
  initialized: boolean;
  revision?: number;
  snapshot?: ServerSnapshot;
};

function parseJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function localAppearance(): ServerAppearance {
  const saved = parseJson<Partial<ServerAppearance>>(APPEARANCE_STORAGE_KEY);
  return {
    theme: saved?.theme === 'light' || saved?.theme === 'dark' ? saved.theme : 'auto',
    width: saved?.width === 'large' ? 'large' : 'standard',
  };
}

function collectLegacyMedia(value: unknown, result = new Set<string>()): Set<string> {
  if (typeof value === 'string' && /^upload:[a-zA-Z0-9-]{1,80}$/.test(value)) {
    result.add(value);
  } else if (Array.isArray(value)) {
    value.forEach(item => collectLegacyMedia(item, result));
  } else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(item => collectLegacyMedia(item, result));
  }
  return result;
}

function replaceLegacyMedia(value: unknown, replacements: Map<string, string>): unknown {
  if (typeof value === 'string') return replacements.get(value) ?? value;
  if (Array.isArray(value)) return value.map(item => replaceLegacyMedia(item, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, replaceLegacyMedia(item, replacements)]),
    );
  }
  return value;
}

async function migrateLegacyInstagramMedia(database: InstagramDatabase): Promise<InstagramDatabase> {
  const ids = [...collectLegacyMedia(database)];
  if (!ids.length) return database;
  const replacements = new Map<string, string>();
  for (const id of ids) {
    const blob = await readInstagramImage(id);
    if (!blob) throw new Error(`Le média local ${id} est introuvable et ne peut pas être transféré.`);
    const extension = blob.type === 'image/png' ? 'png'
      : blob.type === 'image/webp' ? 'webp'
        : blob.type === 'image/svg+xml' ? 'svg'
          : 'jpg';
    const file = new File([blob], `migration-instagram-${crypto.randomUUID()}.${extension}`, { type: blob.type });
    replacements.set(id, (await uploadMedia(file, 'instagram')).path);
  }
  const migrated = replaceLegacyMedia(database, replacements) as InstagramDatabase;
  saveInstagramDatabase(migrated, 'server');
  return migrated;
}

export async function readLocalSnapshot(): Promise<ServerSnapshot> {
  const pages = await loadPages();
  const storedInstagram = parseJson<InstagramDatabase>(INSTAGRAM_STORAGE_KEY);
  const instagram = await migrateLegacyInstagramMedia(storedInstagram ?? loadInstagramDatabase(pages));
  return {
    version: SERVER_STATE_VERSION,
    pages,
    instagram,
    tweets: parseJson<unknown[]>(TWITTER_STORAGE_KEY) ?? [],
    appearance: localAppearance(),
    media: getUploadedMedia(),
  };
}

export async function applyServerSnapshot(snapshot: ServerSnapshot): Promise<void> {
  await savePagesAsync(snapshot.pages);
  saveInstagramDatabase(snapshot.instagram, 'server');
  localStorage.setItem(TWITTER_STORAGE_KEY, JSON.stringify(snapshot.tweets));
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(snapshot.appearance));
  localStorage.setItem('caledora-media-library-v1', JSON.stringify(snapshot.media));
  window.dispatchEvent(new CustomEvent('caledora-server-state-applied'));
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : `Erreur serveur (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export function getServerState(): Promise<ServerStateResponse> {
  return request<ServerStateResponse>('/api/state');
}

export function saveServerState(
  state: ServerSnapshot,
  expectedRevision: number,
): Promise<ServerStateResponse> {
  return request<ServerStateResponse>('/api/state', {
    method: 'PUT',
    body: JSON.stringify({ snapshot: state, expectedRevision }),
  });
}