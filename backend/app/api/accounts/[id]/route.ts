import { getAccount, NotFoundError } from "@/lib/db/repositories/accounts";
import { jsonError, withErrorHandling } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    try {
      const account = await getAccount(id);
      return Response.json({
        id: account.id,
        username: account.handle,
        profile_url: account.profile_url,
        display_name: account.display_name,
        follower_count: account.follower_count,
        most_recent_post_at: account.most_recent_post_at,
        is_active: account.is_active,
        scrape_status: account.scrape_status,
        last_scraped_at: account.last_scraped_at,
        enabled: account.enabled,
        last_error: account.last_error,
        next_sync_at: account.next_sync_at,
      });
    } catch (err) {
      if (err instanceof NotFoundError) return jsonError(404, err.message);
      throw err;
    }
  });
}
