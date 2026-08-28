import { getAuth } from "@clerk/express";
import { PutOwnerStateBody } from "@workspace/api-zod";
import { Router, type IRouter, type Request, type Response } from "express";
import { getOwnerState, writeOwnerState } from "../lib/ownerStateRepository";

const router: IRouter = Router();

function userId(req: Request): string | null {
  return getAuth(req).userId ?? null;
}

router.get("/state", async (req: Request, res: Response): Promise<void> => {
  const ownerId = userId(req);
  if (!ownerId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const state = await getOwnerState(ownerId);
  // `initialized: false` is intentionally different from an initialized `{}`.
  res.json(state
    ? { initialized: true, revision: state.revision, snapshot: state.snapshot, updatedAt: state.updatedAt }
    : { initialized: false });
});

router.put("/state", async (req: Request, res: Response): Promise<void> => {
  const ownerId = userId(req);
  if (!ownerId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = PutOwnerStateBody.safeParse(req.body);
  if (!parsed.success || !Number.isInteger(parsed.data.expectedRevision) || Object.keys(req.body ?? {}).some(key => key !== "expectedRevision" && key !== "snapshot")) {
    req.log.warn("Invalid state update");
    res.status(400).json({ error: "Invalid state update payload" });
    return;
  }
  const result = await writeOwnerState(ownerId, parsed.data.snapshot, parsed.data.expectedRevision);
  if (result.kind === "conflict") {
    res.status(409).json({ error: "State revision conflict", actualRevision: result.actualRevision });
    return;
  }
  res.json({
    initialized: true,
    revision: result.state.revision,
    snapshot: result.state.snapshot,
    updatedAt: result.state.updatedAt,
  });
});

export default router;