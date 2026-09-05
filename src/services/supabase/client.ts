// Offline Mode: CheckMate runs 100% locally with SQLite and local storage.

export const supabase = null;

export async function checkCloudConnection(): Promise<boolean> {
  return false;
}
