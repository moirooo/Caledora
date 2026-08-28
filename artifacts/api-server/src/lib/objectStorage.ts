import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { File, Storage } from "@google-cloud/storage";

const SIDECAR = "http://127.0.0.1:1106";
export const objectStorageClient = new Storage({
  credentials: { audience: "replit", subject_token_type: "access_token", token_url: `${SIDECAR}/token`, type: "external_account", credential_source: { url: `${SIDECAR}/credential`, format: { type: "json", subject_token_field_name: "access_token" } }, universe_domain: "googleapis.com" },
  projectId: "",
});
export class ObjectNotFoundError extends Error {}

function privateDir(): string {
  const value = process.env.PRIVATE_OBJECT_DIR;
  if (!value) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  return value.replace(/\/$/, "");
}
function parse(path: string): { bucket: string; name: string } {
  const [bucket, ...rest] = path.replace(/^\//, "").split("/");
  if (!bucket || !rest.length) throw new Error("Invalid object storage path");
  return { bucket, name: rest.join("/") };
}

export class ObjectStorageService {
  async createUpload(): Promise<{ uploadURL: string; objectPath: string }> {
    const objectPath = `/objects/uploads/${randomUUID()}`;
    const target = parse(`${privateDir()}${objectPath.slice("/objects".length)}`);
    const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket_name: target.bucket, object_name: target.name, method: "PUT", expires_at: new Date(Date.now() + 900_000).toISOString() }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Could not sign upload URL (${response.status})`);
    const { signed_url } = await response.json() as { signed_url: string };
    return { uploadURL: signed_url, objectPath };
  }
  async getObject(path: string): Promise<File> {
    if (!/^\/objects\/uploads\/[0-9a-f-]{36}$/.test(path)) throw new ObjectNotFoundError("Object not found");
    const target = parse(`${privateDir()}${path.slice("/objects".length)}`);
    const file = objectStorageClient.bucket(target.bucket).file(target.name);
    if (!(await file.exists())[0]) throw new ObjectNotFoundError("Object not found");
    return file;
  }
  async download(file: File): Promise<Response> {
    const [metadata] = await file.getMetadata();
    return new Response(Readable.toWeb(file.createReadStream()) as ReadableStream, {
      headers: { "Content-Type": String(metadata.contentType || "application/octet-stream"), "Cache-Control": "private, max-age=3600", ...(metadata.size ? { "Content-Length": String(metadata.size) } : {}) },
    });
  }
}