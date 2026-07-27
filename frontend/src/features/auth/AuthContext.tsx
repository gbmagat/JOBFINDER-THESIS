import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { StorageLike } from "./auth-intent";

export const AUTH_USER_STORAGE_KEY = "jobfinder.auth-user.v1";

export type AuthRole = "job-seeker" | "employer";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: AuthRole;
}

export interface SignInInput {
  email: string;
  password?: string;
  displayName?: string;
  role?: AuthRole;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  signIn(input: SignInInput): Promise<AuthUser>;
  signOut(): void;
}

interface AuthProviderProps {
  children: ReactNode;
  storage?: StorageLike | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function resolveStorage(
  storage: StorageLike | null | undefined,
): StorageLike | null {
  if (storage !== undefined) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseStoredUser(storedValue: string | null): AuthUser | null {
  if (!storedValue) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(storedValue);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const user = parsed as Partial<AuthUser>;

    if (
      typeof user.id !== "string" ||
      typeof user.email !== "string" ||
      typeof user.displayName !== "string" ||
      (user.role !== "job-seeker" && user.role !== "employer")
    ) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  } catch {
    return null;
  }
}

function readUser(storage: StorageLike | null): AuthUser | null {
  if (!storage) {
    return null;
  }

  try {
    return parseStoredUser(storage.getItem(AUTH_USER_STORAGE_KEY));
  } catch {
    return null;
  }
}

function toDisplayName(email: string): string {
  const localPart = email.split("@")[0] ?? "Job seeker";
  const words = localPart
    .split(/[._-]+/)
    .map((word) =>
      word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : "",
    )
    .filter(Boolean);

  return words.join(" ") || "Job seeker";
}

function createMockUser(input: SignInInput): AuthUser {
  const email = input.email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  return {
    id: `mock-${email}`,
    email,
    displayName: input.displayName?.trim() || toDisplayName(email),
    role: input.role ?? "job-seeker",
  };
}

export function AuthProvider({ children, storage }: AuthProviderProps) {
  const activeStorage = useMemo(() => resolveStorage(storage), [storage]);
  const [user, setUser] = useState<AuthUser | null>(() =>
    readUser(activeStorage),
  );

  useEffect(() => {
    setUser(readUser(activeStorage));
  }, [activeStorage]);

  useEffect(() => {
    if (
      storage !== undefined ||
      typeof window === "undefined" ||
      activeStorage !== window.localStorage
    ) {
      return;
    }

    const syncUser = (event: StorageEvent) => {
      if (event.key === AUTH_USER_STORAGE_KEY) {
        setUser(parseStoredUser(event.newValue));
      }
    };

    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
  }, [activeStorage, storage]);

  const signIn = useCallback(
    async (input: SignInInput) => {
      const nextUser = createMockUser(input);

      if (activeStorage) {
        try {
          activeStorage.setItem(
            AUTH_USER_STORAGE_KEY,
            JSON.stringify(nextUser),
          );
        } catch {}
      }

      setUser(nextUser);
      return nextUser;
    },
    [activeStorage],
  );

  const signOut = useCallback(() => {
    if (activeStorage) {
      try {
        activeStorage.removeItem(AUTH_USER_STORAGE_KEY);
      } catch {}
    }

    setUser(null);
  }, [activeStorage]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      signIn,
      signOut,
    }),
    [signIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
