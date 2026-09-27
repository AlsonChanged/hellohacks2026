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
  const pageSize = 1000;
  const clubs: ClubDirectoryRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from("clubs")
      .select("id,name,instagram_handle,website_url,follower_count")
      .order("name", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as ClubDirectoryRow[];
    clubs.push(...page);
    if (page.length < pageSize) return clubs;
  }
}
