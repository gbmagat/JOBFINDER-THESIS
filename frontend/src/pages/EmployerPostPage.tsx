import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Info,
  MapPin,
  Plus,
  Send,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { isLuminaDemoEmployer } from "../features/employer/demo-workspace";
import {
  readPublishedEmployerPosts,
  savePublishedEmployerPost,
  type PublishedEmployerPost,
} from "../features/jobs/employer-posts";
import { userStorageKey } from "../lib/storage-keys";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import {
  clearNativeFieldError,
  collectFormValidationIssues,
  FormErrorSummary,
  type FormValidationIssue,
} from "../components/FormErrorSummary";

type JobDraft = {
  title: string;
  employmentType: string;
  openings: string;
  deadline: string;
  schedule: string;
  description: string;
  salaryMin: string;
  salaryMax: string;
  barangay: string;
  city: string;
  province: string;
  workSetup: string;
};

type StoredJobDraft = {
  draft: JobDraft;
  skills: string[];
  step: number;
  updatedAt: string;
};

const EMPLOYER_DRAFT_STORAGE_KEY =
  "jobfinder.employer.job-draft.v1";
const COMPANY_PROFILE_STORAGE_KEY =
  "jobfinder.employer.company-profile.v1";

const initialDraft: JobDraft = {
  title: "IT Support Specialist",
  employmentType: "Full-time",
  openings: "2",
  deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10),
  schedule: "Monday to Friday, 8:00 AM–5:00 PM",
  description:
    "Provide first-line technical support, troubleshoot Windows workstations, and help employees resolve hardware, software, and network issues.",
  salaryMin: "22000",
  salaryMax: "28000",
  barangay: "Balibago",
  city: "Angeles City",
  province: "Pampanga",
  workSetup: "On-site",
};

const initialSkills = [
  "Troubleshooting",
  "Windows",
  "Technical support",
  "Communication",
];

const jobDraftFields: (keyof JobDraft)[] = [
  "title",
  "employmentType",
  "openings",
  "deadline",
  "schedule",
  "description",
  "salaryMin",
  "salaryMax",
  "barangay",
  "city",
  "province",
  "workSetup",
];

function isJobDraft(value: unknown): value is JobDraft {
  if (!value || typeof value !== "object") return false;

  return jobDraftFields.every(
    (field) => typeof (value as Partial<JobDraft>)[field] === "string",
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function readStoredJobDraft(storageKey: string): StoredJobDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return null;

    const value: unknown = JSON.parse(rawValue);
    if (!value || typeof value !== "object") return null;

    const stored = value as Partial<StoredJobDraft>;
    if (
      !isJobDraft(stored.draft) ||
      !isStringArray(stored.skills) ||
      typeof stored.step !== "number" ||
      stored.step < 1 ||
      stored.step > 3 ||
      typeof stored.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(stored.updatedAt))
    ) {
      return null;
    }

    return {
      draft: stored.draft,
      skills: stored.skills,
      step: stored.step,
      updatedAt: stored.updatedAt,
    };
  } catch {
    return null;
  }
}

function formatCurrency(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
      }).format(amount)
    : "Not specified";
}

function readEmployerName(
  userId: string | undefined,
  displayName: string | undefined,
): string {
  const fallbackName = isLuminaDemoEmployer(userId)
    ? "Lumina Tech Solutions"
    : displayName?.trim() || "Your company";
  if (typeof window === "undefined") return fallbackName;

  try {
    const storageKey = userStorageKey(COMPANY_PROFILE_STORAGE_KEY, userId);
    const value: unknown = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "null",
    );
    return value &&
      typeof value === "object" &&
      typeof (value as { name?: unknown }).name === "string" &&
      (value as { name: string }).name.trim()
      ? (value as { name: string }).name.trim()
      : fallbackName;
  } catch {
    return fallbackName;
  }
}

