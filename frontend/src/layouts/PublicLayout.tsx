import {
  Bookmark,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Home,
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
import { Link, Outlet, useLocation } from "react-router-dom";
import { SiteFooter } from "../components/SiteFooter";
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
    label: "Search Jobs",
    mobileLabel: "Search",
    icon: Search,
  },
  {
    to: "/saved",
    label: "Saved Jobs",
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
    label: "Job Posts",
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
    label: "Public Jobs",
    mobileLabel: "Jobs",
    icon: Search,
  },
];

function topNavClass(isActive: boolean) {
  return `top-nav-link${isActive ? " is-active" : ""}`;
}

function railClass(isActive: boolean) {
  return `rail-link${isActive ? " is-active" : ""}`;
}

function mobileClass(isActive: boolean) {
  return `mobile-nav-link${isActive ? " is-active" : ""}`;
}

function isPublicJobRoute(pathname: string) {
  return (
    pathname === "/jobs" ||
    /^\/jobs\/[^/]+(?:\/route)?\/?$/.test(pathname)
  );
}

function isNavigationItemActive(
  item: NavigationItem,
  pathname: string,
  role: AuthUser["role"],
) {
  if (item.to === "/") {
    return pathname === "/";
  }

  if (item.to === "/jobs") {
    return isPublicJobRoute(pathname);
  }

  if (role === "employer") {
    if (item.to === "/employer") {
      return pathname === "/employer";
    }

    if (item.to === "/employer/posts") {
      return (
        pathname === "/employer/posts" ||
        pathname === "/employer/posts/new"
      );
    }

    if (item.to === "/employer/candidates") {
      return (
        pathname === "/employer/candidates" ||
        /^\/employer\/posts\/[^/]+\/candidates\/?$/.test(pathname)
      );
    }

    return pathname === item.to;
  }

  if (item.to === "/applications") {
    return (
      pathname === "/applications" ||
      /^\/jobs\/[^/]+\/apply\/?$/.test(pathname)
    );
  }

  if (item.to === "/profile") {
    return (
      pathname === "/profile" ||
      pathname === "/preferences" ||
      pathname.startsWith("/onboarding/")
    );
  }

  return pathname === item.to;
}

function getPageTitle(pathname: string) {
  if (pathname === "/") return "Home";
  if (pathname === "/jobs") return "Search Jobs";
  if (pathname.endsWith("/route")) return "Route Preview";
  if (pathname.endsWith("/apply")) return "Application";
  if (pathname.startsWith("/jobs/")) return "Job Details";
  if (pathname === "/saved") return "Saved Jobs";
  if (pathname === "/applications") return "Applications";
  if (pathname === "/profile") return "Profile";
  if (pathname === "/preferences") return "Preferences";
  if (pathname === "/onboarding/profile") return "Profile Setup";
  if (pathname === "/onboarding/skills") return "Skills Setup";
  if (pathname === "/about/data-sources") return "Data Sources";
  if (pathname.startsWith("/employer/posts/") && pathname.endsWith("/candidates")) {
    return "Candidate Matches";
  }
  if (pathname.startsWith("/employer/candidates")) return "Candidate Matches";
  if (pathname.startsWith("/employer/company")) return "Company Profile";
  if (pathname.startsWith("/employer/posts")) return "Job Posts";
  if (pathname.startsWith("/employer")) return "Employer Overview";
  return "Page Not Found";
}

