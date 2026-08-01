import { Router } from "express";
import {
  clearSessionCookie,
  createSession,
  createUser,
  deleteCurrentSession,
  publicUser,
  setSessionCookie,
  verifyPassword,
} from "../auth.js";
import { requiredText, sendError, validEmail } from "../http.js";

export function createAuthRouter(db) {
  const router = Router();

  router.post("/register", (request, response) => {
    const email = requiredText(request.body?.email, 254).toLowerCase();
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    const displayName = requiredText(request.body?.displayName, 100);
    const role = request.body?.role;
    const fields = {};

    if (!validEmail(email)) fields.email = "Enter a valid email address.";
    if (password.length < 8) fields.password = "Use at least 8 characters.";
    if (!displayName) fields.displayName = "Enter your name or company name.";
    if (role !== "job-seeker" && role !== "employer") {
      fields.role = "Choose Job Seeker or Employer.";
    }
    if (Object.keys(fields).length) {
      sendError(response, 400, "VALIDATION_ERROR", "Check the highlighted fields.", fields);
      return;
    }

    try {
      const user = createUser(db, { email, password, displayName, role });
      const session = createSession(db, user.id);
      setSessionCookie(response, session.token, session.expiresAt);
      response.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (String(error?.code).startsWith("SQLITE_CONSTRAINT")) {
        sendError(response, 409, "EMAIL_EXISTS", "An account already uses this email address.");
        return;
      }
      throw error;
    }
  });

  router.post("/login", (request, response) => {
    const email = requiredText(request.body?.email, 254).toLowerCase();
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      sendError(response, 401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
      return;
    }

    const session = createSession(db, user.id);
    setSessionCookie(response, session.token, session.expiresAt);
    response.json({ user: publicUser(user) });
  });

  router.post("/logout", (request, response) => {
    deleteCurrentSession(db, request);
    clearSessionCookie(response);
    response.status(204).end();
  });

  router.get("/me", (request, response) => {
    response.json({ user: request.user ? publicUser(request.user) : null });
  });

  return router;
}
