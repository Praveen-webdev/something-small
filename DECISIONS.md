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
- Tab title is "Have a minute"; the share card stays "something small, for you".
- The scroll cue said "SCROLL TO GROW" — now "SCROLL GENTLY".
- The chapter dots carried `aria-label`/`title` of "The meadow", "A golden bloom",
  "Make your wish" and the nav was labelled "The life of a little wish". Those are
  desktop tooltips and screen-reader announcements present from the first frame, so
  they are now "Chapter one" … "Chapter five" under a nav labelled "Chapters".

Audited against the built output: the only visible first-frame text is the threshold,
the intro copy and the scroll cue. The single thematic word left is "Big wishes." in the
intro headline, kept deliberately, and it sits behind the threshold until she begins.

## 2. Link preview — inviting, blank of content
The preview card is the true first frame. Warm and clearly personal so it reads as
safe to tap ("something small, for you"), plus one line inviting her to open it
somewhere quiet — which primes the threshold. No dandelion imagery.

## 3. Threshold on load
A still, near-empty first frame: "Before we begin." / "Find somewhere alone you can be
still for a minute or two." Two square checkboxes, unticked by default:
`No noise around me` and `No one's nearby`.

**The ticks steer nothing.** Everyone gets the identical experience whatever they answer.
They are a settling-in ritual — a way of asking her to arrange the room before she starts
— not a control surface. Revised from an earlier branching design: once the labels were
phrased affirmatively and left unticked by default, every branch punished the person who
tapped straight through, and no one should be able to accidentally opt out of the best
version of a gift.

Tapping `begin` with either box unticked opens one gentle dialogue — "Just checking." —
naming them back and offering "Continue anyway" / "Let me tick them". Its copy speaks
about her room, not about the site: "Nothing is stopping you. It is only nicer when it is
just you." It must never claim a consequence, because there isn't one.

Rules: **`begin` is never blocked.** Both boxes are reset by JS on every load, since
browsers restore form state across a soft reload and the site must always start fresh.
The `begin` tap doubles as the gesture that unlocks Web Audio.

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

## 7b. The meadow answers her breath
`breath.js` already computed a live RMS every 32ms and threw it away, reporting only the
binary blow. It now also reports a smoothed 0-1 level through an optional `onLevel`
(detection and calibration untouched, since the tests assert on those). The meadow takes
it as a `breath` state: the seedhead leans downwind, trembles at two frequencies, and the
puff stretches and rotates — all while she is still breathing, before anything releases.
The wind rises with it, and one swept gust plays as the seeds actually leave.

Tapping gets the same beat: a 620ms swell drives the identical `breath` state up to 1
before releasing, so the fallback path is not visibly the poorer one.

## 8b. Replay lives on the meadow, not in a button
The "Plant another wish" button is gone. Replay is now a pulsing spot sitting exactly on
the seed that came to rest — `meadow.landing()` is the single source of truth for that
point, shared with the sprout `drawFlower` paints at `flight > .91`, so the two cannot
drift. It appears 3.4s after the ending so the signature and the greeting land first,
takes keyboard focus when it does, and carries a visually-hidden label. Under
`prefers-reduced-motion` the ripple is replaced by a static ring so it stays visible.

Known cost: an unlabelled pulse is far less discoverable than a button. "Every ending
holds a little beginning." now sits under it and points at the sprout, but if she never
spots it, the piece simply ends — which is a defensible ending, just not a chosen one.

## 9. Birthday beat — only at the end
Everything before the flight stays universal. Sequenced under the signature, plain and
tender: "Happy birthday, <name>." in serif italic, nothing more. The existing
"May your wishes come true" stays above it. Name lives as a single config value.

## 10. Sound — synthesised now, swappable later
Web Audio, no files, no network, no CSP change. A low wind bed that swells with growth,
rises through the flight and settles at the end; one soft chime on the reveal.
Unlocked by `begin` and playing from that moment, with an
always-visible mute control in the header: a speaker glyph with two arcs, struck through
by a diagonal when muted. An earlier abstract concentric-ring mark was replaced because
nobody could tell what it was, and its two states differed only by an opacity shift. Written behind a source-agnostic interface so recorded
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
