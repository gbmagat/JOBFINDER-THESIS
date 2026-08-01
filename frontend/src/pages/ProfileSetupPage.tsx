import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  LocateFixed,
  MapPin,
  Navigation,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import {
  readApplyIntent,
  sanitizeReturnTo,
} from "../features/auth/auth-intent";
import {
  COMMUTE_MINUTES_KEY,
  DEFAULT_PROFILE_DETAILS,
  PROFILE_DETAILS_KEY,
} from "../features/profile/storage";
import { usePersistentState } from "../lib/usePersistentState";
import { userStorageKey } from "../lib/storage-keys";
import { apiRequest } from "../lib/api";

type ProfileField =
  | "fullName"
  | "mobileNumber"
  | "barangay"
  | "city"
  | "maximumDistance"
  | "maximumMinutes";

const profileFieldIds: Record<ProfileField, string> = {
  fullName: "profile-full-name",
  mobileNumber: "profile-mobile-number",
  barangay: "profile-barangay",
  city: "profile-city",
  maximumDistance: "profile-maximum-distance",
  maximumMinutes: "profile-maximum-minutes",
};

function homeNodeIdForBarangay(barangay: string) {
  const normalized = barangay.trim().toLowerCase();
  if (normalized.includes("rosario") || normalized.includes("nepo")) {
    return "nepo-center";
  }
  if (normalized.includes("maragul") || normalized.includes("marquee")) {
    return "marquee";
  }
  return "balibago";
}

