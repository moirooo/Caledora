import { getUploadedMedia, uploadMedia, type MediaUploadFolder } from '@workspace/media-upload';
import { loadPages, savePagesAsync, type WikiPage } from '@/lib/wikibase';
import {
  loadInstagramDatabase,
  saveInstagramDatabase,
  validateImportedInstagram,
  type InstagramDatabase,
} from '@/services/instagramStorage';
import { readInstagramImage, restoreInstagramImage } from '@/services/instagramMediaStorage';

const BACKUP_SCHEMA = 'caledoraos-global-backup';
const BACKUP_VERSION = 1;
const TWITTER_STORAGE_KEY = 'caledora-x-tweets';
const SERVER_MEDIA = /^\/api\/images\/(shared|instagram|wikibase|twitter|airways)\/([^/?#]+)$/;
const MAX_MEDIA_ITEMS = 200;
const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const MAX_BACKUP_BYTES = 60 * 1024 * 1024;

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

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const isFiniteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const isKeyValueArray = (value: unknown) => Array.isArray(value) && value.every(item => isRecord(item) && isString(item.key) && isString(item.value));
const isImage = (value: unknown) => isRecord(value)
  && ['filename', 'caption', 'alt', 'alignment', 'size'].every(key => isString(value[key]))
  && typeof value.missing === 'boolean'
  && (value.src === undefined || isString(value.src));

function isWikiPage(value: unknown): value is WikiPage {
  if (!isRecord(value)) return false;
  const strings = ['id', 'title', 'subtitle', 'introduction', 'category', 'type', 'sourceText', 'updatedAt', 'createdAt'];
  if (!strings.every(key => isString(value[key])) || typeof value.isTrashed !== 'boolean') return false;
  if (!isStringArray(value.aliases) || !isKeyValueArray(value.infobox) || !isStringArray(value.links)
    || !isKeyValueArray(value.references) || !isStringArray(value.bibliography) || !isStringArray(value.categories)) return false;
  if (value.infoboxImage !== undefined && !isImage(value.infoboxImage)) return false;
  if (!Array.isArray(value.history) || !value.history.every(item => isRecord(item) && isString(item.timestamp) && isString(item.label) && isString(item.sourceText))) return false;
  if (!Array.isArray(value.sections) || !value.sections.every(section => isRecord(section) && isString(section.title) && isFiniteNumber(section.level)
    && Array.isArray(section.blocks) && section.blocks.every(block => isRecord(block) && (
      (block.type === 'text' && isString(block.content))
      || ((block.type === 'list' || block.type === 'numbered') && isStringArray(block.items))
      || (block.type === 'image' && isImage(block.image))
      || (block.type === 'table' && isRecord(block.table) && isString(block.table.title) && isStringArray(block.table.columns)
        && Array.isArray(block.table.rows) && block.table.rows.every(isStringArray))
    )))) return false;
  if (value.accentColor !== undefined && !isString(value.accentColor)) return false;
  if (value.infoboxJerseys !== undefined && (!Array.isArray(value.infoboxJerseys)
    || !value.infoboxJerseys.every(item => isRecord(item) && isString(item.name) && isStringArray(item.colors)))) return false;
  return value.infoboxSections === undefined || (Array.isArray(value.infoboxSections)
    && value.infoboxSections.every(item => isRecord(item) && isString(item.title) && isKeyValueArray(item.fields)));
}

function isXAccount(value: unknown) {
  return isRecord(value)
    && ['handle', 'name', 'initials', 'avatarColor', 'category'].every(key => isString(value[key]))
    && (value.avatarUrl === undefined || isString(value.avatarUrl))
    && (value.country === undefined || isString(value.country))
    && (value.badge === 'gold' || value.badge === 'blue' || value.badge === null)
    && (value.isSystem === undefined || typeof value.isSystem === 'boolean');
}

function isTweet(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && isString(value.id) && isXAccount(value.acct) && isString(value.text)
    && isFiniteNumber(value.ts) && isFiniteNumber(value.likes) && isFiniteNumber(value.retweets) && isFiniteNumber(value.views)
    && typeof value.liked === 'boolean' && typeof value.retweeted === 'boolean'
    && (value.imageUrl === undefined || isString(value.imageUrl))
    && (value.editedAt === undefined || isFiniteNumber(value.editedAt))
    && Array.isArray(value.replies) && value.replies.every(reply => isRecord(reply)
      && isString(reply.id) && isXAccount(reply.acct) && isString(reply.text)
      && isFiniteNumber(reply.likes) && isFiniteNumber(reply.ts)
      && (reply.editedAt === undefined || isFiniteNumber(reply.editedAt)));
}

function mediaSources(value: unknown, sources = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (value.startsWith('upload:') || SERVER_MEDIA.test(value)) sources.add(value);
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
  return new Blob([JSON.stringify(value)]).size;
}

async function sourceToBlob(source: string): Promise<Blob | undefined> {
  if (source.startsWith('upload:')) return readInstagramImage(source);
  if (!SERVER_MEDIA.test(source)) return undefined;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`image_fetch_failed:${response.status}`);
  return response.blob();
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',', 2);
  const match = /^data:([^;,]+);base64$/i.exec(header ?? '');
  if (!match || !encoded) throw new Error('invalid_image_data');
  if (encoded.length > Math.ceil(MAX_MEDIA_BYTES * 4 / 3) + 8) throw new Error('image_too_large');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
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

function mergePages(existing: WikiPage[], imported: WikiPage[]) {
  return [...new Map([...existing, ...imported].map(page => [page.id, page])).values()];
}

function mergeById<T extends { id: string }>(existing: T[], imported: T[]) {
  return [...new Map([...existing, ...imported].map(item => [item.id, item])).values()];
}

function mergeInstagram(existing: InstagramDatabase, imported: InstagramDatabase, pages: WikiPage[]) {
  return validateImportedInstagram({
    version: 1,
    profiles: mergeById(existing.profiles, imported.profiles),
    posts: mergeById(existing.posts, imported.posts),
    stories: mergeById(existing.stories, imported.stories),
    highlights: mergeById(existing.highlights, imported.highlights),
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

function countConflicts(existing: Array<{ id: string }>, imported: Array<{ id: string }>) {
  const existingIds = new Set(existing.map(item => item.id));
  return imported.reduce((count, item) => count + (existingIds.has(item.id) ? 1 : 0), 0);
}

function parseGlobalBackup(value: unknown): GlobalBackup | null {
  if (!isRecord(value) || value.schema !== BACKUP_SCHEMA || value.version !== BACKUP_VERSION) return null;
  const pages = isRecord(value.wikibase) && Array.isArray(value.wikibase.pages) ? value.wikibase.pages : null;
  const instagram = value.instagram;
  const tweets = isRecord(value.twitter) && (Array.isArray(value.twitter.tweets) || value.twitter.tweets === null) ? value.twitter.tweets : undefined;
  if (!pages || !instagram || tweets === undefined || !pages.every(isWikiPage)
    || (tweets !== null && (!Array.isArray(tweets) || !tweets.every(isTweet)))) return null;
  if (!Array.isArray(value.media) || value.media.length > MAX_MEDIA_ITEMS) return null;
  const media: GlobalBackupMedia[] = [];
  let mediaBytes = 0;
  for (const item of value.media) {
    if (!isRecord(item) || !isString(item.source) || !isString(item.dataUrl) || !isString(item.mimeType)
      || (!item.source.startsWith('upload:') && !SERVER_MEDIA.test(item.source))
      || !/^image\/(?:svg\+xml|png|jpeg|webp)$/i.test(item.mimeType)
      || item.dataUrl.length > Math.ceil(MAX_MEDIA_BYTES * 4 / 3) + 128) return null;
    mediaBytes += item.dataUrl.length;
    if (mediaBytes > Math.ceil(MAX_BACKUP_BYTES * 4 / 3)) return null;
    media.push({ source: item.source, dataUrl: item.dataUrl, mimeType: item.mimeType });
  }
  return {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : '',
    wikibase: { pages: pages as WikiPage[] },
    instagram: instagram as InstagramDatabase,
    twitter: { tweets: tweets as unknown[] | null },
    media,
  };
}

export async function createGlobalBackup(): Promise<BackupExportResult> {
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
      if (!blob || blob.size > MAX_MEDIA_BYTES || media.length >= MAX_MEDIA_ITEMS) { skippedMedia += 1; continue; }
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

async function restoreMedia(media: GlobalBackupMedia[]) {
  const replacements = new Map<string, string>();
  let restoredMedia = 0;
  let skippedMedia = 0;
  for (const entry of media) {
    try {
      const blob = dataUrlToBlob(entry.dataUrl);
      let destination: string;
      if (entry.source.startsWith('upload:')) {
        destination = await restoreInstagramImage(blob);
      } else if (SERVER_MEDIA.test(entry.source)) {
        const name = `restored-${crypto.randomUUID()}.${extensionFor(entry.source, entry.mimeType)}`;
        const file = new File([blob], name, { type: entry.mimeType });
        destination = (await uploadMedia(file, folderFor(entry.source))).path;
      } else {
        continue;
      }
      replacements.set(entry.source, destination);
      restoredMedia += 1;
    } catch {
      skippedMedia += 1;
    }
  }
  return { replacements, restoredMedia, skippedMedia };
}

export async function importGlobalBackup(value: unknown): Promise<BackupImportResult> {
  const parsed = parseGlobalBackup(value);
  const legacyPages = Array.isArray(value) && value.every(isWikiPage)
    ? value as WikiPage[]
    : isRecord(value) && Array.isArray(value.pages)
      && value.pages.every(isWikiPage) ? value.pages as WikiPage[]
      : null;

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
      conflicts: countConflicts(existingPages, legacyPages),
      restoredMedia: 0,
      skippedMedia: 0,
    };
  }

  const prevalidatedInstagram = validateImportedInstagram(parsed.instagram, parsed.wikibase.pages);
  if (!prevalidatedInstagram) throw new Error('La section Instagram de cette sauvegarde est invalide.');
  const priorInstagram = loadInstagramDatabase(existingPages);
  const priorTweetsRaw = localStorage.getItem(TWITTER_STORAGE_KEY);
  const priorTweets = currentTweets();
  const conflicts = countConflicts(existingPages, parsed.wikibase.pages)
    + countConflicts(priorInstagram.profiles, prevalidatedInstagram.profiles)
    + countConflicts(priorInstagram.posts, prevalidatedInstagram.posts)
    + countConflicts(priorInstagram.stories, prevalidatedInstagram.stories)
    + countConflicts(priorInstagram.highlights, prevalidatedInstagram.highlights)
    + countConflicts((priorTweets ?? []).filter(isTweet) as Array<{ id: string }>, (parsed.twitter.tweets ?? []).filter(isTweet) as Array<{ id: string }>);

  const restored = await restoreMedia(parsed.media);
  const importedPages = replaceMediaSources(parsed.wikibase.pages, restored.replacements);
  const pages = mergePages(existingPages, importedPages);
  const importedInstagram = replaceMediaSources(parsed.instagram, restored.replacements);
  const validatedInstagram = validateImportedInstagram(importedInstagram, pages);
  if (!validatedInstagram) throw new Error('La section Instagram de cette sauvegarde est invalide.');
  const instagram = mergeInstagram(priorInstagram, validatedInstagram, pages);
  const importedTweets = replaceMediaSources(parsed.twitter.tweets, restored.replacements);
  const tweets = importedTweets ? mergeTweets(priorTweets, importedTweets) : priorTweets;

  try {
    await savePagesAsync(pages);
    saveInstagramDatabase(instagram);
    if (tweets) localStorage.setItem(TWITTER_STORAGE_KEY, JSON.stringify(tweets));
  } catch (error) {
    await savePagesAsync(existingPages).catch(() => undefined);
    saveInstagramDatabase(priorInstagram);
    if (priorTweetsRaw === null) localStorage.removeItem(TWITTER_STORAGE_KEY);
    else localStorage.setItem(TWITTER_STORAGE_KEY, priorTweetsRaw);
    throw error;
  }

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