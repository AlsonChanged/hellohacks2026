import pino from "pino";

// Never pass secrets, tokens, or full env objects to the logger.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: ["*.authorization", "*.apiKey", "*.serviceRoleKey", "*.sessionId", "*.cookie"],
});
