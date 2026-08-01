import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
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
import { useJobs } from "../features/jobs/JobsContext";
import { useOnlineStatus } from "../lib/useOnlineStatus";

export function SignInPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, signIn } = useAuth();
  const { getJob } = useJobs();
  const requestedRole: AuthRole =
    searchParams.get("role") === "employer" ? "employer" : "job-seeker";
  const rawReturnTo = searchParams.get("returnTo");
  const sessionExpired = searchParams.get("reason") === "session-expired";
  const returnTo =
    requestedRole === "employer"
      ? sanitizeEmployerReturnTo(rawReturnTo)
      : sanitizeReturnTo(rawReturnTo);
  const pendingIntent = useMemo(() => readApplyIntent(), []);
  const selectedJob = pendingIntent ? getJob(pendingIntent.jobId) : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    document.title = `${
      selectedJob ? "Sign In to Apply" : "Sign In"
    } | JobFinder`;
  }, [selectedJob]);

  if (isAuthenticated) {
    return <Navigate replace to={returnTo} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline) {
      setError(
        "You are offline. Sign-in requires a confirmed connection and has not been queued.",
      );
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    const nextFieldErrors = {
      ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? { email: "Enter a valid email address." }
        : {}),
      ...(!password
        ? { password: "Enter your password." }
        : {}),
    };
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await signIn({ email, password, role: requestedRole });
      const intent = readApplyIntent();
      if (intent) {
        clearApplyIntent();
        navigate(getApplyResumePath(intent), { replace: true });
      } else {
        navigate(returnTo, { replace: true });
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not sign you in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const registerSearch = new URLSearchParams({
    returnTo,
    ...(requestedRole === "employer" ? { role: "employer" } : {}),
  });

  return (
    <main className="auth-page">
      <section className="auth-page__panel">
        <Link className="back-link" to={selectedJob ? `/jobs/${selectedJob.id}` : "/"}>
          <ArrowLeft size={18} aria-hidden="true" />
          {selectedJob ? "Back to Job" : "Back to JobFinder"}
        </Link>

        <div className="auth-shell auth-shell--sign-in">
          <header className="auth-header">
            <h1>{selectedJob ? "Sign In to Apply" : "Welcome Back"}</h1>
            <p>
              {selectedJob
                ? "Enter your account details. We will return you to this job after sign in."
                : requestedRole === "employer"
                  ? "Sign in to manage direct job posts and candidates."
                  : "Sign in to open your saved jobs, applications, and profile."}
            </p>
          </header>
          <nav className="auth-mode-switch" aria-label="Account access">
            <span
              aria-current="page"
              className="auth-mode-switch__option is-active"
            >
              Sign In
            </span>
            <span className="auth-mode-switch__divider" aria-hidden="true" />
            <Link
              className="auth-mode-switch__option"
              to={`/register?${registerSearch.toString()}`}
              viewTransition
            >
              Register
            </Link>
          </nav>

          <div className="auth-card">
          {selectedJob ? (
            <div className="selected-job-card">
              <strong>Applying for {selectedJob.title}</strong>
              <small>
                {selectedJob.employerName} · Your application return is saved
              </small>
            </div>
          ) : null}

          {sessionExpired ? (
            <div className="notice notice--warning" role="status">
              <LockKeyhole size={18} aria-hidden="true" />
              <p>
                Your session expired. Sign in again to safely return to the
                page you were using.
              </p>
            </div>
          ) : null}

          {!isOnline ? (
            <div className="notice notice--warning" role="status">
              <WifiOff size={18} aria-hidden="true" />
              <p>
                Public browsing remains available offline. Reconnect to sign
                in or continue an application.
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
                <h2>Check Your Sign-In Details</h2>
                <ul>
                  {fieldErrors.email ? (
                    <li>
                      <a href="#sign-in-email">{fieldErrors.email}</a>
                    </li>
                  ) : null}
                  {fieldErrors.password ? (
                    <li>
                      <a href="#sign-in-password">{fieldErrors.password}</a>
                    </li>
                  ) : null}
                  {error ? <li>{error}</li> : null}
                </ul>
              </div>
            ) : null}
            <label className="field">
              <span>Email Address</span>
              <input
                aria-describedby={
                  fieldErrors.email ? "sign-in-email-error" : undefined
                }
                aria-invalid={Boolean(fieldErrors.email)}
                autoComplete="email"
                className="input"
                id="sign-in-email"
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.email;
                    return next;
                  });
                }}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
              {fieldErrors.email ? (
                <span className="field-error" id="sign-in-email-error">
                  {fieldErrors.email}
                </span>
              ) : null}
            </label>
            <div className="field">
              <label htmlFor="sign-in-password">Password</label>
              <div className="password-control">
                <input
                  aria-describedby={
                    fieldErrors.password
                      ? "sign-in-password-error"
                      : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.password)}
                  autoComplete="current-password"
                  className="input"
                  id="sign-in-password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFieldErrors((current) => {
                      const next = { ...current };
                      delete next.password;
                      return next;
                    });
                  }}
                  placeholder="Enter your password"
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
              {fieldErrors.password ? (
                <span className="field-error" id="sign-in-password-error">
                  {fieldErrors.password}
                </span>
              ) : null}
            </div>
            <button
              className="button button--primary button--block"
              disabled={submitting || !isOnline}
              type="submit"
            >
              {submitting
                ? "Signing in…"
                : selectedJob
                  ? "Sign In and Continue"
                  : "Sign In"}
            </button>
          </form>
          </div>

          <p className="auth-switch">
            New to JobFinder?{" "}
            <Link
              to={`/register?${registerSearch.toString()}`}
              viewTransition
            >
              Register{selectedJob ? " and Continue" : ""}
            </Link>
          </p>

          <p className="auth-card__fine-print">
            Use the email and password registered with your account.
          </p>
        </div>
      </section>
    </main>
  );
}
