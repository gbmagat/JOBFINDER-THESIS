import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Lightbulb,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import {
  consumeApplyIntent,
  getApplyResumePath,
  readApplyIntent,
  sanitizeReturnTo,
} from "../features/auth/auth-intent";
import {
  DEFAULT_PROFILE_SKILLS,
  PROFILE_SKILLS_KEY,
} from "../features/profile/storage";
import { usePersistentState } from "../lib/usePersistentState";
import { userStorageKey } from "../lib/storage-keys";

const MAX_SKILLS = 10;

const SKILL_OPTIONS = [
  { name: "Customer service", detail: "Standard skill" },
  { name: "Technical support", detail: "Related skill" },
  { name: "Help desk support", detail: "Related skill" },
  { name: "Java", detail: "Programming skill" },
  { name: "Troubleshooting", detail: "Technical skill" },
  { name: "Windows", detail: "Operating system skill" },
  { name: "Communication", detail: "Transferable skill" },
  { name: "Computer networking", detail: "Technical skill" },
  { name: "Hardware maintenance", detail: "Technical skill" },
  { name: "Microsoft Office", detail: "Productivity skill" },
] as const;

const SUGGESTED_SKILLS = [
  "Customer service",
  "Technical support",
  "Help desk support",
];

function normalizeSkill(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 48);
}

function skillKey(value: string) {
  return normalizeSkill(value).toLocaleLowerCase();
}

