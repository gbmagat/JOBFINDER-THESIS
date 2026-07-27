import {
  Bookmark,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Home,
  LockKeyhole,
  LogIn,
  LogOut,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  type CSSProperties,
  useEffect,
  useRef,
} from "react";
import type { LucideIcon } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth, type AuthUser } from "../features/auth/AuthContext";

type NavigationItem = {
  to: string;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
  gated?: boolean;
  end?: boolean;
};

const jobSeekerNavigation: NavigationItem[] = [
  { to: "/", label: "Home", icon: Home, end: true },
  {
    to: "/jobs",
    label: "Search jobs",
    mobileLabel: "Search",
    icon: Search,
  },
  {
    to: "/saved",
    label: "Saved jobs",
    mobileLabel: "Saved",
    icon: Bookmark,
    gated: true,
  },
  {
    to: "/applications",
    label: "Applications",
    mobileLabel: "Apps",
    icon: ClipboardList,
    gated: true,
  },
  { to: "/profile", label: "Profile", icon: UserRound, gated: true },
];

const employerNavigation: NavigationItem[] = [
  {
    to: "/employer",
    label: "Overview",
    mobileLabel: "Overview",
    icon: Home,
    end: true,
  },
  {
    to: "/employer/posts",
    label: "Job posts",
    mobileLabel: "Posts",
    icon: BriefcaseBusiness,
  },
  {
    to: "/employer/candidates",
    label: "Candidates",
    mobileLabel: "Candidates",
    icon: UsersRound,
  },
  {
    to: "/employer/company",
    label: "Company",
    mobileLabel: "Company",
    icon: Building2,
  },
  {
    to: "/jobs",
    label: "Public jobs",
    mobileLabel: "Jobs",
    icon: Search,
  },
];

function topNavClass({ isActive }: { isActive: boolean }) {
  return `top-nav-link${isActive ? " is-active" : ""}`;
}

function railClass({ isActive }: { isActive: boolean }) {
  return `rail-link${isActive ? " is-active" : ""}`;
}

function mobileClass({ isActive }: { isActive: boolean }) {
  return `mobile-nav-link${isActive ? " is-active" : ""}`;
}

function Brand({
  compact = false,
  context = "Public job browser",
}: {
  compact?: boolean;
  context?: string;
}) {
  if (compact) {
    return (
      <Link className="rail-brand" to="/" aria-label="JobFinder home">
        <span className="brand-mark" aria-hidden="true">
          JF
        </span>
      </Link>
    );
  }

  return (
    <Link className="brand" to="/" aria-label="JobFinder home">
      <span className="brand-mark" aria-hidden="true">
        JF
      </span>
      <span className="brand-copy">
        <span className="brand-name">JobFinder</span>
        <span className="brand-context">{context}</span>
      </span>
    </Link>
  );
}

