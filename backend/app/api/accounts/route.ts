import { z } from "zod";
import { normalizeHandle } from "@/lib/instagram/handle";
import { createAccount, listAccounts } from "@/lib/db/repositories/accounts";
import { jsonError, requireAuth, withErrorHandling } from "@/lib/http";
import type { AccountRow } from "@/lib/types";

const bodySchema = z.object({ username: z.string().min(1) });

function toListShape(account: AccountRow) {
  return {
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
  };
}

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "Invalid body: expected { username }");

    let handle: string;
    try {
      handle = normalizeHandle(parsed.data.username);
    } catch {
      return jsonError(400, "Invalid Instagram handle or URL");
    }

    const account = await createAccount(handle);
    return Response.json(toListShape(account), { status: 201 });
  });
}

export async function GET() {
  return withErrorHandling(async () => {
    const accounts = await listAccounts();
    return Response.json(accounts.map(toListShape));
  });
}
