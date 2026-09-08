import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, School, GlobalNotice } from "@/lib/types";

/**
 * Cached data fetchers — use Next.js unstable_cache to cache Supabase
 * queries for a short TTL (15-60 seconds). This dramatically reduces
 * the number of round-trips to Supabase on high-traffic deployments.
 *
 * Each function is cached by its key arguments (user ID, school ID),
 * so different users/schools get separate cache entries.
 */

/**
 * Fetch + cache a user's profile. Cached for 15s per user ID.
 */
export const getCachedProfile = unstable_cache(
  async (userId: string): Promise<Profile | null> => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error || !data) return null;
      return data as Profile;
    } catch {
      return null;
    }
  },
  ["profile"],
  { revalidate: 15, tags: [`profile`] }
);

/**
 * Fetch + cache a school by ID. Cached for 60s (school name rarely changes).
 */
export const getCachedSchool = unstable_cache(
  async (schoolId: string): Promise<Pick<School, "id" | "name" | "principal_id"> | null> => {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("schools")
        .select("id, name, principal_id")
        .eq("id", schoolId)
        .single();
      return data as Pick<School, "id" | "name" | "principal_id"> | null;
    } catch {
      return null;
    }
  },
  ["school"],
  { revalidate: 60 }
);

/**
 * Fetch + cache active global notices for a school. Cached for 30s.
 */
export const getCachedNotices = unstable_cache(
  async (schoolId: string): Promise<GlobalNotice[]> => {
    try {
      const admin = createAdminClient();
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await admin
        .from("global_notices")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .lte("publish_date", today)
        .order("publish_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as unknown as GlobalNotice[];
    } catch {
      return [];
    }
  },
  ["notices"],
  { revalidate: 30 }
);
