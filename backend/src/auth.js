import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const SESSION_COOKIE = "jobfinder_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index < 0) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function requestToken(request) {
  const authorization = request.get("authorization") ?? "";
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }
  return parseCookies(request.get("cookie"))[SESSION_COOKIE] ?? null;
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password, storedHash) {
  const [saltHex, expectedHex] = String(storedHash).split(":");
  if (!saltHex || !expectedHex) return false;

  try {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
  };
}

export function createUser(db, input) {
  const now = new Date().toISOString();
  const user = {
    id: randomUUID(),
    email: input.email.trim().toLowerCase(),
    passwordHash: hashPassword(input.password),
    displayName: input.displayName.trim(),
    role: input.role,
    createdAt: now,
  };

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO users
        (id, email, password_hash, display_name, role, created_at)
      VALUES
        (@id, @email, @passwordHash, @displayName, @role, @createdAt)
    `).run(user);

    if (user.role === "job-seeker") {
      db.prepare(`
        INSERT INTO profiles (user_id, full_name, updated_at)
        VALUES (?, ?, ?)
      `).run(user.id, user.displayName, now);
    } else {
      db.prepare(`
        INSERT INTO company_profiles (user_id, company_name, updated_at)
        VALUES (?, ?, ?)
      `).run(user.id, user.displayName, now);
    }
  });

  transaction();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
}

export function createSession(db, userId) {
  const token = randomBytes(32).toString("hex");
  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + SESSION_MAX_AGE_SECONDS * 1000,
  );

  db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    tokenHash(token),
    userId,
    expiresAt.toISOString(),
    createdAt.toISOString(),
  );

  return { token, expiresAt };
}

export function setSessionCookie(response, token, expiresAt) {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response) {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function optionalAuth(db) {
  return (request, _response, next) => {
    const token = requestToken(request);
    if (!token) {
      request.user = null;
      request.sessionTokenHash = null;
      next();
      return;
    }

    const hash = tokenHash(token);
    const session = db.prepare(`
      SELECT users.*, sessions.expires_at
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
    `).get(hash);

    if (!session || Date.parse(session.expires_at) <= Date.now()) {
      db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash);
      request.user = null;
      request.sessionTokenHash = null;
      next();
      return;
    }

    request.user = session;
    request.sessionTokenHash = hash;
    next();
  };
}

export function requireAuth(request, response, next) {
  if (!request.user) {
    response.status(401).json({
      error: {
        code: "AUTH_REQUIRED",
        message: "Sign in to continue.",
      },
    });
    return;
  }
  next();
}

export function requireRole(role) {
  return (request, response, next) => {
    if (!request.user) {
      response.status(401).json({
        error: {
          code: "AUTH_REQUIRED",
          message: "Sign in to continue.",
        },
      });
      return;
    }
    if (request.user.role !== role) {
      response.status(403).json({
        error: {
          code: "ROLE_REQUIRED",
          message: `This action requires a ${role} account.`,
        },
      });
      return;
    }
    next();
  };
}

export function deleteCurrentSession(db, request) {
  if (!request.sessionTokenHash) return;
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
    request.sessionTokenHash,
  );
}
