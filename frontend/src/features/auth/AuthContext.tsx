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
import { apiRequest } from "../../lib/api";

export const AUTH_USER_STORAGE_KEY = "jobfinder.auth-user.v1";

export type AuthRole = "job-seeker" | "employer" | "peso-lgu";

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
  isReady: boolean;
  signIn(input: SignInInput): Promise<AuthUser>;
  register(input: Required<SignInInput>): Promise<AuthUser>;
  signOut(): Promise<void>;
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
      user.role !== "job-seeker" &&
      user.role !== "employer" &&
      user.role !== "peso-lgu"
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
  const usesMockAuth = storage !== undefined || import.meta.env.MODE === "test";
  const [user, setUser] = useState<AuthUser | null>(() =>
    readUser(activeStorage),
  );
  const [isReady, setIsReady] = useState(usesMockAuth);

  useEffect(() => {
    setUser(readUser(activeStorage));
  }, [activeStorage]);

  useEffect(() => {
    if (usesMockAuth) {
      setIsReady(true);
      return;
    }

    let active = true;
    apiRequest<{ user: AuthUser | null }>("/auth/me")
      .then(({ user: currentUser }) => {
        if (!active) return;
        setUser(currentUser);
        if (activeStorage) {
          if (currentUser) {
            activeStorage.setItem(
              AUTH_USER_STORAGE_KEY,
              JSON.stringify(currentUser),
            );
          } else {
            activeStorage.removeItem(AUTH_USER_STORAGE_KEY);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [activeStorage, usesMockAuth]);

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
      const nextUser = usesMockAuth
        ? createMockUser(input)
        : (
            await apiRequest<{ user: AuthUser }>("/auth/login", {
              method: "POST",
              body: JSON.stringify({
                email: input.email,
                password: input.password,
              }),
            })
          ).user;

      if (input.role && nextUser.role !== input.role) {
        if (!usesMockAuth) {
          try {
            await apiRequest<null>("/auth/logout", { method: "POST" });
          } catch {
            throw new Error(
              "We could not safely close the account session. Please try again.",
            );
          }
        }
        const accountLabel =
          nextUser.role === "employer"
            ? "Employer"
            : nextUser.role === "peso-lgu"
              ? "PESO / LGU Reviewer"
              : "Job Seeker";
        throw new Error(`This email belongs to a ${accountLabel} account.`);
      }

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
    [activeStorage, usesMockAuth],
  );

  const register = useCallback(
    async (input: Required<SignInInput>) => {
      const nextUser = usesMockAuth
        ? createMockUser(input)
        : (
            await apiRequest<{ user: AuthUser }>("/auth/register", {
              method: "POST",
              body: JSON.stringify(input),
            })
          ).user;

      if (activeStorage) {
        activeStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(nextUser));
      }
      setUser(nextUser);
      return nextUser;
    },
    [activeStorage, usesMockAuth],
  );

  const signOut = useCallback(async () => {
    if (!usesMockAuth) {
      await apiRequest<null>("/auth/logout", { method: "POST" });
    }
    if (activeStorage) {
      try {
        activeStorage.removeItem(AUTH_USER_STORAGE_KEY);
      } catch {}
    }

    setUser(null);
  }, [activeStorage, usesMockAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isReady,
      signIn,
      register,
      signOut,
    }),
    [isReady, register, signIn, signOut, user],
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