function DesktopTopNavigation({
  isGuest,
  items,
  user,
  onSignOut,
}: {
  isGuest: boolean;
  items: NavigationItem[];
  user: AuthUser | null;
  onSignOut(): void;
}) {
  const context =
    user?.role === "employer"
      ? "Employer workspace"
      : isGuest
        ? "Public job browser"
        : "Job seeker workspace";

  return (
    <header className="desktop-top-nav">
      <div className="desktop-top-nav__inner">
        <Brand context={context} />

        <nav className="top-nav-links" aria-label="Primary navigation">
          {items.map((item) => {
            const gatedForGuest = isGuest && item.gated;

            return (
              <NavLink
                className={topNavClass}
                end={item.end}
                key={item.to}
                to={item.to}
                aria-label={
                  gatedForGuest
                    ? `${item.label}, sign in required`
                    : item.label
                }
              >
                <span>{item.label}</span>
                {gatedForGuest ? (
                  <LockKeyhole aria-hidden="true" />
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="desktop-account">
          {isGuest ? (
            <>
              <span className="desktop-account__status">Browsing as guest</span>
              <Link className="top-nav-auth" to="/sign-in">
                <LogIn aria-hidden="true" />
                Sign in
              </Link>
            </>
          ) : (
            <>
              <span className="desktop-account__user">
                <span>{user?.displayName}</span>
                <small>
                  {user?.role === "employer"
                    ? "Employer team"
                    : "Job seeker account"}
                </small>
              </span>
              <button
                aria-label="Sign out"
                className="top-nav-sign-out"
                onClick={onSignOut}
                title="Sign out"
                type="button"
              >
                <LogOut aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function TabletRail({
  isGuest,
  items,
  user,
}: {
  isGuest: boolean;
  items: NavigationItem[];
  user: AuthUser | null;
}) {
  return (
    <aside className="tablet-rail" aria-label="Primary navigation">
      <Brand compact />
      <nav className="rail-nav">
        {items.map((item) => {
          const Icon = item.icon;
          const gatedForGuest = isGuest && item.gated;

          return (
            <NavLink
              className={railClass}
              end={item.end}
              key={item.to}
              title={
                gatedForGuest ? `${item.label} · Sign in required` : item.label
              }
              to={item.to}
              aria-label={
                gatedForGuest
                  ? `${item.label}, sign in required`
                  : item.label
              }
            >
              <Icon aria-hidden="true" />
              <span>{item.mobileLabel ?? item.label}</span>
              {gatedForGuest ? (
                <LockKeyhole className="rail-lock" aria-hidden="true" />
              ) : null}
            </NavLink>
          );
        })}
      </nav>
      <Link
        className="rail-user"
        to={
          isGuest ? "/sign-in" : user?.role === "employer" ? "/employer" : "/profile"
        }
        title={
          isGuest
            ? "Browsing as guest · Sign in"
            : user?.role === "employer"
              ? "Open employer overview"
              : "Open profile"
        }
        aria-label={
          isGuest
            ? "Browsing as guest, sign in"
            : user?.role === "employer"
              ? "Open employer overview"
              : "Open profile"
        }
      >
        <UserRound aria-hidden="true" />
      </Link>
    </aside>
  );
}

function MobileChrome({
  isGuest,
  items,
  user,
}: {
  isGuest: boolean;
  items: NavigationItem[];
  user: AuthUser | null;
}) {
  const context =
    user?.role === "employer" ? "Employer workspace" : "Job seeker workspace";

  return (
    <>
      <header className="mobile-header">
        <Brand context={context} />
        <Link
          className="mobile-auth-link"
          to={isGuest ? "/sign-in" : user?.role === "employer" ? "/employer" : "/profile"}
        >
          {isGuest ? "Sign in" : "Account"}
        </Link>
      </header>

      <nav className="mobile-bottom-nav" aria-label="Primary navigation">
        <ul
          className="mobile-nav-list"
          style={{ "--mobile-nav-count": items.length } as CSSProperties}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const gatedForGuest = isGuest && item.gated;

            return (
              <li key={item.to}>
                <NavLink
                  className={mobileClass}
                  end={item.end}
                  to={item.to}
                  aria-label={
                    gatedForGuest
                      ? `${item.label}, sign in required`
                      : item.label
                  }
                >
                  <Icon aria-hidden="true" />
                  <span>{item.mobileLabel ?? item.label}</span>
                  {gatedForGuest ? (
                    <LockKeyhole
                      className="mobile-lock-dot"
                      aria-hidden="true"
                    />
                  ) : null}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function PublicLayout() {
  const { signOut, user } = useAuth();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRoute = useRef(true);
  const isGuest = !user;
  const items =
    user?.role === "employer" ? employerNavigation : jobSeekerNavigation;
  const isFocusedFlow =
    pathname.startsWith("/onboarding/") || pathname.endsWith("/apply");

  useEffect(() => {
    const title =
      pathname === "/"
        ? "Home"
        : pathname.startsWith("/jobs/") && pathname.endsWith("/route")
          ? "Route preview"
          : pathname.startsWith("/jobs/") && pathname.endsWith("/apply")
            ? "Application"
            : pathname.startsWith("/jobs/")
              ? "Job details"
              : pathname === "/jobs"
                ? "Search jobs"
                : pathname === "/saved"
                  ? "Saved jobs"
                  : pathname === "/applications"
                    ? "Applications"
                    : pathname === "/profile"
                      ? "Profile"
                      : pathname === "/preferences"
                        ? "Preferences"
                        : pathname.startsWith("/employer/candidates")
                          ? "Candidate matches"
                          : pathname.startsWith("/employer/company")
                            ? "Company profile"
                            : pathname.startsWith("/employer/posts")
                              ? "Job posts"
                              : pathname.startsWith("/employer")
                                ? "Employer overview"
                                : "JobFinder";

    document.title = `${title} | JobFinder`;
    window.scrollTo({ top: 0, behavior: "auto" });

    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }

    window.requestAnimationFrame(() => mainRef.current?.focus());
  }, [pathname]);

  return (
    <div
      className={`app-shell${isFocusedFlow ? " app-shell--focused" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <DesktopTopNavigation
        isGuest={isGuest}
        items={items}
        onSignOut={signOut}
        user={user}
      />
      <TabletRail isGuest={isGuest} items={items} user={user} />
      <MobileChrome isGuest={isGuest} items={items} user={user} />

      <main
        className="app-main"
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
      >
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default PublicLayout;
