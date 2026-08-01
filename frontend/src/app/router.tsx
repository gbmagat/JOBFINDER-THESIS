import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { FooterOnlyLayout } from "../layouts/FooterOnlyLayout";
import { PublicLayout } from "../layouts/PublicLayout";

const AccountPage = lazy(() =>
  import("../pages/AccountPage").then((module) => ({
    default: module.AccountPage,
  })),
);
const ApplicationPage = lazy(() =>
  import("../pages/ApplicationPage").then((module) => ({
    default: module.ApplicationPage,
  })),
);
const CandidateMatchesPage = lazy(() =>
  import("../pages/CandidateMatchesPage").then((module) => ({
    default: module.CandidateMatchesPage,
  })),
);
const CompanyProfilePage = lazy(() =>
  import("../pages/CompanyProfilePage").then((module) => ({
    default: module.CompanyProfilePage,
  })),
);
const DataSourcesPage = lazy(() =>
  import("../pages/DataSourcesPage").then((module) => ({
    default: module.DataSourcesPage,
  })),
);
const EmployerPage = lazy(() =>
  import("../pages/EmployerPage").then((module) => ({
    default: module.EmployerPage,
  })),
);
const EmployerPostPage = lazy(() =>
  import("../pages/EmployerPostPage").then((module) => ({
    default: module.EmployerPostPage,
  })),
);
const EmployerPostsPage = lazy(() =>
  import("../pages/EmployerPostsPage").then((module) => ({
    default: module.EmployerPostsPage,
  })),
);
const HomePage = lazy(() =>
  import("../pages/HomePage").then((module) => ({
    default: module.HomePage,
  })),
);
const JobDetailPage = lazy(() =>
  import("../pages/JobDetailPage").then((module) => ({
    default: module.JobDetailPage,
  })),
);
const JobsPage = lazy(() =>
  import("../pages/JobsPage").then((module) => ({
    default: module.JobsPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("../pages/NotFoundPage").then((module) => ({
    default: module.NotFoundPage,
  })),
);
const ProfileSetupPage = lazy(() =>
  import("../pages/ProfileSetupPage").then((module) => ({
    default: module.ProfileSetupPage,
  })),
);
const RegisterPage = lazy(() =>
  import("../pages/RegisterPage").then((module) => ({
    default: module.RegisterPage,
  })),
);
const RoutePage = lazy(() =>
  import("../pages/RoutePage").then((module) => ({
    default: module.RoutePage,
  })),
);
const SignInPage = lazy(() =>
  import("../pages/SignInPage").then((module) => ({
    default: module.SignInPage,
  })),
);
const SkillsSetupPage = lazy(() =>
  import("../pages/SkillsSetupPage").then((module) => ({
    default: module.SkillsSetupPage,
  })),
);

const jobSeekerOnly = ["job-seeker"] as const;
const employerOnly = ["employer"] as const;

export const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "jobs", element: <JobsPage /> },
      { path: "jobs/:jobId", element: <JobDetailPage /> },
      { path: "jobs/:jobId/route", element: <RoutePage /> },
      { path: "about/data-sources", element: <DataSourcesPage /> },
      {
        element: <ProtectedRoute allowedRoles={jobSeekerOnly} />,
        children: [
          { path: "saved", element: <AccountPage /> },
          { path: "applications", element: <AccountPage /> },
          { path: "profile", element: <AccountPage /> },
          { path: "preferences", element: <AccountPage /> },
          { path: "onboarding/profile", element: <ProfileSetupPage /> },
          { path: "onboarding/skills", element: <SkillsSetupPage /> },
          { path: "jobs/:jobId/apply", element: <ApplicationPage /> },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={employerOnly} />,
        children: [
          { path: "employer", element: <EmployerPage /> },
          { path: "employer/posts", element: <EmployerPostsPage /> },
          { path: "employer/posts/new", element: <EmployerPostPage /> },
          {
            path: "employer/posts/:postId/candidates",
            element: <CandidateMatchesPage />,
          },
          {
            path: "employer/candidates",
            element: <CandidateMatchesPage />,
          },
          { path: "employer/company", element: <CompanyProfilePage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  {
    element: <FooterOnlyLayout />,
    children: [
      { path: "/sign-in", element: <SignInPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },
]);
