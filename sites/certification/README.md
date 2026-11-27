# Flux certification

Public prototype for the Flux standard and its certifications. The text is open. The marks are controlled. The Flux tool, in the root of this repository, is the register and the proof of concept.

This app is self-contained. It does not import the root Next.js app, and it does not read that app's environment variables. There is no login, no payment, and no examination.

Hearthline Instruments and Kilnwatch are fictional. The banner on every page says so.

## Run

From this directory:

```bash
npm install
npm test
npm run dev
```

The dev server listens on port 3210. `npm run lint`, `npm run typecheck`, and `npm run build` are the checks to keep green.

Courses and tiers are joined from `content/courses.json` and `content/tiers.json`. Verify reads `content/credentials.json`. The standard is the Markdown in `content/standard/`. If the Kilnwatch decision unit changes in `projects/kilnwatch/units/kilnwatch-seed-DEC-001.md`, copy it to `content/example/` and re-run the tests. The page states that repository path. The vendored copy is what the build renders, so this project still builds when Vercel uses `sites/certification` as the root directory.

## Deploy

Create a separate Vercel project from this Git repository.

- Root directory: `sites/certification`
- Framework: Next.js
- Install command: `npm install`
- Build command: `npm run build`
- Output: the default Next.js output. Do not set a static export.

This directory has its own PostCSS config so the build does not pick up the root app's Tailwind setup, and `outputFileTracingRoot` stays inside `sites/certification`.

No environment variables are required. Do not copy the root app's Supabase keys or other secrets into this project. Credential lookup is a fixed fictional sample, not a database.
