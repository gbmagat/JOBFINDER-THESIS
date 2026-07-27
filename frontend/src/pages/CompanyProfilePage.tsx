import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Globe2,
  ImagePlus,
  Info,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { isLuminaDemoEmployer } from "../features/employer/demo-workspace";
import { userStorageKey } from "../lib/storage-keys";
import {
  clearNativeFieldError,
  collectFormValidationIssues,
  FormErrorSummary,
  type FormValidationIssue,
} from "../components/FormErrorSummary";

type CompanyProfile = {
  name: string;
  industry: string;
  size: string;
  website: string;
  email: string;
  phone: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  description: string;
  benefits: string;
};

const luminaDemoProfile: CompanyProfile = {
  name: "Lumina Tech Solutions",
  industry: "Information Technology",
  size: "51–200 employees",
  website: "https://www.luminatech.example",
  email: "careers@luminatech.example",
  phone: "+63 945 123 4567",
  street: "4/F Nexus Center, MacArthur Highway",
  barangay: "Balibago",
  city: "Angeles City",
  province: "Pampanga",
  description:
    "Lumina Tech Solutions helps local organizations keep their workplace technology reliable, secure, and easy to use. Our Angeles City team supports growing businesses across Central Luzon.",
  benefits:
    "Health coverage\nPaid skills training\nFlexible leave credits\nPerformance incentives",
};

function createInitialProfile(
  userId: string | undefined,
  displayName: string | undefined,
  email: string | undefined,
): CompanyProfile {
  if (isLuminaDemoEmployer(userId)) {
    return luminaDemoProfile;
  }

  return {
    name: displayName?.trim() || "Your company",
    industry: "Other",
    size: "1–10 employees",
    website: "",
    email: email?.trim() || "",
    phone: "",
    street: "",
    barangay: "",
    city: "Angeles City",
    province: "Pampanga",
    description: "",
    benefits: "",
  };
}

const COMPANY_PROFILE_STORAGE_KEY =
  "jobfinder.employer.company-profile.v1";
const companyProfileFields: (keyof CompanyProfile)[] = [
  "name",
  "industry",
  "size",
  "website",
  "email",
  "phone",
  "street",
  "barangay",
  "city",
  "province",
  "description",
  "benefits",
];

function isCompanyProfile(value: unknown): value is CompanyProfile {
  if (!value || typeof value !== "object") return false;

  return companyProfileFields.every(
    (field) =>
      typeof (value as Partial<CompanyProfile>)[field] === "string",
  );
}

function readCompanyProfile(
  storageKey: string,
  fallbackProfile: CompanyProfile,
): CompanyProfile {
  if (typeof window === "undefined") return fallbackProfile;

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return fallbackProfile;

    const value: unknown = JSON.parse(rawValue);
    return isCompanyProfile(value) ? value : fallbackProfile;
  } catch {
    return fallbackProfile;
  }
}

