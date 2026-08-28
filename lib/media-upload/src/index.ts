export type MediaUploadFolder = "shared" | "instagram" | "wikibase" | "twitter" | "airways";

export type UploadedMedia = {
  success: true;
  filename: string;
  path: string;
};

const MEDIA_LIBRARY_KEY = "caledora-media-library-v1";
const RESTORED_MEDIA_PATH = /^\/api\/images\/(?:shared|instagram|wikibase|twitter|airways)\/restored-[a-zA-Z0-9._-]+\.(?:svg|png|jpe?g|webp)$/i;
const CLOUD_MEDIA_PATH = /^\/api\/storage\/objects\/uploads\/[0-9a-f-]{36}$/;
const DELETE_ATTEMPTS = 3;

async function deleteRestoredMediaFile(path: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < DELETE_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(path, { method: "DELETE" });
      if (response.ok || response.status === 404) return;
      lastError = new Error("Restored media could not be deleted.");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function getUploadedMedia(): UploadedMedia[] {
  try {
    const value = JSON.parse(localStorage.getItem(MEDIA_LIBRARY_KEY) || "[]");
    return Array.isArray(value) ? value.filter(item => item?.success === true && typeof item.path === "string") : [];
  } catch {
    return [];
  }
}

export async function uploadMedia(file: File, folder: MediaUploadFolder = "shared"): Promise<UploadedMedia> {
  const requestResponse = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });
  const requestPayload = await requestResponse.json().catch(() => ({})) as {
    uploadURL?: string;
    objectPath?: string;
    error?: string;
  };
  if (!requestResponse.ok || !requestPayload.uploadURL || !requestPayload.objectPath) {
    throw new Error(requestPayload.error || "Impossible de préparer l’import.");
  }

  const uploadResponse = await fetch(requestPayload.uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error("Le fichier n’a pas pu être envoyé vers le stockage cloud.");
  }

  const response = await fetch("/api/storage/uploads/complete", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objectPath: requestPayload.objectPath }),
  });
  const payload = await response.json().catch(() => ({})) as { url?: string; error?: string };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error || "Upload impossible.");
  }
  const uploaded = {
    success: true as const,
    filename: `${folder}-${file.name}`,
    path: payload.url,
  };
  try {
    localStorage.setItem(MEDIA_LIBRARY_KEY, JSON.stringify([...getUploadedMedia().filter(item => item.path !== uploaded.path), uploaded].slice(-100)));
  } catch (error) {
    if (RESTORED_MEDIA_PATH.test(uploaded.path) || CLOUD_MEDIA_PATH.test(uploaded.path)) {
      try {
        await deleteRestoredMediaFile(uploaded.path);
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Media library persistence and cleanup both failed.");
      }
    }
    throw error;
  }
  return uploaded;
}

/** Delete a temporary file created by a failed backup restoration. */
export async function deleteRestoredMedia(path: string): Promise<void> {
  if (!RESTORED_MEDIA_PATH.test(path) && !CLOUD_MEDIA_PATH.test(path)) {
    throw new Error("Only restored media can be deleted.");
  }
  await deleteRestoredMediaFile(path);
  localStorage.setItem(MEDIA_LIBRARY_KEY, JSON.stringify(getUploadedMedia().filter(item => item.path !== path)));
}