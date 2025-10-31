Title: chore: set base and split vendor chunks for production build

Branch: fix/prod-base-and-split

Summary
-------
This branch makes production-serving fixes and reduces the main bundle size by splitting large vendor libraries into named chunks.

Key changes
-----------
- Added `base: './'` to `vite.config.ts` so the production `dist` can be served from any path (fixes missing asset issues when opening `dist/index.html` directly).
- Added `build.rollupOptions.output.manualChunks` rules to split large dependencies into named vendor chunks (examples: `vendor_react`, `vendor_recharts`, `vendor_genai`, `vendor_d3`, `vendor_lodash`, `vendor_redux`, `vendor_immer`, and Firebase submodules like `vendor_firebase_database`, `vendor_firebase_app`, etc.).
- Removed legacy `serve.js` file.
- (Temporary) added console debug logs to help diagnose a blank-page issue; those debug logs have been removed before opening this PR.

Why
---
- Using a relative `base` makes the app portable and avoids 404s when `dist/index.html` is opened directly.
- Splitting vendor libraries reduces the size of the initial entry chunk and improves parse/compile time for the browser.

Build output (high level)
------------------------
- Entry chunk: ~69 KB (gzip ~13 KB)
- Large vendor chunks remain for some libraries: `vendor_firebase_database` (~175 KB), `vendor_recharts`/`vendor_react`/`vendor_genai` (~190–200 KB each). These can be further optimized via code-splitting or lazy imports.

Testing steps
-------------
1. Build locally:

```powershell
cd C:\Users\Mark\OneDrive\Documents\GitHub\AppliedOptix
npm install
npm run build
```

2. Serve the `dist` folder and verify in a browser:

```powershell
npx serve -s dist -l 8000
# or
npx http-server .\dist -p 8000
```

3. Open http://localhost:8000 and confirm the app loads.
   - If you see only the text "Selecting element...", ensure DevTools element picker is disabled (Ctrl+Shift+C) — that overlay can make the page appear blank.
   - Open DevTools → Network and Console to verify no 404s and no runtime errors.

Follow-ups / next steps
----------------------
- Consider lazy-loading very large libraries (e.g., Firebase Realtime Database usage, GenAI, Recharts) where feasible.
- Replace some vendor CDN importmap entries with on-demand dynamic imports or move GenAI/recharts to async chunks if they are not needed on initial render.
- Optionally add Lighthouse or bundle analyzer output to the repo (e.g., using `rollup-plugin-visualizer`) to help prioritize optimizations.

Notes
-----
I reverted temporary debug logs before committing the final changes. If you'd like, I can open the pull request on GitHub for you (requires authentication), or you can review this description and open the PR from the branch `fix/prod-base-and-split`.