export function CompanyProfilePage() {
  const { user } = useAuth();
  const storageKey = userStorageKey(COMPANY_PROFILE_STORAGE_KEY, user?.id);
  const initialProfile = useMemo(
    () =>
      createInitialProfile(
        user?.id,
        user?.displayName,
        user?.email,
      ),
    [user?.displayName, user?.email, user?.id],
  );
  const [profile, setProfile] = useState<CompanyProfile>(() =>
    readCompanyProfile(storageKey, initialProfile),
  );
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [logoName, setLogoName] = useState("");
  const [validationIssues, setValidationIssues] = useState<
    FormValidationIssue[]
  >([]);
  const validationSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProfile(readCompanyProfile(storageKey, initialProfile));
    setSaved(false);
    setSaveError("");
    setLogoName("");
    setValidationIssues([]);
  }, [initialProfile, storageKey]);

  function updateProfile<Key extends keyof CompanyProfile>(
    field: Key,
    value: CompanyProfile[Key],
  ) {
    setProfile((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextIssues = collectFormValidationIssues(event.currentTarget);
    setValidationIssues(nextIssues);
    if (nextIssues.length) {
      window.requestAnimationFrame(() =>
        validationSummaryRef.current?.focus(),
      );
      return;
    }

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(profile),
      );
      setSaved(true);
      setSaveError("");
    } catch {
      setSaved(false);
      setSaveError(
        "This browser blocked local saving. Your edits are still available until you leave this page.",
      );
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const address = [
    profile.street,
    profile.barangay,
    profile.city,
    profile.province,
  ]
    .filter(Boolean)
    .join(", ");
  const benefits = profile.benefits
    .split("\n")
    .map((benefit) => benefit.trim())
    .filter(Boolean);

  return (
    <div className="page company-profile-page">
      <Link className="back-link" to="/employer">
        <ArrowLeft size={18} aria-hidden="true" />
        Back to employer overview
      </Link>

      <header className="page-header page-header--split">
        <div className="page-header__copy">
          <span className="eyebrow">Employer identity</span>
          <h1>Company profile</h1>
          <p>
            Keep the information applicants see consistent across every direct
            job post from your company.
          </p>
        </div>
        <span className="badge badge--success company-profile-status">
          <ShieldCheck aria-hidden="true" />
          Profile complete
        </span>
      </header>

      {saved ? (
        <div className="alert alert--success company-save-alert" role="status">
          <CheckCircle2 aria-hidden="true" />
          <span>
            Company profile changes were saved for this frontend prototype.
          </span>
        </div>
      ) : null}
      {saveError ? (
        <div className="alert alert--danger company-save-alert" role="alert">
          <Info aria-hidden="true" />
          <span>{saveError}</span>
        </div>
      ) : null}

      <div className="company-profile-layout">
        <form
          className="company-profile-form form"
          id="company-profile"
          noValidate
          onInputCapture={clearNativeFieldError}
          onSubmit={handleSubmit}
        >
          <FormErrorSummary
            issues={validationIssues}
            summaryRef={validationSummaryRef}
            title="Check the company profile details"
          />
          <section className="surface company-form-section" aria-labelledby="identity-heading">
            <div className="surface__header">
              <div>
                <p className="kicker">Public identity</p>
                <h2 id="identity-heading">Company information</h2>
              </div>
              <Building2 aria-hidden="true" />
            </div>
            <div className="surface__body form">
              <div className="company-logo-field">
                <span className="company-logo-preview" aria-hidden="true">
                  {profile.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((word) => word.charAt(0))
                    .join("")
                    .toUpperCase() || "CO"}
                </span>
                <label className="field">
                  <span className="field-label">Company logo</span>
                  <span className="field-hint">
                    Square PNG, JPG, or SVG · 2 MB maximum
                  </span>
                  <span className="company-logo-control">
                    <ImagePlus aria-hidden="true" />
                    <span>{logoName || "Choose logo"}</span>
                    <input
                      accept=".png,.jpg,.jpeg,.svg"
                      onChange={(event) => {
                        setLogoName(event.target.files?.[0]?.name ?? "");
                        setSaved(false);
                      }}
                      type="file"
                    />
                  </span>
                </label>
              </div>

              <label className="field">
                <span className="field-label">Company name</span>
                <input
                  autoComplete="organization"
                  className="input"
                  onChange={(event) =>
                    updateProfile("name", event.target.value)
                  }
                  required
                  value={profile.name}
                />
              </label>

              <div className="form-grid form-grid--2">
                <label className="field">
                  <span className="field-label">Industry</span>
                  <select
                    className="select"
                    onChange={(event) =>
                      updateProfile("industry", event.target.value)
                    }
                    value={profile.industry}
                  >
                    <option>Information Technology</option>
                    <option>Business process outsourcing</option>
                    <option>Retail and trade</option>
                    <option>Manufacturing</option>
                    <option>Hospitality and tourism</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Company size</span>
                  <select
                    className="select"
                    onChange={(event) =>
                      updateProfile("size", event.target.value)
                    }
                    value={profile.size}
                  >
                    <option>1–10 employees</option>
                    <option>11–50 employees</option>
                    <option>51–200 employees</option>
                    <option>201–500 employees</option>
                    <option>501+ employees</option>
                  </select>
                </label>
              </div>

              <label className="field">
                <span className="field-label">Company website</span>
                <span className="company-input-with-icon">
                  <Globe2 aria-hidden="true" />
                  <input
                    className="input"
                    onChange={(event) =>
                      updateProfile("website", event.target.value)
                    }
                    placeholder="https://"
                    type="url"
                    value={profile.website}
                  />
                </span>
              </label>

              <label className="field">
                <span className="field-label">About the company</span>
                <textarea
                  className="textarea"
                  maxLength={800}
                  onChange={(event) =>
                    updateProfile("description", event.target.value)
                  }
                  required
                  rows={6}
                  value={profile.description}
                />
                <span className="field-hint">
                  {profile.description.length}/800 characters · Describe the
                  work, team, and what makes the company credible.
                </span>
              </label>
            </div>
          </section>

          <section className="surface company-form-section" aria-labelledby="contact-heading">
            <div className="surface__header">
              <div>
                <p className="kicker">Applicant contact</p>
                <h2 id="contact-heading">Contact and workplace</h2>
              </div>
              <MapPin aria-hidden="true" />
            </div>
            <div className="surface__body form">
              <div className="form-grid form-grid--2">
                <label className="field">
                  <span className="field-label">Hiring email</span>
                  <span className="company-input-with-icon">
                    <Mail aria-hidden="true" />
                    <input
                      autoComplete="email"
                      className="input"
                      onChange={(event) =>
                        updateProfile("email", event.target.value)
                      }
                      required
                      type="email"
                      value={profile.email}
                    />
                  </span>
                </label>
                <label className="field">
                  <span className="field-label">Contact number</span>
                  <span className="company-input-with-icon">
                    <Phone aria-hidden="true" />
                    <input
                      autoComplete="tel"
                      className="input"
                      onChange={(event) =>
                        updateProfile("phone", event.target.value)
                      }
                      required
                      type="tel"
                      value={profile.phone}
                    />
                  </span>
                </label>
              </div>

              <label className="field">
                <span className="field-label">Street or building</span>
                <input
                  autoComplete="street-address"
                  className="input"
                  onChange={(event) =>
                    updateProfile("street", event.target.value)
                  }
                  required
                  value={profile.street}
                />
              </label>

              <div className="form-grid company-address-grid">
                <label className="field">
                  <span className="field-label">Barangay</span>
                  <input
                    className="input"
                    onChange={(event) =>
                      updateProfile("barangay", event.target.value)
                    }
                    required
                    value={profile.barangay}
                  />
                </label>
                <label className="field">
                  <span className="field-label">City or municipality</span>
                  <input
                    autoComplete="address-level2"
                    className="input"
                    onChange={(event) =>
                      updateProfile("city", event.target.value)
                    }
                    required
                    value={profile.city}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Province</span>
                  <input
                    autoComplete="address-level1"
                    className="input"
                    onChange={(event) =>
                      updateProfile("province", event.target.value)
                    }
                    required
                    value={profile.province}
                  />
                </label>
              </div>

              <div className="alert">
                <Info aria-hidden="true" />
                <span>
                  Workplace locations support commute-aware recommendations.
                  JobFinder never treats PESO/LGU datasets as company-owned
                  records.
                </span>
              </div>
            </div>
          </section>

          <section className="surface company-form-section" aria-labelledby="benefits-heading">
            <div className="surface__header">
              <div>
                <p className="kicker">Candidate expectations</p>
                <h2 id="benefits-heading">Benefits and workplace highlights</h2>
              </div>
              <UsersRound aria-hidden="true" />
            </div>
            <div className="surface__body">
              <label className="field">
                <span className="field-label">One benefit per line</span>
                <textarea
                  className="textarea"
                  onChange={(event) =>
                    updateProfile("benefits", event.target.value)
                  }
                  rows={6}
                  value={profile.benefits}
                />
                <span className="field-hint">
                  Keep claims accurate and specific. These appear on your
                  company and direct-job pages.
                </span>
              </label>
            </div>
          </section>

          <footer className="company-form-actions">
            <span className="field-hint">
              Fields marked by the browser as required must be completed.
            </span>
            <button className="button button--primary" type="submit">
              <Save aria-hidden="true" />
              Save company profile
            </button>
          </footer>
        </form>

        <aside className="company-profile-preview" aria-labelledby="company-preview-heading">
          <article className="surface company-preview-card">
            <div className="company-preview-hero">
              <span className="company-preview-logo" aria-hidden="true">
                {profile.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word.charAt(0))
                  .join("")
                  .toUpperCase() || "CO"}
              </span>
              <div>
                <p className="kicker">Applicant preview</p>
                <h2 id="company-preview-heading">
                  {profile.name || "Company name"}
                </h2>
                <p>{profile.industry}</p>
              </div>
            </div>
            <div className="surface__body stack stack--3">
              <div className="company-preview-facts">
                <span>
                  <UsersRound aria-hidden="true" />
                  {profile.size}
                </span>
                <span>
                  <MapPin aria-hidden="true" />
                  {address || "Workplace address"}
                </span>
                {profile.website ? (
                  <span>
                    <Globe2 aria-hidden="true" />
                    {profile.website.replace(/^https?:\/\//, "")}
                  </span>
                ) : null}
              </div>
              <div>
                <h3>About us</h3>
                <p>
                  {profile.description ||
                    "Your company description will appear here."}
                </p>
              </div>
              {benefits.length ? (
                <div>
                  <h3>Benefits and highlights</h3>
                  <ul className="company-benefit-list">
                    {benefits.map((benefit) => (
                      <li key={benefit}>
                        <CheckCircle2 aria-hidden="true" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="company-preview-contact">
                <strong>Hiring contact</strong>
                <span>{profile.email}</span>
                <span>{profile.phone}</span>
              </div>
            </div>
          </article>
          <p className="company-preview-note">
            This preview is reused across your company-owned job posts. It does
            not change or overwrite external PESO/LGU dataset records.
          </p>
        </aside>
      </div>
    </div>
  );
}
