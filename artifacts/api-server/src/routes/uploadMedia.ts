import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { getAuth } from "@clerk/express";

const router = Router();
const uploadRoot = path.resolve(import.meta.dirname, "../public/images");
const allowedFolders = new Set(["shared", "instagram", "wikibase", "twitter", "airways"]);
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".svg"]);

function cleanName(value: string) {
  const extension = path.extname(value).toLowerCase();
  const base = path.basename(value, path.extname(value))
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "media";
  return `${base}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extension}`;
}

const storage = multer.diskStorage({
  destination: (req, _file, callback) => {
    const folder = typeof req.body?.folder === "string" && allowedFolders.has(req.body.folder) ? req.body.folder : "shared";
    const destination = path.join(uploadRoot, folder);
    fs.mkdirSync(destination, { recursive: true });
    callback(null, destination);
  },
  filename: (_req, file, callback) => callback(null, cleanName(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, allowedMimeTypes.has(file.mimetype) && allowedExtensions.has(extension));
  },
});

router.post("/upload-media", (req, res) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  upload.single("file")(req, res, error => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ success: false, error: "File exceeds the 12 MB limit." });
      return;
    }
    if (error || !req.file) {
      res.status(400).json({ success: false, error: "Only JPG, PNG, WEBP, and SVG images are accepted." });
      return;
    }
    const folder = typeof req.body?.folder === "string" && allowedFolders.has(req.body.folder) ? req.body.folder : "shared";
    const filename = req.file.filename;
    res.json({ success: true, filename, path: `/api/images/${folder}/${filename}` });
  });
});

router.delete("/images/:folder/:filename", (req, res) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  const { folder, filename } = req.params;
  if (!allowedFolders.has(folder) || !/^restored-[a-zA-Z0-9._-]{1,120}\.(?:svg|png|jpe?g|webp)$/i.test(filename)) {
    res.status(400).json({ success: false, error: "Only restored media can be deleted." });
    return;
  }
  const directory = path.resolve(uploadRoot, folder);
  const target = path.resolve(directory, filename);
  if (!target.startsWith(`${directory}${path.sep}`)) {
    res.status(400).json({ success: false, error: "Invalid media path." });
    return;
  }
  fs.rm(target, { force: true }, error => {
    if (error) {
      req.log.error({ err: error, target }, "Could not delete restored media");
      res.status(500).json({ success: false, error: "Restored media could not be deleted." });
      return;
    }
    res.status(204).end();
  });
});

export default router;