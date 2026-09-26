// Small helpers shared by route handlers: cron-secret auth + consistent JSON errors.
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/utils/logger";

export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Buffers of different length would throw in timingSafeEqual; length itself isn't secret.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** True only when Authorization: Bearer <CRON_SECRET> matches exactly (constant-time). */
export function isAuthorized(request: Request): boolean {
  const secret = serverEnv().cronSecret;
  if (!secret) return false; // unset secret means the endpoint is locked, not open
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;
  return constantTimeEqual(token, secret);
}

/** Returns a 401 Response when unauthorized, or null when the request may proceed. */
export function requireAuth(request: Request): Response | null {
  return isAuthorized(request) ? null : jsonError(401, "Unauthorized");
}

/** Wraps a route handler body so any unexpected throw becomes a logged 500 instead of a crash. */
export async function withErrorHandling(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    logger.error({ err }, "unhandled route error");
    return jsonError(500, err instanceof Error ? err.message : "Internal error");
  }
}
