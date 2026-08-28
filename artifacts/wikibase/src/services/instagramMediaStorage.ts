import { uploadMedia } from '@workspace/media-upload';

const DB_NAME = 'caledora-instagram-media';
const STORE_NAME = 'images';
const mediaUrls = new Map<string, string>();
const CLOUD_MEDIA = /^\/api\/storage\/objects\/uploads\/[0-9a-f-]{36}$/;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveInstagramImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('image_required');
  if (file.size > 12 * 1024 * 1024) throw new Error('image_too_large');
  return (await uploadMedia(file, 'instagram')).path;
}

export async function hydrateInstagramImages(media: string[]): Promise<void> {
  const uploadIds = [...new Set(media.filter(item => item.startsWith('upload:')))];
  if (!uploadIds.length) return;
  const database = await openDatabase();
  await Promise.all(uploadIds.map(async id => {
    if (mediaUrls.has(id)) return;
    const file = await new Promise<Blob | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
    if (file) mediaUrls.set(id, URL.createObjectURL(file));
  }));
  database.close();
}

export async function readInstagramImage(media: string): Promise<Blob | undefined> {
  if (CLOUD_MEDIA.test(media)) {
    const response = await fetch(media, { credentials: 'include' });
    if (!response.ok) throw new Error(`image_fetch_failed:${response.status}`);
    return response.blob();
  }
  if (!media.startsWith('upload:')) return undefined;
  const database = await openDatabase();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(media);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function restoreInstagramImage(blob: Blob): Promise<string> {
  if (!blob.type.startsWith('image/')) throw new Error('image_required');
  if (blob.size > 12 * 1024 * 1024) throw new Error('image_too_large');
  const extension = blob.type === 'image/png' ? 'png'
    : blob.type === 'image/webp' ? 'webp'
      : blob.type === 'image/svg+xml' ? 'svg'
        : 'jpg';
  const file = new File([blob], `instagram-${crypto.randomUUID()}.${extension}`, { type: blob.type });
  return (await uploadMedia(file, 'instagram')).path;
}

/** Remove a media item created during a failed backup restoration. */
export async function deleteInstagramImage(media: string): Promise<void> {
  if (CLOUD_MEDIA.test(media)) {
    const response = await fetch(media, { method: 'DELETE', credentials: 'include' });
    if (!response.ok && response.status !== 404) throw new Error(`image_delete_failed:${response.status}`);
    return;
  }
  if (!/^upload:[a-zA-Z0-9-]{1,80}$/.test(media)) return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(media);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
  const url = mediaUrls.get(media);
  if (url) URL.revokeObjectURL(url);
  mediaUrls.delete(media);
}

export function instagramMediaObjectUrl(media: string): string | undefined {
  return mediaUrls.get(media);
}