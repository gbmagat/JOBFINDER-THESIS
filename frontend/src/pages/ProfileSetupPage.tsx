import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  LocateFixed,
  MapPin,
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
  DEFAULT_PROFILE_DETAILS,
  PROFILE_DETAILS_KEY,
} from "../features/profile/storage";
import { usePersistentState } from "../lib/usePersistentState";
import { userStorageKey } from "../lib/storage-keys";
import { apiRequest } from "../lib/api";
import {
  HomeLocationMap,
  type HomeLocationPoint,
} from "../features/maps/HomeLocationMap";

type ProfileField =
  | "fullName"
  | "mobileNumber"
  | "barangay"
  | "city";

const profileFieldIds: Record<ProfileField, string> = {
  fullName: "profile-full-name",
  mobileNumber: "profile-mobile-number",
  barangay: "profile-barangay",
  city: "profile-city",
};

function homeNodeIdForBarangay(barangay: string) {
  const normalized = barangay.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("rosario") || normalized.includes("nepo")) {
    return "nepo-center";
  }
  if (normalized.includes("maragul") || normalized.includes("marquee")) {
    return "marquee";
  }
  if (normalized.includes("business")) return "balibago-business";
  return "balibago";
}

type LocationState = "idle" | "locating" | "resolving" | "ready" | "error";

