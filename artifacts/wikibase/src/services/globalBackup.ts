import { deleteRestoredMedia, getUploadedMedia, uploadMedia, type MediaUploadFolder } from '@workspace/media-upload';
import { isWikiPage, loadPages, savePagesAsync, type WikiPage, waitForPendingPageWrites } from '@/lib/wikibase';
import {
  loadInstagramDatabase,
  saveInstagramDatabase,
  validateImportedInstagram,
  type InstagramDatabase,
} from '@/services/instagramStorage';
import { deleteInstagramImage, readInstagramImage, restoreInstagramImage } from '@/services/instagramMediaStorage';

const BACKUP_SCHEMA = 'caledoraos-global-backup';
const BACKUP_VERSION = 1;
const TWITTER_STORAGE_KEY = 'caledora-x-tweets';
const INSTAGRAM_STORAGE_KEY = 'caledora-instagram-v1';
const SERVER_MEDIA = /^\/api\/images\/(shared|instagram|wikibase|twitter|airways)\/([^/?#]+)$/;
const CLOUD_MEDIA = /^\/api\/storage\/objects\/uploads\/[0-9a-f-]{36}$/;
const MAX_MEDIA_ITEMS = 200;
const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const MAX_BACKUP_BYTES = 60 * 1024 * 1024;
const UPLOAD_MEDIA = /^upload:[a-zA-Z0-9-]{1,80}$/;
const MEDIA_MIME = /^image\/(?:svg\+xml|png|jpeg|webp)$/i;

export type GlobalBackupMedia = {
  source: string;
  dataUrl: string;
  mimeType: string;
};

export type GlobalBackup = {
  schema: typeof BACKUP_SCHEMA;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  wikibase: { pages: WikiPage[] };
  instagram: InstagramDatabase;
  twitter: { tweets: unknown[] | null };
  media: GlobalBackupMedia[];
};

export type BackupExportResult = {
  backup: GlobalBackup;
  skippedMedia: number;
};

export type BackupImportResult = {
  legacy: boolean;
  pages: number;
  profiles: number;
  posts: number;
  tweets: number;
  conflicts: number;
  restoredMedia: number;
  skippedMedia: number;
};

export type BackupWriteOperations = {
  writePages: () => Promise<void>;
  writeInstagram: () => void | Promise<void>;
  writeTweets: () => void | Promise<void>;
  rollbackPages: () => Promise<void>;
  rollbackInstagram: () => void | Promise<void>;
  rollbackTweets: () => void | Promise<void>;
};

const COMPENSATION_ATTEMPTS = 3;

async function retryCompensation(operation: () => void | Promise<void>): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < COMPENSATION_ATTEMPTS; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Retries independent compensating writes, then keeps every remaining failure
 * visible to the caller rather than silently reporting a fully rolled back import.
 */
export async function runBackupCompensation(operations: Array<() => void | Promise<void>>): Promise<void> {
  const failures: unknown[] = [];
  for (const operation of operations) {
    try {
      await retryCompensation(operation);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, 'La restauration partielle n’a pas pu être annulée complètement.');
}

/**
 * Commits the three independent browser stores as one logical import. Browsers
 * do not offer an atomic transaction across IndexedDB and localStorage, so any
 * failed write restores every store whose write may already have started.
 */
export async function commitBackupWrites(operations: BackupWriteOperations): Promise<void> {
  let pagesWriteAttempted = false;
  let instagramWriteAttempted = false;
  let tweetsWriteAttempted = false;
  try {
    pagesWriteAttempted = true;
    await operations.writePages();
    instagramWriteAttempted = true;
    await operations.writeInstagram();
    tweetsWriteAttempted = true;
    await operations.writeTweets();
  } catch (error) {
    const rollbacks = [
      pagesWriteAttempted ? operations.rollbackPages : undefined,
      instagramWriteAttempted ? operations.rollbackInstagram : undefined,
      tweetsWriteAttempted ? operations.rollbackTweets : undefined,
    ].filter((operation): operation is () => void | Promise<void> => Boolean(operation));
    try {
      await runBackupCompensation(rollbacks);
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'L’import et son annulation ont échoué.');
    }
    throw error;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function isXAccount(value: unknown) {
  return isRecord(value)
    && ['handle', 'name', 'initials', 'avatarColor', 'category'].every(key => isString(value[key]) && value[key].trim().length > 0)
    && (value.avatarUrl === undefined || isString(value.avatarUrl))
    && (value.country === undefined || isString(value.country))
    && (value.badge === 'gold' || value.badge === 'blue' || value.badge === null)
    && (value.isSystem === undefined || typeof value.isSystem === 'boolean');
}

function isTweet(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && isString(value.id) && value.id.trim().length > 0 && isXAccount(value.acct) && isString(value.text)
    && isFiniteNumber(value.ts) && isFiniteNumber(value.likes) && value.likes >= 0
    && isFiniteNumber(value.retweets) && value.retweets >= 0 && isFiniteNumber(value.views) && value.views >= 0
    && typeof value.liked === 'boolean' && typeof value.retweeted === 'boolean'
    && (value.imageUrl === undefined || isString(value.imageUrl))
    && (value.editedAt === undefined || isFiniteNumber(value.editedAt))
    && Array.isArray(value.replies) && value.replies.every(reply => isRecord(reply)
      && isString(reply.id) && reply.id.trim().length > 0 && isXAccount(reply.acct) && isString(reply.text)
      && isFiniteNumber(reply.likes) && reply.likes >= 0 && isFiniteNumber(reply.ts)
      && (reply.retweets === undefined || (isFiniteNumber(reply.retweets) && reply.retweets >= 0))
      && (reply.views === undefined || (isFiniteNumber(reply.views) && reply.views >= 0))
      && (reply.editedAt === undefined || isFiniteNumber(reply.editedAt)));
}

function mediaSources(value: unknown, sources = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (value.startsWith('upload:') || SERVER_MEDIA.test(value) || CLOUD_MEDIA.test(value)) sources.add(value);
    return sources;
  }
  if (Array.isArray(value)) {
    value.forEach(item => mediaSources(item, sources));
    return sources;
  }
  if (isRecord(value)) Object.values(value).forEach(item => mediaSources(item, sources));
  return sources;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('image_encoding_failed'));
    reader.onerror = () => reject(reader.error ?? new Error('image_encoding_failed'));
    reader.readAsDataURL(blob);
  });
}

