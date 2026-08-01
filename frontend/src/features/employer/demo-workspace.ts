export const LUMINA_DEMO_EMPLOYER_ID =
  "mock-employer@luminatech.example";

export function isLuminaDemoEmployer(
  employerId: string | null | undefined,
): boolean {
  return employerId === LUMINA_DEMO_EMPLOYER_ID;
}
