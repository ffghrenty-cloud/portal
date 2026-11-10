# Portal

Next.js application for catalog, customer accounts, order processing and staff workflow.

## Local development

1. Install dependencies: `npm ci`.
2. Copy `.env.example` to `.env.local`.
3. Start the app: `npm run dev`.

## Required environment variables

- `SESSION_SECRET` — required in production. Generate a unique value with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Do not commit `.env.local` or production secrets to Git.

## Deployment

The application is intended for Vercel. Before production deployment, migrate the local SQLite database to a persistent hosted database. Vercel's function filesystem must not be used as the permanent location for `data.db`.

The database migration is a separate deployment prerequisite; do not point a public deployment at a local SQLite file.
