---
name: create-pull-request
description: Prepare, validate, and create a focused GitHub pull request for the current Dilemma Killer branch. Use when the user asks to prepare, draft, open, publish, or summarize a pull request or wants the branch made ready for GitHub review.
---

# Create Pull Request

Create a reviewable pull request from the current branch without including unrelated work.

## Workflow

1. Read `../../../AGENTS.md`, then inspect the current branch, configured remotes, working-tree status, and the diff against the intended base branch. Never assume all uncommitted files belong to the requested change.
2. Determine the base branch from the user, an existing pull request, or the remote default branch. Ask only when the choice remains ambiguous and would materially change the diff.
3. Summarize the branch by behavior, affected layers, risks, and test coverage. Inspect changed files and their direct callers or consumers; do not reread the entire repository.
4. Run the smallest relevant verification commands from `../../../typescript-app`. Use `npm run build` when the change crosses layers or affects production behavior. Run database integration tests only when an isolated `_test` database is available.
5. If changes still need to be committed, stage only the files in scope and commit only when the user explicitly requested it. Format every commit as `feat(<current-branch>): <short feature description>` and keep the complete message to at most four concise sentences.
6. Before any push or pull-request creation, verify the final diff, commit list, and absence of secrets or generated artifacts. Never force-push unless the user explicitly requests it.
7. Draft a concise PR with:
   - a specific title describing the outcome;
   - a `Summary` section with one to three bullets;
   - a `Testing` section listing commands and results;
   - a `Risks` section only when a material risk, migration, payment, auth, or deployment concern exists.
8. Create a draft pull request when the user asks to create or open one. Use the connected GitHub capability when available; otherwise use `gh`. Do not publish anything when the user only asks to prepare, review, or summarize.
9. Return the pull-request link when created. Otherwise return the exact proposed title and body plus any blockers.

## Guardrails

- Stop if the current branch is the selected base branch; do not open a PR from a branch into itself.
- Do not include unrelated working-tree changes, secrets, `.env`, `../../../node_modules`, `../../../dist`, `build/`, or `coverage/`.
- Do not claim a test passed unless its command completed successfully in this run.
- Keep PR prose short and explain user-visible behavior rather than enumerating files.
