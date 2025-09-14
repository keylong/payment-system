import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: 'postgresql://neondb_owner:npg_H2Drm0jWCZks@ep-fancy-leaf-aduikves-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
  },
  verbose: true,
  strict: true,
});