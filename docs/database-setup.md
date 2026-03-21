# Database Setup

OpenRx uses PostgreSQL through Prisma. Without `DATABASE_URL`, the app intentionally falls back to empty live records.

## Local development

1. Create `.env.local` in the project root.
2. Add your PostgreSQL connection string:

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/openrx?schema=public
```

3. Generate and apply the Prisma schema:

```bash
npm run db:generate
npm run db:push
```

4. Start the app:

```bash
npm run dev
```

## Vercel production

Add the same connection string to Vercel:

```bash
npx vercel env add DATABASE_URL production
```

Redeploy after adding the variable.

## What happens after setup

- Existing wallet/onboarding profiles sync automatically into Prisma when the patient reconnects.
- Live patient snapshot pages stop showing empty fallback states.
- New onboarding completions are persisted to the database automatically.
