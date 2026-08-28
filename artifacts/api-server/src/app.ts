import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "node:path";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// All product surfaces are served through the shared same-origin proxy.
// Do not expose local AI simulation endpoints to arbitrary browser origins.
app.use(cors({ origin: false }));
// The Clerk proxy streams its own request bytes and must precede body parsing.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(
  clerkMiddleware(req => ({
    publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY),
  })),
);
// Snapshots are application documents, not media. Files retain multer's 12 MB limit.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));
app.use("/api/images", express.static(path.resolve(import.meta.dirname, "../public/images")));

app.use("/api", router);

export default app;
