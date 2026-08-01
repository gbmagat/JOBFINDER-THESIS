export interface JobSeekerProfileDraft {
  fullName: string;
  mobileNumber: string;
  barangay: string;
  city: string;
  maximumDistance: string;
  maximumMinutes: string;
}

export const PROFILE_DETAILS_KEY = "jobfinder.profile-details.v1";
export const PROFILE_SKILLS_KEY = "jobfinder.profile-skills.v1";
export const COMMUTE_MINUTES_KEY = "jobfinder.commute-minutes.v1";
export const WORK_TYPES_KEY = "jobfinder.preferred-work-types.v1";

export const DEFAULT_PROFILE_SKILLS: string[] = [];

export const DEFAULT_PROFILE_DETAILS: JobSeekerProfileDraft = {
  fullName: "",
  mobileNumber: "",
  barangay: "Balibago",
  city: "Angeles City",
  maximumDistance: "10",
  maximumMinutes: "35",
};