function jsonByteSize(value: unknown) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return Number.POSITIVE_INFINITY;
  return new TextEncoder().encode(serialized).byteLength;
}

async function sourceToBlob(source: string): Promise<Blob | undefined> {
  if (UPLOAD_MEDIA.test(source) || CLOUD_MEDIA.test(source)) return readInstagramImage(source);
  if (!SERVER_MEDIA.test(source)) return undefined;
  const response = await fetch(source, { credentials: 'include' });
  if (!response.ok) throw new Error(`image_fetch_failed:${response.status}`);
  return response.blob();
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',', 2);
  const match = /^data:([^;,]+);base64$/i.exec(header ?? '');
  if (!match || !encoded) throw new Error('invalid_image_data');
  if (encoded.length > Math.ceil(MAX_MEDIA_BYTES * 4 / 3) + 8) throw new Error('image_too_large');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error('invalid_image_data');
  }
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (!isImagePayload(bytes, match[1])) throw new Error('invalid_image_data');
  return new Blob([bytes], { type: match[1] });
}

function isImagePayload(bytes: Uint8Array, mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime === 'image/png') return bytes.length >= 8
    && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/webp') return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (mime === 'image/svg+xml') {
    const source = new TextDecoder().decode(bytes.slice(0, 1024)).trimStart();
    return /^(?:<\?xml[\s\S]*?\?>\s*)?<svg(?:\s+[A-Za-z_:][\w:.-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))*\s*>/i.test(source);
  }
  return false;
}

function isSupportedMediaSource(source: string) {
  return UPLOAD_MEDIA.test(source) || SERVER_MEDIA.test(source) || CLOUD_MEDIA.test(source);
}

function validateMediaDataUrl(dataUrl: string, mimeType: string) {
  if (!MEDIA_MIME.test(mimeType)) return false;
  try {
    const blob = dataUrlToBlob(dataUrl);
    return blob.size <= MAX_MEDIA_BYTES && blob.type.toLowerCase() === mimeType.toLowerCase();
  } catch {
    return false;
  }
}

function extensionFor(source: string, mimeType: string) {
  const extension = /\.(svg|png|jpe?g|webp)$/i.exec(source)?.[1]?.toLowerCase();
  if (extension) return extension === 'jpeg' ? 'jpg' : extension;
  if (mimeType === 'image/svg+xml') return 'svg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function folderFor(source: string): MediaUploadFolder {
  const match = SERVER_MEDIA.exec(source);
  return (match?.[1] as MediaUploadFolder | undefined) ?? 'shared';
}

