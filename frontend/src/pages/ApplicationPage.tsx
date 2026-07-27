import {
  type ChangeEvent,
  type FormEvent,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArchiveX,
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  Info,
  Mail,
  MapPin,
  Phone,
  Save,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  APPLICATION_DRAFTS_STORAGE_KEY,
  EMPLOYER_APPLICATION_INBOX_STORAGE_KEY,
  SUBMITTED_APPLICATIONS_STORAGE_KEY,
  type StoredSubmittedApplication,
} from "../features/applications/storage-contract";
import { readSubmittedApplications } from "../features/applications/submitted-storage";
import { useAuth } from "../features/auth/AuthContext";
import { applicationMethodLabel, getJobById } from "../features/jobs/data";
import { SourceProvenance } from "../features/jobs/SourceProvenance";
import type {
  ApplicationMethod,
  JobListing,
} from "../features/jobs/types";
import { userStorageKey } from "../lib/storage-keys";
import { useOnlineStatus } from "../lib/useOnlineStatus";

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 1_000;

type ApplicationStep = 1 | 2 | 3;
type ApplicationField =
  | "fullName"
  | "email"
  | "mobile"
  | "resume"
  | "message"
  | "confirmation";
type ValidationErrors = Partial<Record<ApplicationField, string>>;

interface StoredApplicationDraft {
  version: 1;
  jobId: string;
  fullName: string;
  email: string;
  mobile: string;
  message: string;
  resumeName: string | null;
  updatedAt: string;
}

const APPLICATION_STEPS = [
  { number: 1, label: "Your details" },
  { number: 2, label: "Resume and message" },
  { number: 3, label: "Review and submit" },
] as const;

const FIELD_IDS: Record<ApplicationField, string> = {
  fullName: "application-full-name",
  email: "application-email",
  mobile: "application-mobile",
  resume: "application-resume",
  message: "application-message",
  confirmation: "application-confirmation",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseDraft(value: unknown): StoredApplicationDraft | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.jobId !== "string" ||
    typeof value.fullName !== "string" ||
    typeof value.email !== "string" ||
    typeof value.mobile !== "string" ||
    typeof value.message !== "string" ||
    (value.resumeName !== null && typeof value.resumeName !== "string") ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    version: 1,
    jobId: value.jobId,
    fullName: value.fullName,
    email: value.email,
    mobile: value.mobile,
    message: value.message,
    resumeName: value.resumeName,
    updatedAt: value.updatedAt,
  };
}

function readDraftCollection(
  storage: Storage | null = getLocalStorage(),
  storageKey = APPLICATION_DRAFTS_STORAGE_KEY,
): Record<string, StoredApplicationDraft> {
  if (!storage) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(storageKey) ?? "{}",
    );

    if (!isRecord(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<
      Record<string, StoredApplicationDraft>
    >((drafts, [jobId, value]) => {
      const draft = parseDraft(value);
      if (draft && draft.jobId === jobId) {
        drafts[jobId] = draft;
      }
      return drafts;
    }, {});
  } catch {
    return {};
  }
}

function readDraft(
  jobId: string,
  storageKey = APPLICATION_DRAFTS_STORAGE_KEY,
): StoredApplicationDraft | null {
  return readDraftCollection(undefined, storageKey)[jobId] ?? null;
}

function writeDraft(
  draft: StoredApplicationDraft,
  storageKey = APPLICATION_DRAFTS_STORAGE_KEY,
): boolean {
  const storage = getLocalStorage();
  if (!storage) {
    return false;
  }

  try {
    const drafts = readDraftCollection(storage, storageKey);
    storage.setItem(
      storageKey,
      JSON.stringify({ ...drafts, [draft.jobId]: draft }),
    );
    return true;
  } catch {
    return false;
  }
}

function removeDraft(
  jobId: string,
  storageKey = APPLICATION_DRAFTS_STORAGE_KEY,
) {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  try {
    const drafts = readDraftCollection(storage, storageKey);
    delete drafts[jobId];
    storage.setItem(storageKey, JSON.stringify(drafts));
  } catch {}
}

