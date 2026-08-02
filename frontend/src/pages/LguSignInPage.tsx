import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { sanitizeLguReturnTo } from "../features/auth/auth-intent";

export function LguSignInPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user?.role === "peso-lgu") {
    return <Navigate replace to="/lgu" />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await signIn({ email, password, role: "peso-lgu" });
      navigate(sanitizeLguReturnTo(searchParams.get("returnTo")), {
        replace: true,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "We could not sign in to the LGU workspace.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="lgu-auth-shell">
      <header className="lgu-auth-header">
        <Link to="/" className="lgu-auth-brand">
          <span>JobFinder</span>
          <small>PESO / LGU Reviewer Portal</small>
        </Link>
        <span className="lgu-auth-header__access">Authorized LGU Access</span>
      </header>

      <main className="lgu-auth-main">
        <section className="lgu-auth-intro" aria-labelledby="lgu-sign-in-title">
          <span className="lgu-kicker">Authorized Government Access</span>
          <h1 id="lgu-sign-in-title">LGU Reviewer Sign In</h1>
          <p>
            Review employer records and job posts submitted for local
            verification.
          </p>
        </section>

        <form className="lgu-auth-card" onSubmit={handleSubmit}>
          <div className="lgu-auth-card__heading">
            <span className="lgu-auth-card__icon" aria-hidden="true">
              <LockKeyhole />
            </span>
            <div>
              <h2>Reviewer Account</h2>
              <p>Use the account assigned by your JobFinder administrator.</p>
            </div>
          </div>

          {error ? (
            <div className="lgu-form-error" role="alert">
              {error}
            </div>
          ) : null}

          <label className="lgu-field">
            <span>Official Email Address</span>
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="reviewer@lgu.gov.ph"
              required
              type="email"
              value={email}
            />
          </label>

          <label className="lgu-field">
            <span>Password</span>
            <span className="lgu-password-field">
              <input
                autoComplete="current-password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </span>
          </label>

          <button
            className="button button--primary button--block"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing In…" : "Sign In to LGU Workspace"}
          </button>

          <div className="lgu-account-notice">
            <ShieldCheck aria-hidden="true" />
            <p>
              <strong>Assigned Reviewer Account</strong>
              Public registration is not available for LGU access.
            </p>
          </div>
        </form>

        <p className="lgu-auth-help">
          Need access? Contact your JobFinder administrator.
        </p>
      </main>

      <footer className="lgu-auth-footer">
        <p>
          Access is monitored. Reviewer decisions are recorded in the Audit Log.
        </p>
        <span>© {new Date().getFullYear()} JobFinder</span>
      </footer>
    </div>
  );
}
