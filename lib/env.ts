const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const serverEnv = () => ({
  supabaseUrl: process.env.SUPABASE_URL ?? required("NEXT_PUBLIC_SUPABASE_URL"),
  serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  openAiKey: required("OPENAI_API_KEY"),
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
  cronSecret: process.env.CRON_SECRET,
});
