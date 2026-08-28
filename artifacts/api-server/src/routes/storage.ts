import { getAuth } from "@clerk/express";
import { and, eq, isNotNull } from "drizzle-orm";
import { CompleteUploadBody, RequestUploadUrlBody } from "@workspace/api-zod";
import { db, ownerMedia } from "@workspace/db";
import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "node:stream";
import { setObjectAclPolicy } from "../lib/objectAcl";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objects = new ObjectStorageService();
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

function authenticatedOwner(req: Request): string | null {
  return getAuth(req).userId ?? null;
}

router.post("/storage/uploads/request-url", async (req: Request, res: Response): Promise<void> => {
  const ownerId = authenticatedOwner(req);
  if (!ownerId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success || !Number.isInteger(parsed.data.size) || !imageTypes.has(parsed.data.contentType) || Object.keys(req.body ?? {}).some(key => !["name", "size", "contentType"].includes(key))) {
    req.log.warn("Invalid upload URL request");
    res.status(400).json({ error: "Invalid upload metadata" });
    return;
  }
  try {
    const upload = await objects.createUpload();
    await db.insert(ownerMedia).values({ ownerId, objectPath: upload.objectPath, ...parsed.data });
    res.json({ ...upload, metadata: parsed.data });
  } catch (error) {
    req.log.error({ err: error }, "Could not generate upload URL");
    res.status(500).json({ error: "Could not generate upload URL" });
  }
});

router.post("/storage/uploads/complete", async (req: Request, res: Response): Promise<void> => {
  const ownerId = authenticatedOwner(req);
  if (!ownerId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CompleteUploadBody.safeParse(req.body);
  if (!parsed.success || !/^\/objects\/uploads\/[0-9a-f-]{36}$/.test(parsed.data.objectPath) || Object.keys(req.body ?? {}).some(key => key !== "objectPath")) {
    res.status(400).json({ error: "Invalid object path" });
    return;
  }
  const [media] = await db.select().from(ownerMedia).where(and(eq(ownerMedia.objectPath, parsed.data.objectPath), eq(ownerMedia.ownerId, ownerId)));
  if (!media) {
    res.status(404).json({ error: "Upload not found" });
    return;
  }
  try {
    const file = await objects.getObject(media.objectPath);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) !== media.size || metadata.contentType !== media.contentType) {
      req.log.warn({ objectPath: media.objectPath }, "Uploaded object metadata did not match upload intent");
      res.status(422).json({ error: "Uploaded object does not match its declared metadata" });
      return;
    }
    await setObjectAclPolicy(file, { owner: ownerId, visibility: "private" });
    await db.update(ownerMedia).set({ completedAt: new Date() }).where(and(eq(ownerMedia.objectPath, media.objectPath), eq(ownerMedia.ownerId, ownerId)));
    res.json({ objectPath: media.objectPath, url: `/api/storage${media.objectPath}` });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(409).json({ error: "Upload has not completed yet" });
      return;
    }
    req.log.error({ err: error }, "Could not claim upload");
    res.status(500).json({ error: "Could not claim upload" });
  }
});

router.get("/storage/objects/*path", async (req: Request, res: Response): Promise<void> => {
  const ownerId = authenticatedOwner(req);
  if (!ownerId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const raw = req.params.path;
  const objectPath = `/objects/${Array.isArray(raw) ? raw.join("/") : raw}`;
  const [media] = await db.select().from(ownerMedia).where(and(eq(ownerMedia.objectPath, objectPath), eq(ownerMedia.ownerId, ownerId), isNotNull(ownerMedia.completedAt)));
  if (!media) {
    res.status(404).json({ error: "Object not found" });
    return;
  }
  try {
    const response = await objects.download(await objects.getObject(objectPath));
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Could not serve private object");
    res.status(500).json({ error: "Could not serve object" });
  }
});

router.delete("/storage/objects/*path", async (req: Request, res: Response): Promise<void> => {
  const ownerId = authenticatedOwner(req);
  if (!ownerId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const raw = req.params.path;
  const objectPath = `/objects/${Array.isArray(raw) ? raw.join("/") : raw}`;
  const [media] = await db
    .select()
    .from(ownerMedia)
    .where(and(eq(ownerMedia.objectPath, objectPath), eq(ownerMedia.ownerId, ownerId)));
  if (!media) {
    res.status(404).json({ error: "Object not found" });
    return;
  }
  try {
    const file = await objects.getObject(objectPath);
    await file.delete();
    await db.delete(ownerMedia).where(and(eq(ownerMedia.objectPath, objectPath), eq(ownerMedia.ownerId, ownerId)));
    res.status(204).end();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      await db.delete(ownerMedia).where(and(eq(ownerMedia.objectPath, objectPath), eq(ownerMedia.ownerId, ownerId)));
      res.status(204).end();
      return;
    }
    req.log.error({ err: error }, "Could not delete private object");
    res.status(500).json({ error: "Could not delete object" });
  }
});

export default router;