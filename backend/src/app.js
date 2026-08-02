import { existsSync } from "node:fs";
import path from "node:path";
import express from "express";
import { optionalAuth } from "./auth.js";
import { createAccountRouter } from "./routes/account-routes.js";
import { createAuthRouter } from "./routes/auth-routes.js";
import { createEmployerRouter } from "./routes/employer-routes.js";
import { createLguRouter } from "./routes/lgu-routes.js";
import { createPublicRouter } from "./routes/public-routes.js";

export function createApp({
  db,
  uploadsDirectory,
  frontendDirectory,
  trustProxy = false,
} = {}) {
  if (!db) throw new Error("createApp requires a database.");
  if (!uploadsDirectory) throw new Error("createApp requires an uploads directory.");

  const app = express();
  if (trustProxy) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    next();
  });
  app.use(express.json({ limit: "256kb" }));
  app.use(optionalAuth(db));

  app.use("/api/auth", createAuthRouter(db));
  app.use("/api/employer", createEmployerRouter(db));
  app.use("/api/lgu", createLguRouter(db));
  app.use("/api", createAccountRouter(db, uploadsDirectory));
  app.use("/api", createPublicRouter(db));

  app.use("/api", (_request, response) => {
    response.status(404).json({
      error: {
        code: "API_NOT_FOUND",
        message: "API endpoint not found.",
      },
    });
  });

  const indexFile = frontendDirectory
    ? path.join(frontendDirectory, "index.html")
    : null;
  if (frontendDirectory && indexFile && existsSync(indexFile)) {
    app.use(express.static(frontendDirectory));
    app.use((request, response, next) => {
      if (request.method !== "GET") {
        next();
        return;
      }
      response.sendFile(indexFile);
    });
  }

  app.use((error, _request, response, _next) => {
    const code = String(error?.code ?? "");
    const isInvalidJson = error?.type === "entity.parse.failed";
    const isBodyTooLarge = error?.type === "entity.too.large";
    const isFileTooLarge = code === "LIMIT_FILE_SIZE";
    const isUploadValidation =
      code === "INVALID_FILE_TYPE" || code.startsWith("LIMIT_");

    let status = 500;
    let errorCode = "SERVER_ERROR";
    let message = "The server could not complete the request.";

    if (isInvalidJson) {
      status = 400;
      errorCode = "INVALID_JSON";
      message = "The request body must contain valid JSON.";
    } else if (isBodyTooLarge) {
      status = 413;
      errorCode = "REQUEST_TOO_LARGE";
      message = "The request body is too large.";
    } else if (isFileTooLarge) {
      status = 413;
      errorCode = "FILE_TOO_LARGE";
      message = "The resume must be 5 MB or smaller.";
    } else if (isUploadValidation) {
      status = 400;
      errorCode = "INVALID_UPLOAD";
      message = "Attach one PDF resume up to 5 MB.";
    } else {
      console.error("Unhandled JobFinder API error:", error);
    }

    response.status(status).json({
      error: {
        code: errorCode,
        message,
      },
    });
  });

  app.locals.db = db;
  return app;
}