export function EmployerPostPage() {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const employerName = useMemo(
    () => readEmployerName(user?.id, user?.displayName),
    [user?.displayName, user?.id],
  );
  const draftStorageKey = userStorageKey(
    EMPLOYER_DRAFT_STORAGE_KEY,
    user?.id,
  );
  const storedDraft = useMemo(
    () => readStoredJobDraft(draftStorageKey),
    [draftStorageKey],
  );
  const [step, setStep] = useState(storedDraft?.step ?? 1);
  const [draft, setDraft] = useState<JobDraft>(
    storedDraft?.draft ?? initialDraft,
  );
  const [skills, setSkills] = useState(
    storedDraft?.skills.length ? storedDraft.skills : initialSkills,
  );
  const [skillInput, setSkillInput] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [validationIssues, setValidationIssues] = useState<
    FormValidationIssue[]
  >([]);
  const validationSummaryRef = useRef<HTMLDivElement>(null);

  const progressLabel = `Step ${step} of 3`;
  const location = useMemo(
    () =>
      [draft.barangay, draft.city, draft.province].filter(Boolean).join(", "),
    [draft.barangay, draft.city, draft.province],
  );

  useEffect(() => {
    if (published || typeof window === "undefined") return;

    try {
      const storedValue: StoredJobDraft = {
        draft,
        skills,
        step,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify(storedValue),
      );
    } catch {}
  }, [draft, draftStorageKey, published, skills, step]);

  function updateDraft<Key extends keyof JobDraft>(
    field: Key,
    value: JobDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    setSavedMessage("");
  }

  function addSkill() {
    const nextSkill = skillInput.trim();

    if (
      !nextSkill ||
      skills.some((skill) => skill.toLowerCase() === nextSkill.toLowerCase())
    ) {
      return;
    }

    setSkills((current) => [...current, nextSkill]);
    setSkillInput("");
    setSavedMessage("");
  }

  function handleSkillKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addSkill();
    }
  }

  function removeSkill(skillToRemove: string) {
    setSkills((current) =>
      current.filter((skill) => skill !== skillToRemove),
    );
    setSavedMessage("");
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

    if (step < 3) {
      setValidationIssues([]);
      setStep((current) => current + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (confirmed) {
      if (!isOnline) {
        setPublishError(
          "You are offline. This job post has not been published or queued. Save the draft and reconnect before publishing.",
        );
        return;
      }

      const publishedAt = new Date().toISOString();
      const slug =
        draft.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "job";
      const didPersist = savePublishedEmployerPost({
        ...draft,
        employerName,
        id: `direct-${slug}-${Date.now()}`,
        location,
        ownerId: user?.id ?? "prototype-employer",
        skills,
        publishedAt,
      }, draftStorageKey);

      if (!didPersist) {
        setPublishError(
          "The preview is ready, but this browser could not save the mock post. Check storage permissions and try again.",
        );
        return;
      }

      setPublishError("");
      setPublished(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function saveDraft() {
    if (typeof window === "undefined") return;

    try {
      const storedValue: StoredJobDraft = {
        draft,
        skills,
        step,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify(storedValue),
      );
      setSavedMessage("Draft saved on this device.");
    } catch {
      setSavedMessage(
        "This browser blocked local saving. Keep this page open to retain the draft.",
      );
    }
  }

  if (published) {
    return (
      <div className="page page--narrow employer-post-page">
        <section className="success-state employer-publish-success" role="status">
          <span className="icon-tile icon-tile--success">
            <CheckCircle2 aria-hidden="true" />
          </span>
          <p className="kicker">Direct employer post</p>
          <h1>Your job post is ready</h1>
          <p>
            <strong>{draft.title}</strong> is now represented as a direct
            {employerName} listing in this frontend prototype. The production
            backend will persist and publish the real record.
          </p>
          <div className="cluster">
            <Link className="button button--primary" to="/employer">
              Return to overview
            </Link>
            <Link
              className="button button--secondary"
              to="/employer/candidates"
            >
              View candidate matches
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page page--narrow employer-post-page">
      <Link className="back-link" to="/employer">
        <ArrowLeft size={18} aria-hidden="true" />
        Back to employer overview
      </Link>

      <header className="page-header employer-wizard-header">
        <div className="cluster cluster--between">
          <div>
            <span className="eyebrow">Create a direct job post</span>
            <h1>
              {step === 1
                ? "Describe the opportunity"
                : step === 2
                  ? "Set skills and location"
                  : "Preview and publish"}
            </h1>
          </div>
          <span className="quiet-badge" aria-live="polite">
            {progressLabel}
          </span>
        </div>
        <p>
          {step === 1
            ? "Give job seekers the core details they need before deciding to apply."
            : step === 2
              ? "These requirements create transparent skill and geographic match evidence."
              : "Check how this vacancy will appear before making it public."}
        </p>
      </header>

      <ol className="employer-wizard-steps" aria-label="Job post progress">
        {["Job details", "Skills & location", "Preview"].map((label, index) => {
          const itemStep = index + 1;
          const isCurrent = itemStep === step;
          const isComplete = itemStep < step;

          return (
            <li
              className={`${isCurrent ? "is-current" : ""}${
                isComplete ? " is-complete" : ""
              }`}
              key={label}
              aria-current={isCurrent ? "step" : undefined}
            >
              <button
                disabled={itemStep > step}
                onClick={() => setStep(itemStep)}
                type="button"
              >
                <span aria-hidden="true">
                  {isComplete ? <Check size={16} /> : itemStep}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      <form
        className="employer-wizard-form"
        id="employer-job-post"
        noValidate
        onInputCapture={clearNativeFieldError}
        onSubmit={handleSubmit}
      >
        <FormErrorSummary
          issues={validationIssues}
          summaryRef={validationSummaryRef}
          title="Check the job post details"
        />
        {step === 1 ? (
          <section className="surface employer-wizard-card" aria-labelledby="details-heading">
            <div className="surface__header">
              <div>
                <p className="kicker">Step 1</p>
                <h2 id="details-heading">Job details</h2>
              </div>
              <BriefcaseBusiness aria-hidden="true" />
            </div>
            <div className="surface__body form">
              <label className="field">
                <span className="field-label">Job title</span>
                <input
                  autoComplete="organization-title"
                  className="input"
                  onChange={(event) => updateDraft("title", event.target.value)}
                  required
                  value={draft.title}
                />
                <span className="field-hint">
                  Use a familiar title that candidates are likely to search.
                </span>
              </label>

              <div className="form-grid form-grid--2">
                <label className="field">
                  <span className="field-label">Employment type</span>
                  <select
                    className="select"
                    onChange={(event) =>
                      updateDraft("employmentType", event.target.value)
                    }
                    value={draft.employmentType}
                  >
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                    <option>Internship</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Number of openings</span>
                  <input
                    className="input"
                    min="1"
                    onChange={(event) =>
                      updateDraft("openings", event.target.value)
                    }
                    required
                    type="number"
                    value={draft.openings}
                  />
                </label>
              </div>

              <label className="field">
                <span className="field-label">Job description</span>
                <textarea
                  className="textarea"
                  maxLength={1200}
                  onChange={(event) =>
                    updateDraft("description", event.target.value)
                  }
                  required
                  rows={7}
                  value={draft.description}
                />
                <span className="field-hint">
                  {draft.description.length}/1,200 characters
                </span>
              </label>

              <div className="form-grid form-grid--2">
                <label className="field">
                  <span className="field-label">Application deadline</span>
                  <input
                    className="input"
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) =>
                      updateDraft("deadline", event.target.value)
                    }
                    required
                    type="date"
                    value={draft.deadline}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Work schedule</span>
                  <input
                    className="input"
                    maxLength={120}
                    onChange={(event) =>
                      updateDraft("schedule", event.target.value)
                    }
                    placeholder="For example, Monday to Friday, 8 AM–5 PM"
                    required
                    value={draft.schedule}
                  />
                </label>
              </div>

              <fieldset className="employer-fieldset">
                <legend>
                  <CircleDollarSign size={18} aria-hidden="true" />
                  Monthly salary range
                </legend>
                <div className="form-grid form-grid--2">
                  <label className="field">
                    <span className="field-label">Minimum pay (PHP)</span>
                    <input
                      className="input"
                      min="0"
                      onChange={(event) =>
                        updateDraft("salaryMin", event.target.value)
                      }
                      inputMode="numeric"
                      type="number"
                      value={draft.salaryMin}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Maximum pay (PHP)</span>
                    <input
                      className="input"
                      min={draft.salaryMin || "0"}
                      onChange={(event) =>
                        updateDraft("salaryMax", event.target.value)
                      }
                      inputMode="numeric"
                      type="number"
                      value={draft.salaryMax}
                    />
                  </label>
                </div>
              </fieldset>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <div className="employer-wizard-grid">
            <section className="surface employer-wizard-card" aria-labelledby="skills-heading">
              <div className="surface__header">
                <div>
                  <p className="kicker">Required competencies</p>
                  <h2 id="skills-heading">Skills</h2>
                </div>
                <Sparkles aria-hidden="true" />
              </div>
              <div className="surface__body form">
                <div className="field">
                  <label className="field-label" htmlFor="required-skill">
                    Add a required skill
                  </label>
                  <div className="employer-skill-entry">
                    <input
                      className="input"
                      id="required-skill"
                      list="common-employer-skills"
                      onChange={(event) => setSkillInput(event.target.value)}
                      onKeyDown={handleSkillKeyDown}
                      placeholder="For example, network troubleshooting"
                      value={skillInput}
                    />
                    <button
                      className="button button--secondary"
                      disabled={!skillInput.trim()}
                      onClick={addSkill}
                      type="button"
                    >
                      <Plus aria-hidden="true" />
                      Add
                    </button>
                  </div>
                  <datalist id="common-employer-skills">
                    <option value="Network troubleshooting" />
                    <option value="Customer service" />
                    <option value="Help desk support" />
                    <option value="Hardware maintenance" />
                    <option value="Active Directory" />
                  </datalist>
                  <span className="field-hint">
                    Exact and ontology-related skills can both contribute to
                    SkillScore.
                  </span>
                </div>

                <div className="employer-selected-skills" aria-live="polite">
                  <div className="cluster cluster--between">
                    <h3>Selected skills</h3>
                    <span>{skills.length} added</span>
                  </div>
                  {skills.length ? (
                    <ul className="skill-chip-list" aria-label="Required skills">
                      {skills.map((skill) => (
                        <li className="skill-chip" key={skill}>
                          <span>{skill}</span>
                          <button
                            aria-label={`Remove ${skill}`}
                            className="skill-chip__remove"
                            onClick={() => removeSkill(skill)}
                            type="button"
                          >
                            <X size={15} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="field-error">
                      Add at least one required skill to calculate a skill
                      match.
                    </p>
                  )}
                </div>

                <div className="alert">
                  <Info aria-hidden="true" />
                  <span>
                    JobFinder explains exact, related, and missing skills to
                    both employers and applicants. It does not hide the basis
                    of a recommendation.
                  </span>
                </div>
              </div>
            </section>

            <section className="surface employer-wizard-card" aria-labelledby="location-heading">
              <div className="surface__header">
                <div>
                  <p className="kicker">Workplace accessibility</p>
                  <h2 id="location-heading">Location</h2>
                </div>
                <MapPin aria-hidden="true" />
              </div>
              <div className="surface__body form">
                <label className="field">
                  <span className="field-label">Barangay</span>
                  <input
                    className="input"
                    onChange={(event) =>
                      updateDraft("barangay", event.target.value)
                    }
                    required
                    value={draft.barangay}
                  />
                </label>
                <div className="form-grid form-grid--2">
                  <label className="field">
                    <span className="field-label">City or municipality</span>
                    <input
                      className="input"
                      readOnly
                      value={draft.city}
                    />
                    <span className="field-hint">
                      JobFinder currently covers Angeles City.
                    </span>
                  </label>
                  <label className="field">
                    <span className="field-label">Province</span>
                    <input
                      className="input"
                      readOnly
                      value={draft.province}
                    />
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">Work setup</span>
                  <select
                    className="select"
                    onChange={(event) =>
                      updateDraft("workSetup", event.target.value)
                    }
                    value={draft.workSetup}
                  >
                    <option>On-site</option>
                    <option>Hybrid</option>
                    <option>Remote</option>
                  </select>
                </label>
                <div className="employer-location-preview">
                  <MapPin size={18} aria-hidden="true" />
                  <span>
                    <strong>Candidate-facing location</strong>
                    {location || "Add a complete workplace location"}
                  </span>
                </div>
                <p className="field-hint">
                  LocationScore uses the workplace and the candidate&apos;s
                  saved travel preferences. Exact home addresses are not shown
                  to employers.
                </p>
              </div>
            </section>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="employer-preview-layout">
            <article className="surface employer-job-preview" aria-labelledby="preview-heading">
              <div className="surface__header">
                <div>
                  <p className="kicker">Public listing preview</p>
                  <h2 id="preview-heading">{draft.title}</h2>
                </div>
                <span className="badge badge--blue">Direct employer post</span>
              </div>
              <div className="surface__body stack stack--3">
                <p className="employer-preview-company">{employerName}</p>
                <div className="job-card__facts">
                  <span>{draft.employmentType}</span>
                  <span>{draft.workSetup}</span>
                  <span>{draft.openings} openings</span>
                  <span>Apply by {draft.deadline}</span>
                </div>
                <div className="job-card__meta">
                  <span>
                    <MapPin aria-hidden="true" />
                    {location}
                  </span>
                  <span>
                    <CircleDollarSign aria-hidden="true" />
                    {formatCurrency(draft.salaryMin)} –{" "}
                    {formatCurrency(draft.salaryMax)} monthly
                  </span>
                </div>
                <div>
                  <h3>About the role</h3>
                <p className="employer-preview-description">
                  {draft.description}
                </p>
                <p>
                  <strong>Schedule:</strong> {draft.schedule}
                </p>
                </div>
                <div>
                  <h3>Required skills</h3>
                  <div className="chip-row">
                    {skills.map((skill) => (
                      <span className="badge badge--outline" key={skill}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <aside className="stack stack--2">
              <section className="surface match-preview-card" aria-labelledby="matching-preview-heading">
                <div className="surface__header">
                  <div>
                    <p className="kicker">Transparent ranking</p>
                    <h2 id="matching-preview-heading">How matches are scored</h2>
                  </div>
                </div>
                <div className="surface__body stack stack--2">
                  <div className="score-grid">
                    <div className="score-card">
                      <span className="score-card__value">70%</span>
                      <span className="score-card__label">Skill fit weight</span>
                    </div>
                    <div className="score-card">
                      <span className="score-card__value">30%</span>
                      <span className="score-card__label">Location weight</span>
                    </div>
                  </div>
                  <p className="match-breakdown__formula">
                    FinalScore = (SkillScore × 0.70) + (LocationScore × 0.30)
                  </p>
                  <p className="field-hint">
                    Candidate results show the exact evidence behind both
                    scores. Ranking supports review; it does not automatically
                    reject applicants.
                  </p>
                </div>
              </section>

              <section className="surface employer-publish-check">
                <div className="surface__body stack stack--2">
                  <div className="alert">
                    <Database aria-hidden="true" />
                    <span>
                      This will be labeled as a direct {employerName} post.
                      PESO/LGU datasets remain separate, attributed, and
                      read-only.
                    </span>
                  </div>
                  <label className="checkbox-row">
                    <input
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                      required
                      type="checkbox"
                    />
                    <span>
                      I confirm this is an active vacancy owned by our company
                      and the information above is accurate.
                    </span>
                  </label>
                </div>
              </section>
              {!isOnline ? (
                <div className="notice notice--warning" role="status">
                  <WifiOff aria-hidden="true" />
                  <p>
                    You can keep editing and save this draft offline, but
                    publishing requires a confirmed connection and will not be
                    queued.
                  </p>
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}

        {publishError ? (
          <div className="alert alert--danger" role="alert">
            <Info aria-hidden="true" />
            <span>{publishError}</span>
          </div>
        ) : null}

        <footer className="employer-wizard-actions">
          <div>
            <button
              className="button button--neutral"
              onClick={saveDraft}
              type="button"
            >
              Save draft
            </button>
            <span className="employer-save-status" role="status">
              {savedMessage}
            </span>
          </div>
          <div className="cluster cluster--end">
            {step > 1 ? (
              <button
                className="button button--ghost"
                onClick={() => setStep((current) => current - 1)}
                type="button"
              >
                <ArrowLeft aria-hidden="true" />
                Back
              </button>
            ) : null}
            <button
              className="button button--primary"
              disabled={
                (step === 2 && skills.length === 0) ||
                (step === 3 && (!confirmed || !isOnline))
              }
              type="submit"
            >
              {step === 3 ? (
                <>
                  <Send aria-hidden="true" />
                  Publish job
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
