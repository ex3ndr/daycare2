# daycare2 agent notes

## Goals
- AI-focused Slack clone
- keep the core minimal and composable
- add integrations incrementally

## Conventions
- multipackage workspace: `packages/daycare-server`, `packages/daycare-web`
- typescript only, esm output
- sources live in `sources/` (server), `app/` (web, Vite + React SPA)
- tests use `*.spec.ts`
- tests must be minimal and live next to the file under test

## Build, Test, and Development Commands
- Runtime baseline: Node **22+**.
- Install deps: `yarn install`
- Run server in dev: `yarn dev`
- Run web in dev: `yarn web`
- Node remains supported for running built output (`dist/*`) and production installs.
- Type-check/build: `yarn typecheck` (tsc)
- Tests: `yarn test` (vitest)

## Coding Style & Naming Conventions
- Language: TypeScript (ESM). Prefer strict typing; avoid `any`.
- Add brief code comments for tricky or non-obvious logic.
- Keep files concise; extract helpers instead of "V2" copies.
- Aim to keep files under ~700 LOC; guideline only (not a hard guardrail). Split/refactor when it improves clarity or testability.
- Naming: use **Daycare2** for product/app/docs headings; use `daycare2` for CLI command, package/binary, paths, and config keys.
- Use `@/types` for shared types whenever available instead of deep module imports.

## Logging
- Always create a logger with an explicit module via `getLogger("module.name")`.
- Module labels in pretty logs are normalized to 20 characters (trim or right-pad with spaces).
- Prefer concise, stable module names to reduce trimming collisions.

## Central Types (`@/types`)
- Prefer `import type { ... } from "@/types"` for shared/cross-cutting types.
- Add cross-cutting/public types to `sources/types.ts` and re-export there.
- Keep domain-internal types in their local modules.

## Agent-Specific Notes
- Never edit `node_modules`.
- When working on a GitHub Issue or PR, print the full URL at the end of the task.
- When answering questions, respond with high-confidence answers only: verify in code; do not guess.
- Patching dependencies requires explicit approval; do not do this by default.
- **Multi-agent safety:** do **not** create/apply/drop `git stash` entries unless explicitly requested.
- **Multi-agent safety:** when the user says "push", you may `git pull --rebase` to integrate latest changes. When the user says "commit", scope to your changes only. When the user says "commit all", commit everything in grouped chunks.
- **Multi-agent safety:** do **not** switch branches / check out a different branch unless explicitly requested.
- **Multi-agent safety:** when you see unrecognized files, keep going; focus on your changes and commit only those.
- keep configs small and explicit
- avoid hidden side effects
- commit after each ready-to-use change using Angular-style commits
- build before each commit and run tests
- do not use barrel `index.ts` files
- avoid backward-compatibility shims for internal code

## Facade Classes
When a domain needs coordination logic (scheduling, resolving, registry), create a **plural-named facade class**:

| Domain object | Facade class | Responsibility |
|---------------|--------------|----------------|
| `Channel` | `Channels` | lookup, creation, membership |
| `Message` | `Messages` | sending, querying, streaming |
| `User` | `Users` | auth, profiles, presence |

The facade owns the collection and coordination logic. Domain objects remain simple data or behavior units.

## Object Lifecycle
Do not implement `close()`, `dispose()`, or cleanup methods unless explicitly needed. Assume objects live forever in memory.

When cleanup **is** required (e.g., file handles, network connections, timers):
- Use `shutdown.ts` hooks for process-level cleanup
- Document why cleanup is necessary in a comment

## Utility Functions
Place general-purpose helpers in `sources/util/`. Keep utilities **domain-agnostic**.

## Time Handling
Use **unix timestamps** (milliseconds since epoch) for all time values in the application. Only use `Date` objects at boundaries for parsing or formatting.

## File Organization: One Function, Prefix Naming

### Core Principle
Write **one public function per file**. Name files and functions using **prefix notation** where the domain/noun comes first: `channelCreate` not `createChannel`, `messageFormat` not `formatMessage`.

### File Naming Convention
```
domainVerb.ts        # file name matches function name exactly
domainVerb.spec.ts   # unit test lives next to the file
```

### Underscore Prefix for Aggregation Files
Use an underscore prefix (`_`) for files that aggregate or combine multiple items into a single list or registry.

### Grouping by Domain
Organize files into domain folders. Each folder contains many small files.

### Pure Functions First
- **Prefer pure functions**: input -> output, no side effects, no mutations
- **Isolate impure code**: I/O, state mutations, and side effects go in clearly named files
- **Dependency injection**: pass dependencies as arguments rather than importing singletons
