# Decisions — surprise & emotional pass

Baseline: `6941c3c`. Goal: a birthday surprise for someone who loves dandelions.
Mobile-first. No persistent storage of any kind — every reload is a fresh site.

## 1. Spoiler blackout (full)
Nothing may hint at "dandelion" or "wish" before the end.
- Remove the header wordmark + seed mark from the page.
- Neutralise `<title>`, favicon, `<meta name=description>` and all `og:`/`twitter:` tags.
  The favicon currently reuses `partials/seed.html` — needs its own neutral mark.
- The canvas keeps its natural bloom-at-chapter-2 arc. That is the story unfolding,
  not a leak; `drawFlower`/`drawBud` are untouched.

## 2. Link preview — inviting, blank of content
The preview card is the true first frame. Warm and clearly personal so it reads as
safe to tap ("something small, for you"), plus one line inviting her to open it
somewhere quiet — which primes the threshold. No dandelion imagery.

## 3. Threshold on load
A still, near-empty first frame: "Before we begin." / "Find somewhere alone you can be
still for a minute or two." Two square checkboxes (round marks read as radio buttons),
each filling forest-green with a check when ticked.
- `There's noise around me` — off by default. On: lead with tap rather than the
  microphone, and start muted.
- `No one's nearby` — **on by default.** Off: at chapter 4 the typed wish is replaced
  with "keep this one in your heart", and nothing rides the flight.

The second tick is pre-ticked deliberately. Phrased affirmatively, an unticked box would
mean "someone may be nearby", so skipping the threshold would silently drop the typed
wish — punishing exactly the person who skips. Pre-ticking keeps the default the full
experience while still letting the tick do real work. It is a preference, not consent,
so a default tick is not a dark pattern here.

Rules: **`begin` is always available from the first moment.** Both boxes are reset by JS
on every load, since browsers restore form state across a soft reload and the site must
always start fresh. The `begin` tap doubles as the gesture that unlocks Web Audio.

## 4. Chrome
Removed: the "Make a wish" shortcut, "A MOMENT OF QUIET", "THE WISHING MEADOW",
the `01 / 05` counter, the footer tagline.
Kept: the five chapter dots — silent progress, no numbers, no countdown.
Note: `.quiet-moment` and `.meadow-label` were already `display:none` under 767px,
so that part of the change is desktop-only cleanup.

## 5. Intro copy — staged fade-in on load
All of it is upfront, but arrives in beats: meadow → title → description → scroll cue,
~500ms apart, ~2s total. The chapter-1 eyebrow is cut; "Take your time. There's no
rush here." carries that job alone, sitting where it's needed next to the scroll cue.
`prefers-reduced-motion` gets everything at once.

## 6. Pacing — remap the growth curve, not the cut points
Revised during implementation. The chapter thresholds are not arbitrary: they are locked
to the canvas stage map in `drawFlower` (yellow flower opens `.37`, closes `.55-.61`,
whitens `.68`, seedhead opens `.77-.98`). Moving them to `0.5 / 0.75` would have put
"Not every ending is an ending" over a still-yellow flower and the wish prompt over a
closed bud with no seedhead to blow.

So the cut points and the canvas stay untouched, and scroll is remapped onto growth
through a piecewise-linear curve (`growthAnchors` in `main.js`):

    scroll  0.00 0.06 0.30 0.55 0.78 1.00
    growth  0.00 0.07 0.34 0.60 0.93 1.00

Same intended outcome: the wish chapter now occupies the last 22% of the scroll instead
of the last 7%, so a hard flick no longer slams into it, and the seedhead finishes
opening while she reads the prompt. Copy and visuals stay perfectly in sync.

## 7. The wish rides the flight, then dissolves
Her typed words fade in during the 8.5s flight — serif, low contrast, drifting upward
with the seeds — then dissolve before the end card. Carried, then released.
In-memory only; "never saved or sent" stays literally true. Falls back to today's
copy if she typed nothing, or if she ticked "someone's nearby".

## 8. The reveal — end-card signature
At the `end` phase, after the seeds land: the wordmark + seed mark fade in centred
inside the end card as a signature, hold a beat, then settle into the header position
for the rest of the session. `document.title` swaps at the same beat.

## 9. Birthday beat — only at the end
Everything before the flight stays universal. Sequenced under the signature, plain and
tender: "Happy birthday, <name>." in serif italic, nothing more. The existing
"May your wishes come true" stays above it. Name lives as a single config value.

## 10. Sound — synthesised now, swappable later
Web Audio, no files, no network, no CSP change. A low wind bed that swells with growth,
rises through the flight and settles at the end; one soft chime on the reveal.
Unlocked by `begin`, muted from the start if she ticked the noise box, with an
always-visible mute control. Written behind a source-agnostic interface so recorded
audio can replace synthesis later with no rework.
Blocked alternative: freesound `apiv2` requires a personal API token (and OAuth2 for
original files), and was returning 503 at the time of decision.

## 11. Hosting
Free static host with HTTPS — Cloudflare Pages or Netlify. **Non-negotiable:**
`getUserMedia` is blocked on plain HTTP, so without HTTPS the breath path silently
dies and only the tap fallback survives.

## Taken without asking — veto welcome
- Reveal persists across replay; the threshold does not re-show; the birthday card
  shows again on each ending.
- State is plain in-memory JS. No `localStorage`/`sessionStorage`/cookies — confirmed
  absent from the source today.
- A short `navigator.vibrate` pulse at seed release and at the reveal.
  Caveat: iOS Safari does not support the Vibration API — on an iPhone this is a no-op.
- The tap fallback is always available, on every path.

## Open — needed from Praveen
- Her name, spelled as it should appear. Whether the card signs off from you.
- The birthday date (constrains anything involving DNS).
