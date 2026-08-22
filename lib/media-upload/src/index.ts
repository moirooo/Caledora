export type MediaUploadFolder = "shared" | "instagram" | "wikibase" | "twitter" | "airways";

export type UploadedMedia = {
  success: true;
  filename: string;
  path: string;
};

const MEDIA_LIBRARY_KEY = "caledora-media-library-v1";

export function getUploadedMedia(): UploadedMedia[] {
  try {
    const value = JSON.parse(localStorage.getItem(MEDIA_LIBRARY_KEY) || "[]");
    return Array.isArray(value) ? value.filter(item => item?.success === true && typeof item.path === "string") : [];
  } catch {
    return [];
  }
}

export async function uploadMedia(file: File, folder: MediaUploadFolder = "shared"): Promise<UploadedMedia> {
  const formData = new FormData();
  formData.append("folder", folder);
  formData.append("file", file);
  const response = await fetch("/api/upload-media", { method: "POST", body: formData });
  const payload = await response.json().catch(() => ({})) as Partial<UploadedMedia> & { error?: string };
  if (!response.ok || payload.success !== true || !payload.filename || !payload.path) {
    throw new Error(payload.error || "Upload impossible.");
  }
  const uploaded = { success: true as const, filename: payload.filename, path: payload.path };
  localStorage.setItem(MEDIA_LIBRARY_KEY, JSON.stringify([...getUploadedMedia().filter(item => item.path !== uploaded.path), uploaded].slice(-100)));
  return uploaded;
}