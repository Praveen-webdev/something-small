# Dandelion Wish

- Standalone Hugo site with vanilla JavaScript and Canvas 2D. No npm dependencies or GSAP are required.
- Run from this project directory: `hugo server --source website --config data/site.yaml --bind 127.0.0.1 --port 1313 --baseURL http://localhost:1313 --disableFastRender --renderToMemory`.
- Build: `hugo --source website --config data/site.yaml --baseURL "$SITE_URL" --minify --printI18nWarnings --panicOnWarning`. Set `SITE_URL` to the actual HTTPS deployment origin, including any path prefix, before production builds. Output is `website/public/`.
- Test: `bun test website/assets/breath.test.js`.
- Configuration is `website/data/site.yaml`; always pass `--config data/site.yaml` relative to the Hugo source directory.
- UI copy belongs in `website/i18n/en.yaml`; title and description belong in `website/content/_index.md`.
- `website/assets/meadow.js` paints cached scenery and controls botanical stages through `createMeadow(canvas).setState({ growth, flight, motion })`.
- `website/assets/main.js` coordinates scroll, countdown, flight and replay. `website/assets/sound.js` synthesises the wind, gust and chime through Web Audio; it fetches nothing. `website/assets/breath.js` handles opt-in, local-only microphone analysis and track cleanup.
- Microphone access requires HTTPS or localhost. Wishes and audio are not persisted or transmitted. Always retain the tap fallback.
- Browser automation on this machine needs modern Node first on PATH: `PATH="/opt/homebrew/bin:$PATH" agent-browser ...`. Default Node 16 cannot start its daemon.
- The CSP intentionally disallows unsafe evaluation. Use element waits rather than `agent-browser wait --fn`, which triggers a CSP violation.
- Do not add `Co-Authored-By` or any AI-attribution trailer to commit messages or PR descriptions in this project.
- Accessibility is not a requirement for this project. Do not spend effort on ARIA, screen-reader support, keyboard paths or contrast audits, and never let an accessibility concern veto a design choice. Existing semantics stay where they already cost nothing; do not strip them out for their own sake.
