# Audit - commit `cb8625c` "single run script"

Reviewed by Claude on 2026-06-10. Codex converted the repo into an npm workspace
(`front` + `back`) with a single root `package.json`, consolidated the two
per-app lockfiles into one root `package-lock.json`, and updated the deploy
workflow and docs accordingly.

## Verdict

**I agree with the change.** It's a clean, correct workspace conversion and a
real ergonomics win (`npm install` + `npm run dev` from the root instead of two
separate `cd` dances). Verified locally:

- `npm ci` succeeds; the root lockfile is in sync with all three manifests.
- `npm run lint` passes (prettier check on `front`).
- The three old lockfiles are correctly collapsed into one workspace lockfile.

## Resolution

The two actionable findings were addressed:

1. The root package now declares the Vite-compatible Node range
   `^20.19.0 || >=22.12.0`, making `.npmrc` `engine-strict=true` intentional.
2. The frontend API helper now reads from `$env/dynamic/public`, allowing
   `PUBLIC_API_BASE_URL` to fall back to `http://127.0.0.1:3001` when unset.
   A bare `npm run build` therefore works as documented.

The CI dependency scope and frontend working directory comments were cosmetic
and do not justify extra workflow complexity.

## Final verification

- `npm install --package-lock-only --ignore-scripts --offline`
- `npm run lint`
- `npm run build` without a local `.env`
- GitHub Pages build with `BASE_PATH` and production `PUBLIC_API_BASE_URL`
- Production build output contains the Render API URL

No open concerns remain from this audit.
