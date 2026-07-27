export const LUMINA_DEMO_EMPLOYER_EMAIL =
  "employer@luminatech.example";
export const LUMINA_DEMO_EMPLOYER_ID =
  `mock-${LUMINA_DEMO_EMPLOYER_EMAIL}`;

export function isLuminaDemoEmployer(
  employerId: string | null | undefined,
): boolean {
  return employerId === LUMINA_DEMO_EMPLOYER_ID;
}
