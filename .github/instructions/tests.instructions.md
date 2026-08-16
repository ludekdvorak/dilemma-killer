---
applyTo: "typescript-app/**/*.test.ts,typescript-app/vitest*.ts"
---

# Test instructions

- Keep tests deterministic, isolated, and focused on observable behavior.
- Normal unit and API tests must run without PostgreSQL through `npm test`.
- Use `npm run test:integration` only with `TEST_DATABASE_URL` pointing to an isolated database whose name ends in `_test`.
- Add integration coverage for database schema, ownership, authentication, or persistence changes.
- Never connect tests to a production database or delete Docker volumes.