function Brand({
  compact = false,
  context = "Public Job Browser",
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
  pathname,
  user,
  onSignOut,
}: {
  isGuest: boolean;
  items: NavigationItem[];
  pathname: string;
  user: AuthUser | null;
  onSignOut(): void;
}) {
  const context =
    user?.role === "employer"
      ? "Employer Workspace"
      : isGuest
        ? "Public Job Browser"
        : "Job Seeker Workspace";

  return (
    <header className="desktop-top-nav">
      <div className="desktop-top-nav__inner">
        <Brand context={context} />

        <nav className="top-nav-links" aria-label="Primary navigation">
          {items.map((item) => {
            const gatedForGuest = isGuest && item.gated;
            const isActive = isNavigationItemActive(
              item,
              pathname,
              user?.role ?? "job-seeker",
            );

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={topNavClass(isActive)}
                key={item.to}
                to={item.to}
                aria-label={
                  gatedForGuest
                    ? `${item.label}, sign in required`
                    : item.label
                }
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="desktop-account">
          {isGuest ? (
            <>
              <span className="desktop-account__status">Browsing as Guest</span>
              <Link className="top-nav-auth" to="/sign-in">
                Sign In
              </Link>
            </>
          ) : (
            <>
              <span className="desktop-account__user">
                <span>{user?.displayName}</span>
                <small>
                  {user?.role === "employer"
                    ? "Employer Team"
                    : "Job Seeker Account"}
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
  onSignOut,
  pathname,
  user,
}: {
  isGuest: boolean;
  items: NavigationItem[];
  onSignOut(): void;
  pathname: string;
  user: AuthUser | null;
}) {
  return (
    <aside className="tablet-rail" aria-label="Primary navigation">
      <Brand compact />
      <nav className="rail-nav">
        {items.map((item) => {
          const Icon = item.icon;
          const gatedForGuest = isGuest && item.gated;
          const isActive = isNavigationItemActive(
            item,
            pathname,
            user?.role ?? "job-seeker",
          );

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={railClass(isActive)}
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
            </Link>
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
      {!isGuest ? (
        <button
          aria-label="Sign out"
          className="rail-user rail-sign-out"
          onClick={onSignOut}
          title="Sign out"
          type="button"
        >
          <LogOut aria-hidden="true" />
        </button>
      ) : null}
    </aside>
  );
}

function MobileChrome({
  isGuest,
  items,
  onSignOut,
  pathname,
  user,
}: {
  isGuest: boolean;
  items: NavigationItem[];
  onSignOut(): void;
  pathname: string;
  user: AuthUser | null;
}) {
  const context =
    user?.role === "employer"
      ? "Employer Workspace"
      : isGuest
        ? "Public Job Browser"
        : "Job Seeker Workspace";

  return (
    <>
      <header className="mobile-header">
        <Brand context={context} />
        <div className="mobile-account-actions">
          <Link
            className="mobile-auth-link"
            to={isGuest ? "/sign-in" : user?.role === "employer" ? "/employer" : "/profile"}
          >
            {isGuest ? "Sign In" : "Account"}
          </Link>
          {!isGuest ? (
            <button
              aria-label="Sign out"
              className="mobile-auth-link mobile-sign-out"
              onClick={onSignOut}
              title="Sign out"
              type="button"
            >
              <LogOut aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </header>

      <nav className="mobile-bottom-nav" aria-label="Primary navigation">
        <ul
          className="mobile-nav-list"
          style={{ "--mobile-nav-count": items.length } as CSSProperties}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const gatedForGuest = isGuest && item.gated;
            const isActive = isNavigationItemActive(
              item,
              pathname,
              user?.role ?? "job-seeker",
            );

            return (
              <li key={item.to}>
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={mobileClass(isActive)}
                  to={item.to}
                  aria-label={
                    gatedForGuest
                      ? `${item.label}, sign in required`
                      : item.label
                  }
                >
                  <Icon aria-hidden="true" />
                  <span>{item.mobileLabel ?? item.label}</span>
                </Link>
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
    pathname === "/sign-in" ||
    pathname === "/register" ||
    pathname.startsWith("/onboarding/") ||
    pathname.endsWith("/apply");
  useEffect(() => {
    document.title = `${getPageTitle(pathname)} | JobFinder`;
    window.scrollTo({ top: 0, behavior: "auto" });

    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }

    window.requestAnimationFrame(() =>
      mainRef.current?.focus({ preventScroll: true }),
    );
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
        pathname={pathname}
        user={user}
      />
      <TabletRail
        isGuest={isGuest}
        items={items}
        onSignOut={signOut}
        pathname={pathname}
        user={user}
      />
      <MobileChrome
        isGuest={isGuest}
        items={items}
        onSignOut={signOut}
        pathname={pathname}
        user={user}
      />

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
      <SiteFooter />
    </div>
  );
}

export default PublicLayout;
