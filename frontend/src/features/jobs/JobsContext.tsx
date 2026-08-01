import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../auth/AuthContext";
import { getAllJobs } from "./data";
import type { JobListing, MatchExplanation } from "./types";

type ApiJob = Omit<JobListing, "fit"> & {
  fit?: MatchExplanation;
};

interface JobsContextValue {
  jobs: JobListing[];
  getJob(jobId: string): JobListing | undefined;
  isLoading: boolean;
  error: string;
  hasPersonalizedMatches: boolean;
  loadJob(jobId: string): Promise<JobListing | undefined>;
  refreshJobs(): Promise<void>;
}

const emptyFit: MatchExplanation = {
  overallScore: 0,
  skillScore: 0,
  locationScore: 0,
  weights: { skill: 0.7, location: 0.3 },
  exactSkills: [],
  relatedSkills: [],
  missingSkills: [],
  summary: "Add profile skills to calculate a personalized match.",
};

const fallbackJobs = getAllJobs();
const fallbackValue: JobsContextValue = {
  jobs: fallbackJobs,
  getJob: (jobId) => fallbackJobs.find((job) => job.id === jobId),
  isLoading: false,
  error: "",
  hasPersonalizedMatches: true,
  loadJob: async (jobId) => fallbackJobs.find((job) => job.id === jobId),
  refreshJobs: async () => {},
};
const JobsContext = createContext<JobsContextValue>(fallbackValue);

function normalizeJobs(apiJobs: ApiJob[]): JobListing[] {
  return apiJobs.map((job) => ({
    ...job,
    fit: job.fit ?? emptyFit,
  }));
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const { isReady, user } = useAuth();
  const usesTestData = import.meta.env.MODE === "test";
  const [jobs, setJobs] = useState<JobListing[]>(
    usesTestData ? fallbackJobs : [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasPersonalizedMatches, setHasPersonalizedMatches] = useState(
    usesTestData,
  );

  const refreshJobs = useCallback(async () => {
    if (usesTestData) {
      setJobs(getAllJobs());
      setHasPersonalizedMatches(true);
      setError("");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ jobs: ApiJob[] }>("/jobs?pageSize=50");
      setJobs(normalizeJobs(result.jobs));
      setHasPersonalizedMatches(
        result.jobs.some((job) => job.fit !== undefined),
      );
    } catch (requestError) {
      setJobs([]);
      setHasPersonalizedMatches(false);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "JobFinder could not load job listings.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [usesTestData]);

  const loadJob = useCallback(
    async (jobId: string) => {
      if (usesTestData) {
        return getAllJobs().find((job) => job.id === jobId);
      }

      try {
        const result = await apiRequest<{ job: ApiJob }>(
          `/jobs/${encodeURIComponent(jobId)}`,
        );
        const loadedJob = normalizeJobs([result.job])[0];
        setJobs((current) => [
          loadedJob,
          ...current.filter((job) => job.id !== loadedJob.id),
        ]);
        if (result.job.fit) setHasPersonalizedMatches(true);
        return loadedJob;
      } catch {
        return undefined;
      }
    },
    [usesTestData],
  );

  useEffect(() => {
    if (!isReady) return;
    void refreshJobs();
  }, [isReady, refreshJobs, user?.id]);

  useEffect(() => {
    const refresh = () => void refreshJobs();
    window.addEventListener("jobfinder:profile-updated", refresh);
    window.addEventListener("jobfinder:jobs-updated", refresh);
    return () => {
      window.removeEventListener("jobfinder:profile-updated", refresh);
      window.removeEventListener("jobfinder:jobs-updated", refresh);
    };
  }, [refreshJobs]);

  const value = useMemo<JobsContextValue>(
    () => ({
      jobs,
      getJob: (jobId) => jobs.find((job) => job.id === jobId),
      isLoading,
      error,
      hasPersonalizedMatches,
      loadJob,
      refreshJobs,
    }),
    [
      error,
      hasPersonalizedMatches,
      isLoading,
      jobs,
      loadJob,
      refreshJobs,
    ],
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs() {
  return useContext(JobsContext);
}
