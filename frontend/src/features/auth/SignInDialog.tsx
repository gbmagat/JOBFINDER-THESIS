import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import {
  clearApplyIntent,
  createApplyIntent,
  getApplyResumePath,
  getJobDetailPath,
  saveApplyIntent,
  sanitizeReturnTo,
} from "./auth-intent";

interface SignInDialogProps {
  open: boolean;
  jobId: string;
  jobTitle: string;
  onClose(): void;
  returnTo?: string;
  onAuthenticated?(): void;
}

export function SignInDialog({
  open,
  jobId,
  jobTitle,
  onClose,
  returnTo,
  onAuthenticated,
}: SignInDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentReturnTo = useMemo(
    () =>
      sanitizeReturnTo(
        returnTo ??
          `${location.pathname}${location.search}${location.hash}`,
        getJobDetailPath(jobId),
      ),
    [jobId, location.hash, location.pathname, location.search, returnTo],
  );

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open) {
      saveApplyIntent(createApplyIntent(jobId, currentReturnTo));
      setError(null);

      if (!dialog.open) {
        if (typeof dialog.showModal === "function") {
          dialog.showModal();
        } else {
          dialog.setAttribute("open", "");
        }
      }

      window.setTimeout(() => emailRef.current?.focus(), 0);
    } else if (dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [currentReturnTo, jobId, open]);

  const closeAndDiscardIntent = () => {
    clearApplyIntent();
    setPassword("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const intent = createApplyIntent(jobId, currentReturnTo);
      await signIn({ email, password, role: "job-seeker" });
      clearApplyIntent();
      setPassword("");
      onAuthenticated?.();
      onClose();
      navigate(getApplyResumePath(intent));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "We could not sign you in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAccount = () => {
    const registerReturnTo = getApplyResumePath({ jobId });
    onClose();
    navigate(
      `/register?${new URLSearchParams({ returnTo: registerReturnTo }).toString()}`,
    );
  };

  return (
    <dialog
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="auth-gate"
        onCancel={(event) => {
          event.preventDefault();
          closeAndDiscardIntent();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeAndDiscardIntent();
          }
        }}
        ref={dialogRef}
      >
        <div className="auth-gate__body">
          <header className="auth-gate__header">
            <div>
              <p className="auth-gate__eyebrow">Sign In to Apply</p>
              <h2 className="auth-gate__title" id={titleId}>
                Keep Your Application Connected
              </h2>
            </div>
            <button
              aria-label="Close sign-in"
              className="auth-gate__close"
              onClick={closeAndDiscardIntent}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <p className="auth-gate__description" id={descriptionId}>
            You can browse JobFinder without an account. Sign in only when
            you’re ready to apply, and we’ll continue with this job.
          </p>

          <div className="auth-gate__job">
            <span className="auth-gate__job-label">Applying For</span>
            <strong>{jobTitle}</strong>
          </div>

          <form className="auth-gate__form" onSubmit={handleSubmit}>
            <label className="auth-gate__field">
              Email address
              <input
                autoComplete="email"
                className="auth-gate__input"
                onChange={(event) => setEmail(event.target.value)}
                ref={emailRef}
                required
                type="email"
                value={email}
              />
            </label>

            <label className="auth-gate__field">
              Password
              <input
                autoComplete="current-password"
                className="auth-gate__input"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>

            {error ? (
              <p className="auth-gate__error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="auth-gate__actions">
              <button
                className="auth-gate__button auth-gate__button--primary"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Signing in…" : "Sign In and Continue"}
              </button>
              <button
                className="auth-gate__button auth-gate__button--secondary"
                onClick={handleCreateAccount}
                type="button"
              >
                Create an Account
              </button>
              <button
                className="auth-gate__button auth-gate__button--quiet"
                onClick={closeAndDiscardIntent}
                type="button"
              >
                Continue Browsing
              </button>
            </div>
          </form>

          <p className="auth-gate__privacy">
            Passwords are verified by the server and are not stored in your
            browser.
          </p>
        </div>
    </dialog>
  );
}

export default SignInDialog;
