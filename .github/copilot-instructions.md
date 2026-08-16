# Repository instructions

Read the root `AGENTS.md` before exploring or changing code. It contains the project map, commands, architectural boundaries, and safety rules. Start from the mapped entry points and inspect only files directly relevant to the requested feature.

The maintained application is under `typescript-app/`; run npm and Docker commands from that directory. Reusable pull-request guidance is in `skills/create-pull-request/SKILL.md`, which is shared by Codex and GitHub Copilot.

## Commit messages

- Do not commit unless the user explicitly asks.
- Read the current Git branch immediately before composing the message.
- Start every commit with `feat(<current-branch>): ` and add a short, specific description of what the feature does.
- Keep the complete commit message between one and four concise sentences; use at most three short body sentences when context is needed.
- Describe user-visible behavior and intent, not a list of changed files.

Example:

```text
feat(profile-page): add saved player group management

Lets signed-in users create and reuse player groups. Keeps group ownership enforced by the API.
```