function replaceMediaSources<T>(value: T, replacements: Map<string, string>): T {
  if (typeof value === 'string') return (replacements.get(value) ?? value) as T;
  if (Array.isArray(value)) return value.map(item => replaceMediaSources(item, replacements)) as T;
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceMediaSources(item, replacements)])) as T;
  }
  return value;
}

function currentTweets(): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TWITTER_STORAGE_KEY) ?? 'null');
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function restoreRawStorageValue(key: string, value: string | null): void {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

function mergePages(existing: WikiPage[], imported: WikiPage[]) {
  return [...new Map([...existing, ...imported].map(page => [page.id, page])).values()];
}

export function mergeRecordsById<T extends { id: string }>(existing: T[], imported: T[]) {
  return [...new Map([...existing, ...imported].map(item => [item.id, item])).values()];
}

function mergeInstagram(existing: InstagramDatabase, imported: InstagramDatabase, pages: WikiPage[]) {
  return validateImportedInstagram({
    version: 1,
    profiles: mergeRecordsById(existing.profiles, imported.profiles),
    posts: mergeRecordsById(existing.posts, imported.posts),
    stories: mergeRecordsById(existing.stories, imported.stories),
    highlights: mergeRecordsById(existing.highlights, imported.highlights),
  }, pages) ?? existing;
}

function mergeTweets(existing: unknown[] | null, imported: unknown[]) {
  if (!existing) return imported;
  const indexed = new Map<string, unknown>();
  for (const item of existing) {
    const id = isRecord(item) && typeof item.id === 'string' ? item.id : '';
    if (id) indexed.set(id, item);
  }
  for (const item of imported) {
    const id = isRecord(item) && typeof item.id === 'string' ? item.id : '';
    if (id) indexed.set(id, item);
  }
  return [...indexed.values()];
}

export function countUniqueConflicts(existing: Array<{ id: string }>, imported: Array<{ id: string }>) {
  const existingIds = new Set(existing.map(item => item.id));
  return new Set(imported.filter(item => existingIds.has(item.id)).map(item => item.id)).size;
}

function hasUniqueIds(values: Array<{ id: string }>) {
  return new Set(values.map(item => item.id)).size === values.length;
}

export function legacyBackupPages(value: unknown): WikiPage[] | null {
  const pages = Array.isArray(value) && value.every(isWikiPage)
    ? value as WikiPage[]
    : isRecord(value) && Array.isArray(value.pages) && value.pages.every(isWikiPage)
      ? value.pages as WikiPage[]
      : null;
  return pages && hasUniqueIds(pages) ? pages : null;
}

export function validateGlobalBackup(value: unknown): GlobalBackup | null {
  if (jsonByteSize(value) > MAX_BACKUP_BYTES) return null;
  if (!isRecord(value) || value.schema !== BACKUP_SCHEMA || value.version !== BACKUP_VERSION) return null;
  const pages = isRecord(value.wikibase) && Array.isArray(value.wikibase.pages) ? value.wikibase.pages : null;
  const instagram = value.instagram;
  const tweets = isRecord(value.twitter) && (Array.isArray(value.twitter.tweets) || value.twitter.tweets === null) ? value.twitter.tweets : undefined;
  if (!pages || !instagram || tweets === undefined || !pages.every(isWikiPage)
    || !hasUniqueIds(pages)
    || (tweets !== null && (!Array.isArray(tweets) || !tweets.every(isTweet)
      || !hasUniqueIds(tweets as Array<{ id: string }>)
      || tweets.some(tweet => !hasUniqueIds(tweet.replies as Array<{ id: string }>))))) return null;
  const validatedInstagram = validateImportedInstagram(instagram, pages as WikiPage[]);
  if (!validatedInstagram) return null;
  if (!Array.isArray(value.media) || value.media.length > MAX_MEDIA_ITEMS) return null;
  const media: GlobalBackupMedia[] = [];
  const mediaSourcesSeen = new Set<string>();
  let mediaBytes = 0;
  for (const item of value.media) {
    if (!isRecord(item) || !isString(item.source) || !isString(item.dataUrl) || !isString(item.mimeType)
      || !isSupportedMediaSource(item.source) || mediaSourcesSeen.has(item.source)
      || !validateMediaDataUrl(item.dataUrl, item.mimeType)) return null;
    mediaSourcesSeen.add(item.source);
    mediaBytes += dataUrlToBlob(item.dataUrl).size;
    if (mediaBytes > MAX_BACKUP_BYTES) return null;
    media.push({ source: item.source, dataUrl: item.dataUrl, mimeType: item.mimeType });
  }
  if (jsonByteSize({ ...value, media }) > MAX_BACKUP_BYTES) return null;
  return {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : '',
    wikibase: { pages: pages as WikiPage[] },
    instagram: validatedInstagram,
    twitter: { tweets: tweets as unknown[] | null },
    media,
  };
}

export async function createGlobalBackup(): Promise<BackupExportResult> {
  await waitForPendingPageWrites();
  const pages = await loadPages();
  const instagram = loadInstagramDatabase(pages);
  const tweets = currentTweets();
  const sources = mediaSources({ pages, instagram, tweets, library: getUploadedMedia().map(item => item.path) });
  const media: GlobalBackupMedia[] = [];
  let skippedMedia = 0;
  const backupWithoutMedia: Omit<GlobalBackup, 'media'> = {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    wikibase: { pages },
    instagram,
    twitter: { tweets },
  };
  let serializedBytes = jsonByteSize({ ...backupWithoutMedia, media });
  if (serializedBytes > MAX_BACKUP_BYTES) {
    throw new Error('Les données textuelles dépassent la limite de 60 Mo de la sauvegarde.');
  }

  for (const source of sources) {
    try {
      const blob = await sourceToBlob(source);
      if (!blob || blob.size > MAX_MEDIA_BYTES || media.length >= MAX_MEDIA_ITEMS || !MEDIA_MIME.test(blob.type)) {
        skippedMedia += 1;
        continue;
      }
      const entry = { source, dataUrl: await blobToDataUrl(blob), mimeType: blob.type || 'application/octet-stream' };
      // The backup is imported as the exact same JSON file. Budget with the
      // serialized bytes, rather than just raw image bytes, to guarantee that
      // every download remains within the accepted import limit.
      const entryBytes = jsonByteSize(entry) + (media.length ? 1 : 0);
      if (serializedBytes + entryBytes > MAX_BACKUP_BYTES) { skippedMedia += 1; continue; }
      media.push(entry);
      serializedBytes += entryBytes;
    } catch {
      skippedMedia += 1;
    }
  }

  const backup: GlobalBackup = { ...backupWithoutMedia, media };
  if (jsonByteSize(backup) > MAX_BACKUP_BYTES) {
    throw new Error('La sauvegarde dépasserait la limite de 60 Mo.');
  }
  return {
    backup,
    skippedMedia,
  };
}

export async function restoreMedia(media: GlobalBackupMedia[]) {
  const replacements = new Map<string, string>();
  const cleanupTasks: Array<() => Promise<void>> = [];
  let restoredMedia = 0;
  let skippedMedia = 0;
  for (const entry of media) {
    try {
      const blob = dataUrlToBlob(entry.dataUrl);
      let destination: string;
      if (UPLOAD_MEDIA.test(entry.source)) {
        destination = await restoreInstagramImage(blob);
        cleanupTasks.push(() => deleteInstagramImage(destination));
      } else if (SERVER_MEDIA.test(entry.source) || CLOUD_MEDIA.test(entry.source)) {
        const name = `restored-${crypto.randomUUID()}.${extensionFor(entry.source, entry.mimeType)}`;
        const file = new File([blob], name, { type: entry.mimeType });
        destination = (await uploadMedia(file, folderFor(entry.source))).path;
        cleanupTasks.push(() => deleteRestoredMedia(destination));
      } else {
        continue;
      }
      replacements.set(entry.source, destination);
      restoredMedia += 1;
    } catch (error) {
      // A failed upload whose own compensating DELETE also failed is not an
      // optional missing image: it may have left a remote file behind. Undo
      // already restored media and surface the incomplete rollback.
      if (error instanceof AggregateError) {
        try {
          await runBackupCompensation(cleanupTasks);
        } catch (cleanupError) {
          throw new AggregateError([error, cleanupError], 'La restauration des médias et son annulation ont échoué.');
        }
        throw error;
      }
      skippedMedia += 1;
    }
  }
  return {
    replacements,
    restoredMedia,
    skippedMedia,
    cleanup: () => runBackupCompensation(cleanupTasks),
  };
}

export async function importGlobalBackup(value: unknown): Promise<BackupImportResult> {
  if (jsonByteSize(value) > MAX_BACKUP_BYTES) {
    throw new Error('Cette sauvegarde dépasse la limite de 60 Mo.');
  }
  const parsed = validateGlobalBackup(value);
  const legacyPages = legacyBackupPages(value);

  if (!parsed && !legacyPages) throw new Error('Ce fichier n’est pas une sauvegarde CaledoraOS valide.');

  const existingPages = await loadPages();
  if (!parsed) {
    const pages = mergePages(existingPages, legacyPages ?? []);
    if (!legacyPages?.length) throw new Error('Cette ancienne sauvegarde ne contient aucun article.');
    await savePagesAsync(pages);
    return {
      legacy: true,
      pages: legacyPages.length,
      profiles: 0,
      posts: 0,
      tweets: 0,
      conflicts: countUniqueConflicts(existingPages, legacyPages),
      restoredMedia: 0,
      skippedMedia: 0,
    };
  }

  const prevalidatedInstagram = validateImportedInstagram(parsed.instagram, parsed.wikibase.pages);
  if (!prevalidatedInstagram) throw new Error('La section Instagram de cette sauvegarde est invalide.');
  const priorInstagramRaw = localStorage.getItem(INSTAGRAM_STORAGE_KEY);
  const priorInstagram = loadInstagramDatabase(existingPages);
  const priorTweetsRaw = localStorage.getItem(TWITTER_STORAGE_KEY);
  const priorTweets = currentTweets();
  const conflicts = countUniqueConflicts(existingPages, parsed.wikibase.pages)
    + countUniqueConflicts(priorInstagram.profiles, prevalidatedInstagram.profiles)
    + countUniqueConflicts(priorInstagram.posts, prevalidatedInstagram.posts)
    + countUniqueConflicts(priorInstagram.stories, prevalidatedInstagram.stories)
    + countUniqueConflicts(priorInstagram.highlights, prevalidatedInstagram.highlights)
    + countUniqueConflicts((priorTweets ?? []).filter(isTweet) as Array<{ id: string }>, (parsed.twitter.tweets ?? []).filter(isTweet) as Array<{ id: string }>);

  // Every byte of the backup, including encoded media, has been validated
  // before this point. Hydration can still skip an unavailable destination,
  // but malformed input never reaches the primary data stores.
  const restored = await restoreMedia(parsed.media);
  try {
    const importedPages = replaceMediaSources(parsed.wikibase.pages, restored.replacements);
    const pages = mergePages(existingPages, importedPages);
    const importedInstagram = replaceMediaSources(parsed.instagram, restored.replacements);
    const validatedInstagram = validateImportedInstagram(importedInstagram, pages);
    if (!validatedInstagram) throw new Error('La section Instagram de cette sauvegarde est invalide.');
    const instagram = mergeInstagram(priorInstagram, validatedInstagram, pages);
    const importedTweets = replaceMediaSources(parsed.twitter.tweets, restored.replacements);
    const tweets = importedTweets ? mergeTweets(priorTweets, importedTweets) : priorTweets;

    await commitBackupWrites({
      writePages: () => savePagesAsync(pages),
      writeInstagram: () => saveInstagramDatabase(instagram),
      writeTweets: () => {
        if (tweets) localStorage.setItem(TWITTER_STORAGE_KEY, JSON.stringify(tweets));
      },
      rollbackPages: () => savePagesAsync(existingPages),
      rollbackInstagram: () => restoreRawStorageValue(INSTAGRAM_STORAGE_KEY, priorInstagramRaw),
      rollbackTweets: () => restoreRawStorageValue(TWITTER_STORAGE_KEY, priorTweetsRaw),
    });
    return {
      legacy: false,
      pages: importedPages.length,
      profiles: validatedInstagram.profiles.length,
      posts: validatedInstagram.posts.length,
      tweets: importedTweets?.length ?? 0,
      conflicts,
      restoredMedia: restored.restoredMedia,
      skippedMedia: restored.skippedMedia,
    };
  } catch (error) {
    try {
      await restored.cleanup();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'L’import et le nettoyage des médias restaurés ont échoué.');
    }
    throw error;
  }
}

export function isBackupFileSizeValid(size: number) {
  return size <= MAX_BACKUP_BYTES;
}

export function downloadGlobalBackup(backup: GlobalBackup) {
  // Keep the downloaded bytes identical to the compact serialization used when
  // enforcing the import limit in createGlobalBackup.
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `caledoraos-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
