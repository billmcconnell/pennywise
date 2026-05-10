import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(8),
  AUTH_MODE: z.enum(['dev', 'magic-link']).default('dev'),
  ALLOWED_EMAILS: z
    .string()
    .default('')
    .transform((s) =>
      s
        ? s
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean)
        : [],
    ),
  APP_URL: z.string().url().default('http://localhost:3000'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Pennywise <noreply@pennywise.app>'),
  ANTHROPIC_API_KEY: z.string().optional(),
  WEB_DIST: z.string().default('../web/dist'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}
