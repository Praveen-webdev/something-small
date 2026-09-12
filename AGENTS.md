# Dandelion Wish

- Standalone Hugo site with vanilla JavaScript and Canvas 2D. No npm dependencies or GSAP are required.
- Run from this project directory: `hugo server --source website --config data/site.yaml --bind 127.0.0.1 --port 1313 --baseURL http://localhost:1313 --disableFastRender --renderToMemory`.
- Build: `hugo --source website --config data/site.yaml --baseURL "$SITE_URL" --minify --printI18nWarnings --panicOnWarning`. Set `SITE_URL` to the actual HTTPS deployment origin, including any path prefix, before production builds. Output is `website/public/`.
- Test: `bun test website/assets/breath.test.js`.
- Configuration is `website/data/site.yaml`; always pass `--config data/site.yaml` relative to the Hugo source directory.
- UI copy belongs in `website/i18n/en.yaml`; title and description belong in `website/content/_index.md`.
- `website/assets/meadow.js` paints cached scenery and controls botanical stages through `createMeadow(canvas).setState({ growth, flight, motion, breath })`, and exposes `landing()` and `head()` as the canvas positions the DOM pins itself to. The pond and its lotuses are drawn live each frame rather than baked into the cached backdrop, since they move; all their motion rides `time`, which only advances while `motion` is true.
- `website/assets/main.js` coordinates scroll, countdown, flight and replay. `website/assets/sound.js` synthesises the wind, gust and chime through Web Audio; it fetches nothing. `website/assets/breath.js` handles opt-in, local-only microphone analysis and track cleanup.
- Microphone access requires HTTPS or localhost. Wishes and audio are not persisted or transmitted. Always retain the tap fallback.
- `agent-browser` is not installed on this machine. To see rendered output, serve a harness that imports the module under test (`python3 -m http.server` from a scratch directory) and screenshot it with headless Chrome: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-sandbox --user-data-dir=<scratch> --window-size=390,800 --virtual-time-budget=3000 --screenshot=<out>.png <url>`. `--virtual-time-budget` fast-forwards rAF so wind motion is visible. Note `timeout` does not exist on macOS; do not wrap the command in it.
- The CSP intentionally disallows unsafe evaluation. Use element waits rather than `agent-browser wait --fn`, which triggers a CSP violation.
- Do not add `Co-Authored-By` or any AI-attribution trailer to commit messages or PR descriptions in this project.
- Accessibility is not a requirement for this project. Do not spend effort on ARIA, screen-reader support, keyboard paths or contrast audits, and never let an accessibility concern veto a design choice. Existing semantics stay where they already cost nothing; do not strip them out for their own sake.
