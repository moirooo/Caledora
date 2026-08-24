const DB_NAME = 'caledora-instagram-media';
const STORE_NAME = 'images';
const mediaUrls = new Map<string, string>();

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
  const id = `upload:${crypto.randomUUID()}`;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(file, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
  mediaUrls.set(id, URL.createObjectURL(file));
  return id;
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
  const id = `upload:${crypto.randomUUID()}`;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(blob, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
  mediaUrls.set(id, URL.createObjectURL(blob));
  return id;
}

export function instagramMediaObjectUrl(media: string): string | undefined {
  return mediaUrls.get(media);
}