import { createAdminClient } from "@/lib/supabase/admin";

export type ClubDirectoryRow = {
  id: string;
  name: string;
  instagram_handle: string;
  website_url: string | null;
  follower_count: number | null;
};

/** Returns every club currently listed in the Supabase clubs table. */
export async function listClubs(): Promise<ClubDirectoryRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("clubs")
    .select("id,name,instagram_handle,website_url,follower_count")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClubDirectoryRow[];
}
