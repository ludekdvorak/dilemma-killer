---
applyTo: "typescript-app/**/*.ts,typescript-app/**/*.tsx,typescript-app/**/*.css"
---

# TypeScript application instructions

- Work from `typescript-app/` and keep strict TypeScript checks passing.
- Start with the entry points listed in the root `AGENTS.md`; inspect only the files and direct consumers relevant to the task.
- Keep browser/server API shapes synchronized through `shared/contracts.ts` and validate untrusted input at the server boundary.
- Keep HTTP concerns in `server/routes/`, reusable behavior in `server/services/`, and frontend feature UI in `src/pages/` or `src/components/`.
- Preserve the single-origin production design and the documented authentication-cookie security properties.
- Do not edit `node_modules/`, `dist/`, `build/`, or `coverage/`.
- Run `npm run typecheck` and the smallest relevant tests after changes. Run `npm run build` for changes that cross layers or affect production behavior.

