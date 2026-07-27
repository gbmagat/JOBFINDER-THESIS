import { JOBS } from "./data";

export const SAVED_JOB_IDS_KEY = "jobfinder.saved-job-ids.v1";
export const DEFAULT_SAVED_JOB_IDS = JOBS.slice(0, 3).map((job) => job.id);
