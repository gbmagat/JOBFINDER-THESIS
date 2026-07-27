import { FormEvent, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  LockKeyhole,
  LogIn,
  ShieldCheck,
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
import { getJobById } from "../features/jobs/data";
import { LUMINA_DEMO_EMPLOYER_EMAIL } from "../features/employer/demo-workspace";
import { useOnlineStatus } from "../lib/useOnlineStatus";

export function SignInPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, signIn } = useAuth();
  const requestedRole: AuthRole =
    searchParams.get("role") === "employer" ? "employer" : "job-seeker";
  const rawReturnTo = searchParams.get("returnTo");
  const sessionExpired = searchParams.get("reason") === "session-expired";
  const returnTo =
    requestedRole === "employer"
      ? sanitizeEmployerReturnTo(rawReturnTo)
      : sanitizeReturnTo(rawReturnTo);
  const pendingIntent = useMemo(() => readApplyIntent(), []);
  const selectedJob = pendingIntent ? getJobById(pendingIntent.jobId) : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const isOnline = useOnlineStatus();

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
          {selectedJob ? "Back to job" : "Back to JobFinder"}
        </Link>

        <div className="auth-card">
          <span className="eyebrow">
            <LockKeyhole size={16} aria-hidden="true" />
            {selectedJob
              ? "Public browsing stays open"
              : requestedRole === "employer"
                ? "Employer access"
                : "Secure account access"}
          </span>
          <h1>{selectedJob ? "Sign in to apply" : "Welcome back"}</h1>
          <p>
            {selectedJob
              ? "You can browse every public job without an account. Sign in only to continue this application."
              : requestedRole === "employer"
                ? "Sign in to manage direct job posts and candidates."
                : "Sign in to open your saved jobs, applications, and profile."}
          </p>

          {selectedJob ? (
            <div className="selected-job-card">
              <span>Applying for</span>
              <strong>{selectedJob.title}</strong>
              <small>
                {selectedJob.employerName} · Return to this application
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

          {requestedRole === "employer" ? (
            <div className="notice" role="note">
              <BriefcaseBusiness size={18} aria-hidden="true" />
              <p>
                Want to explore the filled Lumina workspace?{" "}
                <button
                  className="text-link"
                  onClick={() => {
                    setEmail(LUMINA_DEMO_EMPLOYER_EMAIL);
                    setPassword("jobfinder-demo");
                    setFieldErrors({});
                    setError("");
                  }}
                  type="button"
                >
                  Fill demo sign-in
                </button>
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
                <h2>Check your sign-in details</h2>
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
              <span>Email address</span>
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
            <label className="field">
              <span>Password</span>
              <input
                aria-describedby={
                  fieldErrors.password ? "sign-in-password-error" : undefined
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
                placeholder="Enter any password for this demo"
                required
                type="password"
                value={password}
              />
              {fieldErrors.password ? (
                <span className="field-error" id="sign-in-password-error">
                  {fieldErrors.password}
                </span>
              ) : null}
            </label>
            <button
              className="button button--primary button--block"
              disabled={submitting || !isOnline}
              type="submit"
            >
              <LogIn size={18} aria-hidden="true" />
              {submitting
                ? "Signing in…"
                : selectedJob
                  ? "Sign in and continue"
                  : "Sign in"}
            </button>
          </form>

          <div className="auth-card__divider">
            <span>New to JobFinder?</span>
          </div>
          <Link
            className="button button--secondary button--block"
            to={`/register?${registerSearch.toString()}`}
          >
            Create an account{selectedJob ? " and continue" : ""}
          </Link>

          <p className="auth-card__fine-print">
            <ShieldCheck size={16} aria-hidden="true" />
            Frontend demo: use any valid email and password. The production API
            will validate credentials and protect all mutations.
          </p>
        </div>
      </section>

      <aside className="auth-page__aside">
        <div className="brand-mark brand-mark--inverse">
          <span className="brand-mark__dot" />
          <span>JobFinder</span>
        </div>
        <div>
          <p className="eyebrow eyebrow--inverse">Explore first</p>
          <h2>See the evidence before making an account.</h2>
          <ul className="auth-benefits">
            <li>
              <CheckCircle2 size={20} aria-hidden="true" />
              Public job details and source provenance
            </li>
            <li>
              <CheckCircle2 size={20} aria-hidden="true" />
              Skill and location match explanations
            </li>
            <li>
              <CheckCircle2 size={20} aria-hidden="true" />
              Routes with readable text alternatives
            </li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
