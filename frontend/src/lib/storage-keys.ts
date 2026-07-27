export function userStorageKey(
  baseKey: string,
  userId: string | null | undefined,
): string {
  return userId
    ? `${baseKey}.user.${encodeURIComponent(userId)}`
    : baseKey;
}