export function SkillsSetupPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pendingIntent = useMemo(() => readApplyIntent(), []);
  const returnTo = sanitizeReturnTo(
    searchParams.get("returnTo"),
    pendingIntent?.returnTo,
  );
  const profileSearch = new URLSearchParams({ returnTo });

  const [selectedSkills, setSelectedSkills] = usePersistentState<string[]>(
    userStorageKey(PROFILE_SKILLS_KEY, user?.id),
    DEFAULT_PROFILE_SKILLS,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [matchingInfoOpen, setMatchingInfoOpen] = useState(false);
  const [status, setStatus] = useState("");

  const selectedKeys = useMemo(
    () => new Set(selectedSkills.map(skillKey)),
    [selectedSkills],
  );
  const normalizedQuery = normalizeSkill(query);
  const visibleOptions = useMemo(() => {
    const queryKey = skillKey(query);
    const options = queryKey
      ? SKILL_OPTIONS.filter(({ name, detail }) =>
          `${name} ${detail}`.toLocaleLowerCase().includes(queryKey),
        )
      : SKILL_OPTIONS.slice(0, 6);

    return options.slice(0, 6);
  }, [query]);
  const canAddCustomSkill =
    normalizedQuery.length >= 2 &&
    !SKILL_OPTIONS.some(({ name }) => skillKey(name) === skillKey(query)) &&
    !selectedKeys.has(skillKey(query));

  function addSkill(value: string) {
    const skill = normalizeSkill(value);

    if (!skill || selectedKeys.has(skillKey(skill))) {
      return;
    }

    if (selectedSkills.length >= MAX_SKILLS) {
      setStatus(`You can add up to ${MAX_SKILLS} skills.`);
      return;
    }

    setSelectedSkills((current) => [...current, skill]);
    setStatus(`${skill} added.`);
  }

  function removeSkill(value: string) {
    setSelectedSkills((current) =>
      current.filter((skill) => skillKey(skill) !== skillKey(value)),
    );
    setStatus(`${value} removed.`);
  }

  function handleCustomSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canAddCustomSkill) {
      return;
    }

    addSkill(normalizedQuery);
    setQuery("");
  }

  function handleComplete() {
    const intent = consumeApplyIntent();

    if (intent) {
      navigate(getApplyResumePath(intent), { replace: true });
      return;
    }

    navigate(returnTo, { replace: true });
  }

  if (searchOpen) {
    return (
      <div className="page page--narrow onboarding-page onboarding-page--search">
        <div className="onboarding-shell skill-search-view">
          <header className="skill-search-topbar">
            <button
              aria-label="Back to selected skills"
              className="back-link"
              onClick={() => {
                setSearchOpen(false);
                setQuery("");
              }}
              type="button"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <div>
              <strong>Add a skill</strong>
              <span>{selectedSkills.length} selected</span>
            </div>
          </header>

          <form className="skill-search-form" onSubmit={handleCustomSubmit}>
            <label className="search-input-wrap">
              <Search size={19} aria-hidden="true" />
              <span className="sr-only">Search skills</span>
              <input
                autoFocus
                className="input"
                maxLength={48}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search skills"
                type="search"
                value={query}
              />
            </label>
          </form>

          <div className="skill-results-heading">
            <div>
              <p className="kicker">
                {normalizedQuery ? "Best matches" : "Popular skills"}
              </p>
              <h1>
                {normalizedQuery
                  ? `Results for “${normalizedQuery}”`
                  : "Choose a skill"}
              </h1>
            </div>
            <span>{visibleOptions.length} results</span>
          </div>

          <div aria-label="Skill search results" className="skill-results">
            {visibleOptions.map(({ name, detail }) => {
              const selected = selectedKeys.has(skillKey(name));

              return (
                <button
                  aria-pressed={selected}
                  className="skill-result"
                  disabled={selected}
                  key={name}
                  onClick={() => addSkill(name)}
                  type="button"
                >
                  <span className="skill-result__copy">
                    <strong>{name}</strong>
                    <small>{selected ? "Selected" : detail}</small>
                  </span>
                  <span
                    aria-hidden="true"
                    className="skill-result__action"
                  >
                    {selected ? <Check size={18} /> : <Plus size={18} />}
                  </span>
                </button>
              );
            })}

            {!visibleOptions.length ? (
              <div className="skill-results__empty">
                <Search size={22} aria-hidden="true" />
                <p>No standard skills match this search yet.</p>
              </div>
            ) : null}
          </div>

          {canAddCustomSkill ? (
            <button
              className="skill-custom-action"
              onClick={() => {
                addSkill(normalizedQuery);
                setQuery("");
              }}
              type="button"
            >
              <Plus size={18} aria-hidden="true" />
              Add “{normalizedQuery}” as a custom skill
            </button>
          ) : null}

          <p aria-live="polite" className="onboarding-status">
            {status}
          </p>

          <div className="skill-search-footer">
            <button
              className="button button--primary button--block"
              onClick={() => {
                setSearchOpen(false);
                setQuery("");
              }}
              type="button"
            >
              Done · {selectedSkills.length} selected
            </button>
          </div>
        </div>
      </div>
    );
  }

  const availableSuggestions = SUGGESTED_SKILLS.filter(
    (skill) => !selectedKeys.has(skillKey(skill)),
  );

  return (
    <div className="page page--narrow onboarding-page onboarding-page--skills">
      <div className="onboarding-shell">
        <header className="onboarding-topbar">
          <Link
            aria-label="Back to personal details"
            className="back-link onboarding-topbar__back"
            to={`/onboarding/profile?${profileSearch.toString()}`}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div className="onboarding-topbar__copy">
            <strong>Profile setup</strong>
            <span>2 of 2</span>
          </div>
          <div
            aria-label="Profile setup progress: step 2 of 2"
            className="onboarding-progress"
            role="progressbar"
            aria-valuemax={2}
            aria-valuemin={1}
            aria-valuenow={2}
          >
            <span className="is-active" />
            <span className="is-active" />
          </div>
        </header>

        <div className="onboarding-intro">
          <h1>Add your skills</h1>
          <p>Skills help explain why a job matches you.</p>
        </div>

        <section
          aria-labelledby="selected-skills-heading"
          className="skills-summary"
        >
          <div className="skills-summary__header">
            <h2 id="selected-skills-heading">Your skills</h2>
            <span>{selectedSkills.length} added</span>
          </div>

          {selectedSkills.length ? (
            <div className="skill-chip-list">
              {selectedSkills.map((skill) => (
                <span className="skill-chip" key={skill}>
                  <span>{skill}</span>
                  <button
                    aria-label={`Remove ${skill}`}
                    className="skill-chip__remove"
                    onClick={() => removeSkill(skill)}
                    type="button"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="skills-summary__empty">
              Add at least one skill to improve your recommendations.
            </p>
          )}
        </section>

        <button
          className="skill-search-entry"
          onClick={() => {
            setSearchOpen(true);
            setStatus("");
          }}
          type="button"
        >
          <span>
            <Search size={20} aria-hidden="true" />
            Search and add a skill
          </span>
          <ChevronRight size={21} aria-hidden="true" />
        </button>

        <section className="onboarding-disclosure">
          <button
            aria-expanded={suggestionsOpen}
            className="onboarding-disclosure__summary"
            onClick={() => setSuggestionsOpen((current) => !current)}
            type="button"
          >
            <span>
              <Lightbulb size={18} aria-hidden="true" />
              Suggested for you
            </span>
            <span>
              {availableSuggestions.length} skills
              {suggestionsOpen ? (
                <ChevronDown size={18} aria-hidden="true" />
              ) : (
                <ChevronRight size={18} aria-hidden="true" />
              )}
            </span>
          </button>
          {suggestionsOpen ? (
            <div className="onboarding-disclosure__content skill-suggestion-list">
              {availableSuggestions.length ? (
                availableSuggestions.map((skill) => (
                  <button
                    className="chip"
                    key={skill}
                    onClick={() => addSkill(skill)}
                    type="button"
                  >
                    <Plus size={15} aria-hidden="true" />
                    {skill}
                  </button>
                ))
              ) : (
                <p>You&apos;ve added all current suggestions.</p>
              )}
            </div>
          ) : null}
        </section>

        <section className="onboarding-disclosure onboarding-disclosure--plain">
          <button
            aria-expanded={matchingInfoOpen}
            className="onboarding-disclosure__summary"
            onClick={() => setMatchingInfoOpen((current) => !current)}
            type="button"
          >
            <span>
              <Info size={18} aria-hidden="true" />
              How matching uses your skills
            </span>
            {matchingInfoOpen ? (
              <ChevronDown size={18} aria-hidden="true" />
            ) : (
              <ChevronRight size={18} aria-hidden="true" />
            )}
          </button>
          {matchingInfoOpen ? (
            <div className="onboarding-disclosure__content skill-info">
              <p>
                JobFinder compares both exact and ontology-related skills. Your
                skill fit contributes 70% of the recommendation score, while
                geographic accessibility contributes 30%.
              </p>
            </div>
          ) : null}
        </section>

        <p aria-live="polite" className="onboarding-status">
          {status}
        </p>

        <div className="onboarding-actions">
          <button
            className="button button--primary button--block"
            disabled={!selectedSkills.length}
            onClick={handleComplete}
            type="button"
          >
            Save and complete profile
          </button>
        </div>
      </div>
    </div>
  );
}