interface ResolvedHomeLocation {
  areaName: string;
  barangay: string;
  city: string;
  homeNodeId: string;
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
  const [errors, setErrors] = useState<
    Partial<Record<ProfileField, string>>
  >({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [homeNodeId, setHomeNodeId] = useState(() =>
    homeNodeIdForBarangay(profile.barangay),
  );
  const [locationState, setLocationState] = useState<LocationState>(() =>
    profile.barangay.trim() ? "ready" : "idle",
  );
  const [locationMessage, setLocationMessage] = useState("");
  const [pinnedLocation, setPinnedLocation] =
    useState<HomeLocationPoint | null>(null);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const locationRequestRef = useRef(0);
  const { barangay, city, fullName, mobileNumber } = profile;
  const locationBusy =
    locationState === "locating" || locationState === "resolving";
  const locationReady = Boolean(
    homeNodeId &&
      barangay.trim() &&
      city.trim().toLowerCase() === "angeles city",
  );

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;

    let active = true;
    apiRequest<{
      profile: {
        fullName: string;
        mobileNumber: string;
         barangay: string;
         city: string;
         homeNodeId: string;
       };
    }>("/profile")
      .then(({ profile: savedProfile }) => {
        if (!active) return;
        setProfile({
          fullName: savedProfile.fullName,
          mobileNumber: savedProfile.mobileNumber,
          barangay: savedProfile.barangay,
          city: savedProfile.city,
        });
        const savedHomeNodeId =
          savedProfile.homeNodeId ||
          homeNodeIdForBarangay(savedProfile.barangay);
        setHomeNodeId(savedHomeNodeId);
        setLocationState(
          savedHomeNodeId && savedProfile.barangay.trim() ? "ready" : "idle",
        );
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [setProfile, user?.id]);

  function updateProfile(
    field: keyof typeof profile,
    value: string,
  ) {
    setProfile((current) => ({ ...current, [field]: value }));
    if (field === "barangay") {
      setHomeNodeId(homeNodeIdForBarangay(value));
      setPinnedLocation(null);
      setLocationMessage("");
      setLocationState(value.trim() ? "ready" : "idle");
    } else if (field === "city") {
      setPinnedLocation(null);
      setLocationMessage("");
      setLocationState(
        value.trim().toLowerCase() === "angeles city" && barangay.trim()
          ? "ready"
          : "idle",
      );
    }
    setErrors((current) => {
      const next = { ...current };
      delete next[field as ProfileField];
      return next;
    });
  }

  const resolveHomeLocation = useCallback(
    async (point: HomeLocationPoint, source: "device" | "map") => {
      const requestId = ++locationRequestRef.current;
      setPinnedLocation(point);
      setLocationState("resolving");
      setLocationMessage(
        source === "device"
          ? "Checking your approximate home area…"
          : "Checking this pin…",
      );

      try {
        const result = await apiRequest<{ location: ResolvedHomeLocation }>(
          "/profile/location/resolve",
          {
            method: "POST",
            body: JSON.stringify(point),
          },
        );
        if (requestId !== locationRequestRef.current) return;

        setProfile((current) => ({
          ...current,
          barangay: result.location.barangay,
          city: result.location.city,
        }));
        setHomeNodeId(result.location.homeNodeId);
        setLocationState("ready");
        setLocationMessage(`Pinned near ${result.location.areaName}.`);
        setShowLocationMap(source === "map");
        setErrors((current) => {
          const next = { ...current };
          delete next.barangay;
          delete next.city;
          return next;
        });
      } catch (error) {
        if (requestId !== locationRequestRef.current) return;
        setLocationState("error");
        setLocationMessage(
          error instanceof Error
            ? error.message
            : "This location could not be matched. Try another pin.",
        );
        setShowLocationMap(true);
      }
    },
    [setProfile],
  );

  function useDeviceLocation() {
    setServerError("");
    if (!("geolocation" in navigator)) {
      setLocationState("error");
      setLocationMessage(
        "Device location is unavailable. Pin your approximate home area instead.",
      );
      setShowLocationMap(true);
      return;
    }

    setLocationState("locating");
    setLocationMessage("Waiting for location permission…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void resolveHomeLocation(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          "device",
        );
      },
      (error) => {
        setLocationState("error");
        setShowLocationMap(true);
        setLocationMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location access was not approved. Pin your approximate home area instead."
            : error.code === error.TIMEOUT
              ? "Device location timed out. Pin your approximate home area instead."
              : "Device location is unavailable. Pin your approximate home area instead.",
        );
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: 10_000,
      },
    );
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
          homeNodeId: homeNodeId || homeNodeIdForBarangay(barangay),
          preferredWorkTypes: [],
        }),
      });
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
                <p className="kicker">Location for Job Matching</p>
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

            <div className="onboarding-location-actions">
              <button
                className="button button--secondary"
                disabled={locationBusy}
                onClick={useDeviceLocation}
                type="button"
              >
                <LocateFixed size={17} aria-hidden="true" />
                {locationState === "locating"
                  ? "Checking location…"
                  : "Use current location"}
              </button>
              <button
                aria-controls="home-location-picker"
                aria-expanded={showLocationMap}
                className="button button--secondary"
                disabled={locationBusy}
                onClick={() => setShowLocationMap((current) => !current)}
                type="button"
              >
                <MapPin size={17} aria-hidden="true" />
                {showLocationMap ? "Hide map" : "Pin on map"}
              </button>
            </div>

            <div
              aria-live="polite"
              className={`onboarding-location-summary onboarding-location-summary--${
                locationReady ? "ready" : "pending"
              }`}
              role="status"
            >
              <LocateFixed size={18} aria-hidden="true" />
              <span>
                <strong>
                  {locationState === "locating"
                    ? "Checking device location"
                    : locationState === "resolving"
                      ? "Checking pinned area"
                      : locationReady
                        ? "Location ready"
                        : "Location not ready"}
                </strong>
                {locationMessage ||
                  (locationReady
                    ? `${barangay}, ${city}`
                    : "Enter your barangay or pin an approximate home area.")}
                <small>Exact coordinates are not saved.</small>
              </span>
            </div>

            {showLocationMap ? (
              <div id="home-location-picker">
                <HomeLocationMap
                  disabled={locationBusy}
                  onChange={(point) => void resolveHomeLocation(point, "map")}
                  value={pinnedLocation}
                />
              </div>
            ) : null}
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