export function ProfileSetupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const pendingIntent = useMemo(() => readApplyIntent(), []);
  const returnTo = sanitizeReturnTo(
    searchParams.get("returnTo"),
    pendingIntent?.returnTo,
  );
  const skillsSearch = new URLSearchParams({ returnTo });

  const [profile, setProfile] = usePersistentState(
    userStorageKey(PROFILE_DETAILS_KEY, user?.id),
    {
      ...DEFAULT_PROFILE_DETAILS,
      fullName: user?.displayName ?? "",
    },
  );
  const [, setCommuteMinutes] = usePersistentState(
    userStorageKey(COMMUTE_MINUTES_KEY, user?.id),
    DEFAULT_PROFILE_DETAILS.maximumMinutes,
  );
  const [errors, setErrors] = useState<
    Partial<Record<ProfileField, string>>
  >({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const {
    barangay,
    city,
    fullName,
    maximumDistance,
    maximumMinutes,
    mobileNumber,
  } = profile;

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;

    let active = true;
    apiRequest<{
      profile: {
        fullName: string;
        mobileNumber: string;
        barangay: string;
        city: string;
        maximumDistanceKm: number;
        maximumMinutes: number;
      };
    }>("/profile")
      .then(({ profile: savedProfile }) => {
        if (!active) return;
        setProfile({
          fullName: savedProfile.fullName,
          mobileNumber: savedProfile.mobileNumber,
          barangay: savedProfile.barangay,
          city: savedProfile.city,
          maximumDistance: String(savedProfile.maximumDistanceKm),
          maximumMinutes: String(savedProfile.maximumMinutes),
        });
        setCommuteMinutes(String(savedProfile.maximumMinutes));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [setCommuteMinutes, setProfile, user?.id]);

  function updateProfile(
    field: keyof typeof profile,
    value: string,
  ) {
    setProfile((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field as ProfileField];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError("");
    const normalizedMobile = mobileNumber.replace(/[\s()-]/g, "");
    const nextErrors: Partial<Record<ProfileField, string>> = {
      ...(fullName.trim().length < 2
        ? { fullName: "Enter your full name." }
        : {}),
      ...(!/^(?:\+639|09)\d{9}$/.test(normalizedMobile)
        ? {
            mobileNumber:
              "Enter a valid Philippine mobile number, such as 09171234567.",
          }
        : {}),
      ...(!barangay.trim()
        ? { barangay: "Enter your barangay." }
        : {}),
      ...(city.trim().toLowerCase() !== "angeles city"
        ? { city: "JobFinder currently supports Angeles City." }
        : {}),
      ...(Number(maximumDistance) < 1 || Number(maximumDistance) > 100
        ? { maximumDistance: "Choose a distance from 1 to 100 km." }
        : {}),
      ...(Number(maximumMinutes) < 5 || Number(maximumMinutes) > 180
        ? { maximumMinutes: "Choose a travel time from 5 to 180 minutes." }
        : {}),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/profile", {
        method: "PUT",
        body: JSON.stringify({
          fullName,
          mobileNumber: normalizedMobile,
          barangay,
          city,
          maximumDistanceKm: Number(maximumDistance),
          maximumMinutes: Number(maximumMinutes),
          homeNodeId: homeNodeIdForBarangay(barangay),
          preferredWorkTypes: [],
        }),
      });
      setCommuteMinutes(maximumMinutes);
      window.dispatchEvent(new Event("jobfinder:profile-updated"));
      navigate(`/onboarding/skills?${skillsSearch.toString()}`);
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "JobFinder could not save your profile.",
      );
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page page--narrow onboarding-page">
      <div className="onboarding-shell">
        <header className="onboarding-topbar">
          <Link
            aria-label="Leave profile setup"
            className="back-link onboarding-topbar__back"
            to={returnTo}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div className="onboarding-topbar__copy">
            <strong>Profile Setup</strong>
            <span>1 of 2</span>
          </div>
          <div
            aria-label="Profile setup progress: step 1 of 2"
            className="onboarding-progress"
            role="progressbar"
            aria-valuemax={2}
            aria-valuemin={1}
            aria-valuenow={1}
          >
            <span className="is-active" />
            <span />
          </div>
        </header>

        <div className="onboarding-intro">
          <h1>Tell Us About You</h1>
          <p>We&apos;ll use this to personalize local opportunities.</p>
        </div>

        <form className="onboarding-form" noValidate onSubmit={handleSubmit}>
          {Object.keys(errors).length || serverError ? (
            <div
              className="form-error-summary"
              ref={errorSummaryRef}
              role="alert"
              tabIndex={-1}
            >
              <h2>Check Your Profile Details</h2>
              <ul>
                {(Object.entries(errors) as [ProfileField, string][]).map(
                  ([field, message]) => (
                    <li key={field}>
                      <a href={`#${profileFieldIds[field]}`}>{message}</a>
                    </li>
                  ),
                )}
                {serverError ? <li>{serverError}</li> : null}
              </ul>
            </div>
          ) : null}
          <section
            aria-labelledby="basic-information-heading"
            className="content-card onboarding-card onboarding-card--soft"
          >
            <div className="onboarding-card__header">
              <span className="icon-tile icon-tile--soft">
                <UserRound size={21} aria-hidden="true" />
              </span>
              <div>
                <p className="kicker">Step 1</p>
                <h2 id="basic-information-heading">Basic Information</h2>
              </div>
            </div>

            <div className="form-grid form-grid--2 onboarding-fields">
              <label className="field">
                <span className="field-label">Full name</span>
                <input
                  aria-describedby={
                    errors.fullName ? "profile-full-name-error" : undefined
                  }
                  aria-invalid={Boolean(errors.fullName)}
                  autoComplete="name"
                  className="input"
                  id={profileFieldIds.fullName}
                  maxLength={100}
                  onChange={(event) =>
                    updateProfile("fullName", event.target.value)
                  }
                  required
                  value={fullName}
                />
                {errors.fullName ? (
                  <span className="field-error" id="profile-full-name-error">
                    {errors.fullName}
                  </span>
                ) : null}
              </label>
              <label className="field">
                <span className="field-label">Mobile number</span>
                <input
                  aria-describedby={
                    errors.mobileNumber
                      ? "profile-mobile-number-error"
                      : undefined
                  }
                  aria-invalid={Boolean(errors.mobileNumber)}
                  autoComplete="tel"
                  className="input"
                  id={profileFieldIds.mobileNumber}
                  inputMode="tel"
                  maxLength={20}
                  onChange={(event) =>
                    updateProfile("mobileNumber", event.target.value)
                  }
                  placeholder="09•• ••• ••••"
                  required
                  type="tel"
                  value={mobileNumber}
                />
                {errors.mobileNumber ? (
                  <span
                    className="field-error"
                    id="profile-mobile-number-error"
                  >
                    {errors.mobileNumber}
                  </span>
                ) : null}
              </label>
            </div>

            <p className="onboarding-privacy-note">
              <ShieldCheck size={17} aria-hidden="true" />
              Only employers you apply to can see your contact details.
            </p>
          </section>

          <section
            aria-labelledby="home-location-heading"
            className="content-card onboarding-card onboarding-card--brand"
          >
            <div className="onboarding-card__header">
              <span className="icon-tile onboarding-card__brand-icon">
                <MapPin size={21} aria-hidden="true" />
              </span>
              <div>
                <p className="kicker">Commute Starting Point</p>
                <h2 id="home-location-heading">Home Location</h2>
              </div>
            </div>

            <div className="form-grid form-grid--2 onboarding-fields">
              <label className="field">
                <span className="field-label">Barangay</span>
                <input
                  aria-describedby={
                    errors.barangay ? "profile-barangay-error" : undefined
                  }
                  aria-invalid={Boolean(errors.barangay)}
                  autoComplete="address-level3"
                  className="input"
                  id={profileFieldIds.barangay}
                  maxLength={80}
                  onChange={(event) =>
                    updateProfile("barangay", event.target.value)
                  }
                  required
                  value={barangay}
                />
                {errors.barangay ? (
                  <span className="field-error" id="profile-barangay-error">
                    {errors.barangay}
                  </span>
                ) : null}
              </label>
              <label className="field">
                <span className="field-label">City or municipality</span>
                <input
                  aria-describedby={
                    errors.city ? "profile-city-error" : undefined
                  }
                  aria-invalid={Boolean(errors.city)}
                  autoComplete="address-level2"
                  className="input"
                  id={profileFieldIds.city}
                  maxLength={80}
                  onChange={(event) =>
                    updateProfile("city", event.target.value)
                  }
                  required
                  value={city}
                />
                {errors.city ? (
                  <span className="field-error" id="profile-city-error">
                    {errors.city}
                  </span>
                ) : null}
              </label>
            </div>

            <div className="onboarding-location-summary" role="status">
              <LocateFixed size={18} aria-hidden="true" />
              <span>
                <strong>Location ready</strong>
                {barangay || "Your barangay"}, {city || "your city"}
              </span>
            </div>
          </section>

          <section
            aria-labelledby="commute-preference-heading"
            className="content-card onboarding-card"
          >
            <div className="onboarding-card__header">
              <span className="icon-tile icon-tile--soft">
                <Navigation size={21} aria-hidden="true" />
              </span>
              <div>
                <h2 id="commute-preference-heading">Commute Preference</h2>
                <p className="onboarding-card__caption">
                  Set the travel limits used in your recommendations.
                </p>
              </div>
            </div>

            <div className="form-grid form-grid--2 onboarding-fields">
              <label className="field">
                <span className="field-label">Maximum distance</span>
                <span className="onboarding-inline-control">
                  <input
                    aria-describedby={
                      errors.maximumDistance
                        ? "profile-maximum-distance-error"
                        : undefined
                    }
                    aria-invalid={Boolean(errors.maximumDistance)}
                    className="input"
                    id={profileFieldIds.maximumDistance}
                    inputMode="numeric"
                    max={100}
                    min={1}
                    onChange={(event) =>
                      updateProfile("maximumDistance", event.target.value)
                    }
                    required
                    type="number"
                    value={maximumDistance}
                  />
                  <span>km</span>
                </span>
                {errors.maximumDistance ? (
                  <span
                    className="field-error"
                    id="profile-maximum-distance-error"
                  >
                    {errors.maximumDistance}
                  </span>
                ) : null}
              </label>
              <label className="field">
                <span className="field-label">Maximum travel time</span>
                <span className="onboarding-inline-control">
                  <input
                    aria-describedby={
                      errors.maximumMinutes
                        ? "profile-maximum-minutes-error"
                        : undefined
                    }
                    aria-invalid={Boolean(errors.maximumMinutes)}
                    className="input"
                    id={profileFieldIds.maximumMinutes}
                    inputMode="numeric"
                    max={180}
                    min={5}
                    onChange={(event) =>
                      updateProfile("maximumMinutes", event.target.value)
                    }
                    required
                    step={5}
                    type="number"
                    value={maximumMinutes}
                  />
                  <span>min</span>
                </span>
                {errors.maximumMinutes ? (
                  <span
                    className="field-error"
                    id="profile-maximum-minutes-error"
                  >
                    {errors.maximumMinutes}
                  </span>
                ) : null}
              </label>
            </div>
          </section>

          <div className="onboarding-actions">
            <button
              className="button button--primary button--block"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving Profile…" : "Continue to Skills"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