function writeSubmittedApplication(
  application: StoredSubmittedApplication,
  storageKeys: string[],
): boolean {
  const storage = getLocalStorage();
  if (!storage) {
    return false;
  }

  try {
    const uniqueKeys = [...new Set(storageKeys)];
    const previousValues = new Map(
      uniqueKeys.map((storageKey) => [
        storageKey,
        storage.getItem(storageKey),
      ]),
    );

    try {
      uniqueKeys.forEach((storageKey) => {
        const current = readSubmittedApplications(
          storage,
          storageKey,
        ).filter((stored) => stored.id !== application.id);
        storage.setItem(
          storageKey,
          JSON.stringify([application, ...current].slice(0, 100)),
        );
      });
    } catch {
      previousValues.forEach((previousValue, storageKey) => {
        if (previousValue === null) {
          storage.removeItem(storageKey);
        } else {
          storage.setItem(storageKey, previousValue);
        }
      });
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isSafeTarget(method: ApplicationMethod, target?: string) {
  if (method === "jobfinder" || method === "in-person") return true;
  if (!target) return false;
  if (method === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target);
  if (method === "phone") return /^[+\d][\d\s()-]{6,}$/.test(target);
  if (method === "external-url") {
    try {
      return new URL(target).protocol === "https:";
    } catch {
      return false;
    }
  }
  return false;
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateContactDetails(
  fullName: string,
  email: string,
  mobile: string,
): ValidationErrors {
  const errors: ValidationErrors = {};
  const normalizedMobile = mobile.replace(/[\s()-]/g, "");

  if (fullName.trim().length < 2) {
    errors.fullName = "Enter your full name.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!/^(?:\+639|09)\d{9}$/.test(normalizedMobile)) {
    errors.mobile =
      "Enter a valid Philippine mobile number, such as 09171234567.";
  }

  return errors;
}

function validateResumeAndMessage(
  resumeFile: File | null,
  message: string,
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!resumeFile) {
    errors.resume = "Choose the resume you want to send.";
  } else {
    const extensionIsAllowed = /\.(pdf|doc|docx)$/i.test(resumeFile.name);
    if (!extensionIsAllowed) {
      errors.resume = "Use a PDF, DOC, or DOCX resume.";
    } else if (resumeFile.size > MAX_RESUME_SIZE_BYTES) {
      errors.resume = "Choose a resume smaller than 5 MB.";
    }
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    errors.message = `Keep your message within ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`;
  }

  return errors;
}

function ApplicationErrorSummary({
  errors,
  summaryRef,
}: {
  errors: ValidationErrors;
  summaryRef: RefObject<HTMLDivElement | null>;
}) {
  const entries = Object.entries(errors) as [
    ApplicationField,
    string,
  ][];

  if (!entries.length) {
    return null;
  }

  return (
    <div
      aria-labelledby="application-error-heading"
      className="application-error-summary"
      ref={summaryRef}
      role="alert"
      tabIndex={-1}
    >
      <AlertCircle size={22} aria-hidden="true" />
      <div>
        <h2 id="application-error-heading">
          Check {entries.length === 1 ? "this detail" : "these details"}
        </h2>
        <ul>
          {entries.map(([field, message]) => (
            <li key={field}>
              <a href={`#${FIELD_IDS[field]}`}>{message}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function NativeApplicationFlow({ job }: { job: JobListing }) {
  const { user } = useAuth();
  const draftsStorageKey = userStorageKey(
    APPLICATION_DRAFTS_STORAGE_KEY,
    user?.id,
  );
  const submissionsStorageKey = userStorageKey(
    SUBMITTED_APPLICATIONS_STORAGE_KEY,
    user?.id,
  );
  const initialDraft = useMemo(
    () => readDraft(job.id, draftsStorageKey),
    [draftsStorageKey, job.id],
  );
  const [step, setStep] = useState<ApplicationStep>(1);
  const [maximumReachedStep, setMaximumReachedStep] =
    useState<ApplicationStep>(1);
  const [fullName, setFullName] = useState(
    initialDraft?.fullName || user?.displayName || "",
  );
  const [email, setEmail] = useState(
    initialDraft?.email || user?.email || "",
  );
  const [mobile, setMobile] = useState(initialDraft?.mobile ?? "");
  const [message, setMessage] = useState(initialDraft?.message ?? "");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [savedResumeName, setSavedResumeName] = useState(
    initialDraft?.resumeName ?? null,
  );
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [draftStatus, setDraftStatus] = useState(
    initialDraft
      ? `Draft restored from ${new Date(initialDraft.updatedAt).toLocaleString()}.`
      : "",
  );
  const [submissionStorageError, setSubmissionStorageError] = useState("");
  const isOnline = useOnlineStatus();
  const [submittedApplication, setSubmittedApplication] =
    useState<StoredSubmittedApplication | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasRenderedStep = useRef(false);
  const draftStatusId = useId();

  useEffect(() => {
    if (!hasRenderedStep.current) {
      hasRenderedStep.current = true;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (isOnline) {
      setSubmissionStorageError("");
    }
  }, [isOnline]);

  function clearFieldError(field: ApplicationField) {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function showErrors(nextErrors: ValidationErrors) {
    setErrors(nextErrors);
    const hasErrors = Object.keys(nextErrors).length > 0;
    if (hasErrors) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
    }
    return !hasErrors;
  }

  function goToStep(nextStep: ApplicationStep) {
    if (nextStep > maximumReachedStep) {
      return;
    }
    setErrors({});
    setSubmissionStorageError("");
    setStep(nextStep);
  }

  function continueFromDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateContactDetails(fullName, email, mobile);
    if (!showErrors(nextErrors)) {
      return;
    }

    setMaximumReachedStep((current) =>
      Math.max(current, 2) as ApplicationStep,
    );
    setStep(2);
  }

  function continueFromResume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateResumeAndMessage(resumeFile, message);
    if (!showErrors(nextErrors)) {
      return;
    }

    setMaximumReachedStep(3);
    setStep(3);
  }

  function handleResumeChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setResumeFile(file);
    setSavedResumeName(file?.name ?? null);
    setDraftStatus("");
    clearFieldError("resume");
  }

  function saveDraft() {
    const now = new Date();
    const saved = writeDraft(
      {
        version: 1,
        jobId: job.id,
        fullName,
        email,
        mobile,
        message,
        resumeName: resumeFile?.name ?? savedResumeName,
        updatedAt: now.toISOString(),
      },
      draftsStorageKey,
    );

    setDraftStatus(
      saved
        ? `Draft saved on this device at ${now.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}. Resume files must be chosen again after leaving this page.`
        : "This browser could not save your draft. Keep this page open to retain your entries.",
    );
  }

  function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isOnline) {
      setSubmissionStorageError(
        "You are offline. JobFinder has not queued or submitted this application. Reconnect, then submit again.",
      );
      return;
    }

    const nextErrors = {
      ...validateContactDetails(fullName, email, mobile),
      ...validateResumeAndMessage(resumeFile, message),
      ...(!confirmed
        ? {
            confirmation:
              "Confirm that your application information is accurate.",
          }
        : {}),
    };

    if (!showErrors(nextErrors) || !resumeFile) {
      return;
    }

    const appliedAt = new Date().toISOString();
    const application: StoredSubmittedApplication = {
      version: 1,
      id: `JF-${Date.now().toString(36).toUpperCase()}`,
      jobId: job.id,
      jobTitle: job.title,
      employerName: job.employerName,
      location: `${job.location.barangay}, ${job.location.city}`,
      applicantAccountId:
        user?.id ?? `mock-${email.trim().toLowerCase()}`,
      recipientEmployerId:
        job.source.origin === "direct-employer"
          ? job.source.ownerId
          : "external-source",
      appliedAt,
      status: "Submitted",
      applicant: {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
      },
      resume: {
        name: resumeFile.name,
        sizeBytes: resumeFile.size,
        type: resumeFile.type || "application/octet-stream",
      },
      message: message.trim(),
    };

    if (
      !writeSubmittedApplication(application, [
        submissionsStorageKey,
        userStorageKey(
          EMPLOYER_APPLICATION_INBOX_STORAGE_KEY,
          application.recipientEmployerId,
        ),
      ])
    ) {
      setSubmissionStorageError(
        "We could not save this application on your device. Check your browser storage settings, then try again.",
      );
      return;
    }

    removeDraft(job.id, draftsStorageKey);
    setSubmittedApplication(application);
    setDraftStatus("");
    setSubmissionStorageError("");
  }

  if (submittedApplication) {
    return (
      <section
        aria-labelledby="application-confirmation-heading"
        className="success-state application-confirmation"
        role="status"
      >
        <span className="icon-tile icon-tile--success">
          <CheckCircle2 size={28} aria-hidden="true" />
        </span>
        <p className="kicker">Application submitted</p>
        <h2 id="application-confirmation-heading">
          Your application was sent to {job.employerName}
        </h2>
        <p>
          Your application is saved in this frontend prototype. You can now
          track it in your application history.
        </p>
        <dl className="application-confirmation__details">
          <div>
            <dt>Reference</dt>
            <dd>{submittedApplication.id}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>
              <time dateTime={submittedApplication.appliedAt}>
                {new Date(submittedApplication.appliedAt).toLocaleString()}
              </time>
            </dd>
          </div>
        </dl>
        <div className="application-actions">
          <Link className="button button--primary" to="/applications">
            View applications
          </Link>
          <Link
            className="button button--secondary"
            to={`/jobs/${job.id}`}
          >
            Back to job details
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={`Application for ${job.title}`}
      className="application-workflow"
    >
      <nav aria-label="Application progress" className="application-stepper">
        <ol className="application-stepper__list">
          {APPLICATION_STEPS.map(({ number, label }) => {
            const isCurrent = step === number;
            const isComplete = step > number;
            const isAvailable = number <= maximumReachedStep;

            return (
              <li
                className={[
                  "application-stepper__item",
                  isCurrent ? "is-current" : "",
                  isComplete ? "is-complete" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={number}
              >
                <button
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Step ${number} of 3: ${label}${
                    isComplete ? ", completed" : ""
                  }`}
                  disabled={!isAvailable || isCurrent}
                  onClick={() => goToStep(number)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="application-stepper__number"
                  >
                    {isComplete ? <Check size={16} /> : number}
                  </span>
                  <span className="application-stepper__label">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <ApplicationErrorSummary
        errors={errors}
        summaryRef={errorSummaryRef}
      />

      {!isOnline ? (
        <div
          className="notice notice--warning application-offline-status"
          id="application-offline-status"
          role="status"
        >
          <AlertCircle size={20} aria-hidden="true" />
          <p>
            You are offline. You can keep editing or save a draft on this
            device, but JobFinder will not queue or submit the application
            until you reconnect.
          </p>
        </div>
      ) : null}

      {step === 1 ? (
        <form
          className="application-step-panel content-card"
          noValidate
          onSubmit={continueFromDetails}
        >
          <header className="application-step-panel__header">
            <span className="icon-tile icon-tile--soft">
              <UserRound size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="kicker">Step 1 of 3</p>
              <h2 ref={stepHeadingRef} tabIndex={-1}>
                Personal and contact details
              </h2>
              <p>Only the employer receiving this application can see these details.</p>
            </div>
          </header>

          <div className="form-grid form-grid--2 application-fields">
            <div className="field">
              <label className="field-label" htmlFor={FIELD_IDS.fullName}>
                Full name
              </label>
              <input
                aria-describedby={
                  errors.fullName ? "application-full-name-error" : undefined
                }
                aria-invalid={Boolean(errors.fullName)}
                autoComplete="name"
                className="input"
                id={FIELD_IDS.fullName}
                maxLength={100}
                onChange={(event) => {
                  setFullName(event.target.value);
                  clearFieldError("fullName");
                }}
                required
                value={fullName}
              />
              {errors.fullName ? (
                <span
                  className="field-error"
                  id="application-full-name-error"
                >
                  {errors.fullName}
                </span>
              ) : null}
            </div>

            <div className="field">
              <label className="field-label" htmlFor={FIELD_IDS.email}>
                Email address
              </label>
              <input
                aria-describedby={
                  errors.email ? "application-email-error" : undefined
                }
                aria-invalid={Boolean(errors.email)}
                autoComplete="email"
                className="input"
                id={FIELD_IDS.email}
                maxLength={160}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFieldError("email");
                }}
                required
                type="email"
                value={email}
              />
              {errors.email ? (
                <span className="field-error" id="application-email-error">
                  {errors.email}
                </span>
              ) : null}
            </div>

            <div className="field">
              <label className="field-label" htmlFor={FIELD_IDS.mobile}>
                Mobile number
              </label>
              <input
                aria-describedby={
                  errors.mobile
                    ? "application-mobile-hint application-mobile-error"
                    : "application-mobile-hint"
                }
                aria-invalid={Boolean(errors.mobile)}
                autoComplete="tel"
                className="input"
                id={FIELD_IDS.mobile}
                inputMode="tel"
                maxLength={20}
                onChange={(event) => {
                  setMobile(event.target.value);
                  clearFieldError("mobile");
                }}
                placeholder="0917 123 4567"
                required
                type="tel"
                value={mobile}
              />
              <span className="field-hint" id="application-mobile-hint">
                Use a Philippine mobile number.
              </span>
              {errors.mobile ? (
                <span className="field-error" id="application-mobile-error">
                  {errors.mobile}
                </span>
              ) : null}
            </div>
          </div>

          <div className="notice application-privacy-note">
            <ShieldCheck size={20} aria-hidden="true" />
            <p>
              Your contact information is shared only when you submit this
              application.
            </p>
          </div>

          <div className="application-actions">
            <button
              className="button button--secondary"
              onClick={saveDraft}
              type="button"
            >
              <Save size={18} aria-hidden="true" /> Save draft
            </button>
            <button className="button button--primary" type="submit">
              Continue to resume
            </button>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <form
          className="application-step-panel content-card"
          noValidate
          onSubmit={continueFromResume}
        >
          <header className="application-step-panel__header">
            <span className="icon-tile icon-tile--soft">
              <FileText size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="kicker">Step 2 of 3</p>
              <h2 ref={stepHeadingRef} tabIndex={-1}>
                Add your resume and message
              </h2>
              <p>Choose the resume that best supports this application.</p>
            </div>
          </header>

          <label
            className={[
              "file-field",
              errors.resume ? "file-field--error" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            htmlFor={FIELD_IDS.resume}
          >
            {resumeFile ? (
              <FileCheck2 size={22} aria-hidden="true" />
            ) : (
              <FileText size={22} aria-hidden="true" />
            )}
            <span>
              <strong>
                {resumeFile ? resumeFile.name : "Choose your resume"}
              </strong>
              {resumeFile
                ? `${formatFileSize(resumeFile.size)} · Ready to attach`
                : "PDF, DOC, or DOCX · 5 MB maximum"}
            </span>
            <input
              accept=".pdf,.doc,.docx"
              aria-describedby={
                errors.resume
                  ? "application-resume-hint application-resume-error"
                  : "application-resume-hint"
              }
              aria-invalid={Boolean(errors.resume)}
              id={FIELD_IDS.resume}
              onChange={handleResumeChange}
              required
              type="file"
            />
          </label>
          <p className="field-hint" id="application-resume-hint">
            {savedResumeName && !resumeFile
              ? `Your draft previously used ${savedResumeName}. Choose it again because browsers do not retain file attachments.`
              : "The selected file stays in this browser until you submit or leave the page."}
          </p>
          {errors.resume ? (
            <p className="field-error" id="application-resume-error">
              {errors.resume}
            </p>
          ) : null}

          <div className="field">
            <label className="field-label" htmlFor={FIELD_IDS.message}>
              Message to employer
            </label>
            <textarea
              aria-describedby={
                errors.message
                  ? "application-message-count application-message-error"
                  : "application-message-count"
              }
              aria-invalid={Boolean(errors.message)}
              className="textarea"
              id={FIELD_IDS.message}
              maxLength={MAX_MESSAGE_LENGTH + 100}
              onChange={(event) => {
                setMessage(event.target.value);
                clearFieldError("message");
              }}
              placeholder="Briefly explain your interest and the skills you would bring to this role."
              rows={6}
              value={message}
            />
            <span className="field-hint" id="application-message-count">
              {message.length.toLocaleString()} /{" "}
              {MAX_MESSAGE_LENGTH.toLocaleString()} characters
            </span>
            {errors.message ? (
              <span className="field-error" id="application-message-error">
                {errors.message}
              </span>
            ) : null}
          </div>

          <div className="application-actions application-actions--split">
            <button
              className="button button--ghost"
              onClick={() => goToStep(1)}
              type="button"
            >
              <ArrowLeft size={18} aria-hidden="true" /> Back
            </button>
            <button
              className="button button--secondary"
              onClick={saveDraft}
              type="button"
            >
              <Save size={18} aria-hidden="true" /> Save draft
            </button>
            <button className="button button--primary" type="submit">
              Review application
            </button>
          </div>
        </form>
      ) : null}

      {step === 3 ? (
        <form
          className="application-step-panel content-card"
          noValidate
          onSubmit={submitApplication}
        >
          <header className="application-step-panel__header">
            <span className="icon-tile icon-tile--soft">
              <CheckCircle2 size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="kicker">Step 3 of 3</p>
              <h2 ref={stepHeadingRef} tabIndex={-1}>
                Review your application
              </h2>
              <p>Check everything below before sending it to the employer.</p>
            </div>
          </header>

          <div className="application-review">
            <section
              aria-labelledby="review-applicant-heading"
              className="application-review__section"
            >
              <div className="application-review__header">
                <h3 id="review-applicant-heading">Applicant information</h3>
                <button
                  className="button button--ghost"
                  onClick={() => goToStep(1)}
                  type="button"
                >
                  Edit
                </button>
              </div>
              <dl className="application-review__details">
                <div>
                  <dt>Full name</dt>
                  <dd>{fullName.trim()}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{email.trim()}</dd>
                </div>
                <div>
                  <dt>Mobile</dt>
                  <dd>{mobile.trim()}</dd>
                </div>
              </dl>
            </section>

            <section
              aria-labelledby="review-resume-heading"
              className="application-review__section"
            >
              <div className="application-review__header">
                <h3 id="review-resume-heading">Resume and message</h3>
                <button
                  className="button button--ghost"
                  onClick={() => goToStep(2)}
                  type="button"
                >
                  Edit
                </button>
              </div>
              <div className="application-review__resume">
                <FileCheck2 size={20} aria-hidden="true" />
                <span>
                  <strong>{resumeFile?.name}</strong>
                  {resumeFile ? formatFileSize(resumeFile.size) : null}
                </span>
              </div>
              <div className="application-review__message">
                <strong>Message to employer</strong>
                <p>
                  {message.trim() ||
                    "No optional message will be included."}
                </p>
              </div>
            </section>

            <section
              aria-labelledby="review-job-heading"
              className="application-review__section application-review__section--soft"
            >
              <h3 id="review-job-heading">Applying for</h3>
              <p>
                <strong>{job.title}</strong>
                <span>
                  {job.employerName} · {job.location.barangay},{" "}
                  {job.location.city}
                </span>
              </p>
            </section>
          </div>

          <label
            className={[
              "application-confirmation-check",
              errors.confirmation ? "is-invalid" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            htmlFor={FIELD_IDS.confirmation}
          >
            <input
              aria-describedby={
                errors.confirmation
                  ? "application-confirmation-error"
                  : undefined
              }
              aria-invalid={Boolean(errors.confirmation)}
              checked={confirmed}
              id={FIELD_IDS.confirmation}
              onChange={(event) => {
                setConfirmed(event.target.checked);
                clearFieldError("confirmation");
              }}
              type="checkbox"
            />
            <span>
              I confirm that these details are accurate and I consent to
              sharing them with {job.employerName} for this application.
            </span>
          </label>
          {errors.confirmation ? (
            <p className="field-error" id="application-confirmation-error">
              {errors.confirmation}
            </p>
          ) : null}

          {submissionStorageError ? (
            <div className="notice notice--warning" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              <p>{submissionStorageError}</p>
            </div>
          ) : null}

          <div className="application-actions application-actions--split">
            <button
              className="button button--ghost"
              onClick={() => goToStep(2)}
              type="button"
            >
              <ArrowLeft size={18} aria-hidden="true" /> Back
            </button>
            <button
              className="button button--secondary"
              onClick={saveDraft}
              type="button"
            >
              <Save size={18} aria-hidden="true" /> Save draft
            </button>
            <button
              aria-describedby={
                !isOnline ? "application-offline-status" : undefined
              }
              className="button button--primary"
              disabled={!isOnline}
              type="submit"
            >
              <Send size={18} aria-hidden="true" /> Submit application
            </button>
          </div>
        </form>
      ) : null}

      <p
        aria-live="polite"
        className="application-draft-status"
        id={draftStatusId}
        role="status"
      >
        {draftStatus}
      </p>
    </section>
  );
}

const handoffIcons = {
  "external-url": ExternalLink,
  email: Mail,
  phone: Phone,
  "in-person": MapPin,
} as const;

export function ApplicationPage() {
  const { jobId = "" } = useParams();
  const job = getJobById(jobId);

  if (!job) {
    return (
      <section className="empty-state">
        <h1>Application unavailable</h1>
        <Link className="button button--primary" to="/jobs">
          Browse jobs
        </Link>
      </section>
    );
  }

  if (job.closingAt && Date.parse(job.closingAt) < Date.now()) {
    return (
      <section className="empty-state">
        <ArchiveX size={28} aria-hidden="true" />
        <h1>This application has closed</h1>
        <p>
          The deadline for {job.title} has passed. Browse current jobs to find
          another opportunity.
        </p>
        <Link className="button button--primary" to="/jobs">
          Browse open jobs
        </Link>
      </section>
    );
  }

  const method = job.source.applicationMethod;
  const target = job.source.applicationTarget;
  const targetIsSafe = isSafeTarget(method, target);

  return (
    <div className="page page--narrow application-page">
      <Link className="back-link" to={`/jobs/${job.id}`}>
        <ArrowLeft size={18} aria-hidden="true" /> Back to job details
      </Link>

      <header className="page-header">
        <span className="eyebrow">
          <FileText size={16} aria-hidden="true" />
          Protected application
        </span>
        <h1>Apply for {job.title}</h1>
        <p>
          {job.employerName} · {job.location.barangay}, {job.location.city}
        </p>
      </header>

      {method === "jobfinder" ? (
        <NativeApplicationFlow job={job} key={job.id} />
      ) : (
        <section className="handoff-card">
          {(() => {
            const Icon = handoffIcons[method];
            return (
              <span className="icon-tile">
                <Icon size={24} aria-hidden="true" />
              </span>
            );
          })()}
          <p className="kicker">Original application channel</p>
          <h2>Continue by {applicationMethodLabel(method).toLowerCase()}</h2>
          <p>
            JobFinder keeps the method supplied by the original listing. It
            does not replace a PESO/LGU or employer application channel.
          </p>
          <div className="handoff-instructions">
            <strong>Source instructions</strong>
            <p>
              {job.source.applicationInstructions ??
                "Confirm the current instructions with the source."}
            </p>
            {target ? <code>{target}</code> : null}
          </div>

          {targetIsSafe && method === "email" && target ? (
            <a
              className="button button--primary"
              href={`mailto:${target}?subject=${encodeURIComponent(
                `Application for ${job.title}`,
              )}`}
            >
              <Mail size={18} aria-hidden="true" /> Open email application
            </a>
          ) : null}
          {targetIsSafe && method === "phone" && target ? (
            <a className="button button--primary" href={`tel:${target}`}>
              <Phone size={18} aria-hidden="true" /> Call listed contact
            </a>
          ) : null}
          {targetIsSafe && method === "external-url" && target ? (
            <a
              className="button button--primary"
              href={target}
              rel="noreferrer noopener"
              target="_blank"
            >
              <ExternalLink size={18} aria-hidden="true" />
              Continue to employer website
            </a>
          ) : null}
          {targetIsSafe && method === "in-person" ? (
            <div className="notice">
              <MapPin size={20} aria-hidden="true" />
              <p>{job.source.applicationInstructions}</p>
            </div>
          ) : null}
          {!targetIsSafe ? (
            <div className="notice notice--warning" role="alert">
              <Info size={20} aria-hidden="true" />
              <p>
                This source does not currently provide a safe, usable
                application target. Confirm the vacancy with the listed
                organization before sharing personal information.
              </p>
            </div>
          ) : null}

          {job.source.alternateApplicationMethods?.length ? (
            <div className="alternate-methods">
              <h3>Alternative in the source record</h3>
              {job.source.alternateApplicationMethods.map((alternative) => (
                <div key={`${alternative.method}-${alternative.target}`}>
                  <strong>
                    {applicationMethodLabel(alternative.method)} ·{" "}
                    {alternative.target}
                  </strong>
                  <p>{alternative.instructions}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      )}

      <SourceProvenance source={job.source} compact />
    </div>
  );
}
