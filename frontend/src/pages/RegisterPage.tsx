import { FormEvent, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  UserPlus,
  WifiOff,
} from "lucide-react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, type AuthRole } from "../features/auth/AuthContext";
import {
  clearApplyIntent,
  getApplyResumePath,
  readApplyIntent,
  sanitizeEmployerReturnTo,
  sanitizeReturnTo,
} from "../features/auth/auth-intent";
import { useOnlineStatus } from "../lib/useOnlineStatus";

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, signIn } = useAuth();
  const requestedRole: AuthRole =
    searchParams.get("role") === "employer" ? "employer" : "job-seeker";
  const rawReturnTo = searchParams.get("returnTo");
  const returnTo =
    requestedRole === "employer"
      ? sanitizeEmployerReturnTo(rawReturnTo)
      : sanitizeReturnTo(rawReturnTo);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    name?: string;
    password?: string;
  }>({});
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const isOnline = useOnlineStatus();

  if (isAuthenticated) {
    return <Navigate replace to={returnTo} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline) {
      setError(
        "You are offline. Account creation requires a confirmed connection and has not been queued.",
      );
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    const nextFieldErrors = {
      ...(name.trim().length < 2
        ? { name: "Enter your full name." }
        : {}),
      ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? { email: "Enter a valid email address." }
        : {}),
      ...(password.length < 8
        ? { password: "Use at least 8 characters for your password." }
        : {}),
    };
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    setError("");
    try {
      await signIn({
        email,
        password,
        displayName: name,
        role: requestedRole,
      });
      const intent = readApplyIntent();
      if (requestedRole === "employer") {
        clearApplyIntent();
        navigate(returnTo, { replace: true });
        return;
      }

      const nextPath = intent ? getApplyResumePath(intent) : returnTo;
      navigate(
        `/onboarding/profile?${new URLSearchParams({
          returnTo: nextPath,
        }).toString()}`,
        { replace: true },
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not create your demo account.",
      );
    }
  }

  const signInSearch = new URLSearchParams({
    returnTo,
    ...(requestedRole === "employer" ? { role: "employer" } : {}),
  });

  return (
    <main className="auth-page auth-page--register">
      <section className="auth-page__panel">
        <Link className="back-link" to="/">
          <ArrowLeft size={18} aria-hidden="true" /> Continue browsing
        </Link>
        <div className="auth-card">
          <span className="eyebrow">
            <UserPlus size={16} aria-hidden="true" /> Free account
          </span>
          <h1>Create your JobFinder account</h1>
          <p>
            Browse without an account. Register only to apply, save jobs, or
            keep your match preferences.
          </p>
          {!isOnline ? (
            <div className="notice notice--warning" role="status">
              <WifiOff size={18} aria-hidden="true" />
              <p>
                Public browsing remains available offline. Reconnect to create
                an account.
              </p>
            </div>
          ) : null}
          <form className="auth-form" noValidate onSubmit={handleSubmit}>
            {Object.keys(fieldErrors).length || error ? (
              <div
                className="form-error-summary"
                ref={errorSummaryRef}
                role="alert"
                tabIndex={-1}
              >
                <h2>Check your account details</h2>
                <ul>
                  {fieldErrors.name ? (
                    <li>
                      <a href="#register-name">{fieldErrors.name}</a>
                    </li>
                  ) : null}
                  {fieldErrors.email ? (
                    <li>
                      <a href="#register-email">{fieldErrors.email}</a>
                    </li>
                  ) : null}
                  {fieldErrors.password ? (
                    <li>
                      <a href="#register-password">
                        {fieldErrors.password}
                      </a>
                    </li>
                  ) : null}
                  {error ? <li>{error}</li> : null}
                </ul>
              </div>
            ) : null}
            <label className="field">
              <span>Full name</span>
              <input
                aria-describedby={
                  fieldErrors.name ? "register-name-error" : undefined
                }
                aria-invalid={Boolean(fieldErrors.name)}
                autoComplete="name"
                className="input"
                id="register-name"
                onChange={(event) => {
                  setName(event.target.value);
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.name;
                    return next;
                  });
                }}
                required
                value={name}
              />
              {fieldErrors.name ? (
                <span className="field-error" id="register-name-error">
                  {fieldErrors.name}
                </span>
              ) : null}
            </label>
            <label className="field">
              <span>Email address</span>
              <input
                aria-describedby={
                  fieldErrors.email ? "register-email-error" : undefined
                }
                aria-invalid={Boolean(fieldErrors.email)}
                autoComplete="email"
                className="input"
                id="register-email"
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.email;
                    return next;
                  });
                }}
                required
                type="email"
                value={email}
              />
              {fieldErrors.email ? (
                <span className="field-error" id="register-email-error">
                  {fieldErrors.email}
                </span>
              ) : null}
            </label>
            <label className="field">
              <span>Password</span>
              <input
                aria-describedby={
                  fieldErrors.password
                    ? "register-password-error register-password-hint"
                    : "register-password-hint"
                }
                aria-invalid={Boolean(fieldErrors.password)}
                autoComplete="new-password"
                className="input"
                id="register-password"
                minLength={8}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.password;
                    return next;
                  });
                }}
                required
                type="password"
                value={password}
              />
              <small id="register-password-hint">
                At least 8 characters in this prototype.
              </small>
              {fieldErrors.password ? (
                <span className="field-error" id="register-password-error">
                  {fieldErrors.password}
                </span>
              ) : null}
            </label>
            <button
              className="button button--primary button--block"
              disabled={!isOnline}
              type="submit"
            >
              <UserPlus size={18} aria-hidden="true" /> Create account and
              continue
            </button>
          </form>
          <p className="auth-switch">
            Already have an account?{" "}
            <Link to={`/sign-in?${signInSearch.toString()}`}>Sign in</Link>
          </p>
        </div>
      </section>
      <aside className="auth-page__aside">
        <div className="brand-mark brand-mark--inverse">
          <span className="brand-mark__dot" />
          <span>JobFinder</span>
        </div>
        <div>
          <p className="eyebrow eyebrow--inverse">Your choice, your data</p>
          <h2>Keep your search public until you need an account feature.</h2>
          <ul className="auth-benefits">
            <li>
              <CheckCircle2 size={20} aria-hidden="true" />
              Apply through the listing&apos;s original method
            </li>
            <li>
              <CheckCircle2 size={20} aria-hidden="true" />
              Save jobs and track application progress
            </li>
            <li>
              <CheckCircle2 size={20} aria-hidden="true" />
              Reuse skill and commute preferences
            </li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
