import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, WifiOff } from "lucide-react";
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
  const { isAuthenticated, register } = useAuth();
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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    name?: string;
    password?: string;
  }>({});
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    document.title = "Create Account | JobFinder";
  }, []);

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
      await register({
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
          : "We could not create your account.",
      );
    }
  }

  const signInSearch = new URLSearchParams({
    returnTo,
    ...(requestedRole === "employer" ? { role: "employer" } : {}),
  });
  const registerDescription =
    requestedRole === "employer"
      ? "Create an account to post jobs and manage applications."
      : "Create an account to apply, save jobs, and keep your match preferences.";

  return (
    <main className="auth-page auth-page--account auth-page--register">
      <section className="auth-page__panel">
        <Link className="back-link" to="/">
          <ArrowLeft size={18} aria-hidden="true" /> Continue Browsing
        </Link>
        <div className="auth-shell auth-shell--register">
          <header className="auth-header">
            <h1>Create Your Account</h1>
            <p>{registerDescription}</p>
          </header>
          <div className="auth-card">
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
                <h2>Check Your Account Details</h2>
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
              <span>Full Name</span>
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
              <span>Email Address</span>
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
            <div className="field">
              <label htmlFor="register-password">Password</label>
              <div className="password-control">
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
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="password-visibility"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? (
                    <EyeOff size={20} aria-hidden="true" />
                  ) : (
                    <Eye size={20} aria-hidden="true" />
                  )}
                </button>
              </div>
              <small id="register-password-hint">
                At least 8 characters.
              </small>
              {fieldErrors.password ? (
                <span className="field-error" id="register-password-error">
                  {fieldErrors.password}
                </span>
              ) : null}
            </div>
            <button
              className="button button--primary button--block"
              disabled={!isOnline}
              type="submit"
            >
              Create Account and Continue
            </button>
          </form>
          </div>
          <p className="auth-switch">
            Already registered?{" "}
            <Link
              to={`/sign-in?${signInSearch.toString()}`}
              viewTransition
            >
              Sign In
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
