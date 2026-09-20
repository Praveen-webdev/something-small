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
naming them back and offering "Continue anyway" / "Let me tick them". It must never claim
a consequence, because there isn't one.

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

## 8. The reveal — the wordmark arrives in the header
At the `end` phase, after the seeds land, the wordmark + seed mark fade into the header
at +350ms and the greeting follows at +1300ms, so the name is the last thing to appear.
`document.title` swaps at the same beat, and the mark stays for the rest of the session.

Revised: an earlier version also placed a large centred copy of the wordmark inside the
end card. Two wordmarks on one screen competed, and the header alone carries it.

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

## 8c. The ending note rings the pulse
"Every ending holds a little beginning." is no longer a line under a button; it is set on
a circular path around the replay pulse as an SVG `textPath`, centred at the top of the
ring. `.end-controls` is gone entirely, since that note was all it held. The ripple was
tightened from 2.6x to keep clear of the ring, and `textLength` pins the arc so the text
cannot grow into the dot on a different font metric.

The ring path starts at 6 o'clock with the text centred at 50%, not at 9 o'clock centred
at 25%. With the earlier geometry half the sentence (81 units) exceeded the 75 units of
path preceding the centre point, and SVG silently drops glyphs that fall before a path
starts — so the leading "E" of "Every" was never drawn.

## 8d. The flower and the wish copy
An earlier version capped the stem so the seedhead could never reach the copy. Reverted:
shortening the flower to make room was solving the wrong end of the problem. The wish
description lost "Something little. Something wild." instead, which frees the line the
field needed and leaves the dandelion at full height.

## 8e. The countdown sits on the seedhead
No disc, no border, no glow ring. The numeral is drawn straight onto the white puff in
serif, with only a faint paper-coloured halo to hold it against the busier parts of the
meadow. `meadow.head()` reports the seedhead position in CSS pixels — sway excluded, so
the number does not drift with the breeze — and the countdown is pinned to it when the
phase begins and again on resize.

## 8f. A pond with lotuses
One pond, left of the dandelion at 20% / 71.5%. A foreground version cropped by the
screen edge was tried and dropped: it crowded the scene and pushed the blooms off-screen.
A second, distant pond was also tried and dropped — one is enough.

The lotus is flat and upright, not a three-dimensional cup. An earlier build placed petals
on a cone and depth-sorted them; at 11-18px that produced 28 overlapping shapes that read
as a cabbage. It is now two fanned rows — five petals behind, three in front — each a
two-curve point filled with a base-to-tip gradient, over a small gold centre. Fewer,
cleaner shapes survive the scale.

Blooms stand on short curved stems, biased down the ellipse so they sit over open water
rather than on the far bank, and cast dim wobbling reflections clipped to the surface.
They are sized for the distance the pond sits at — 16 to 24px across, not 36 — and spread
across the water rather than stacked in one band, with the nearer ones larger so the
spacing reads as depth.
Lily pads have an under-rim for thickness and radial veins. Everything on the surface is
sorted by screen Y, so nearer paints last.

Drawn per frame rather than into the cached backdrop, because it moves; all motion reads
`time`, which only advances while `motion` is true, so reduced motion freezes it. No
library: the CSP is `default-src 'self'`, the project carries no dependencies, and
`ellipse`/`circle` already did the work.

## 8g. The meadow answers touch
The pond, the lily pads, the lotuses and the dandelion stem are all pushed by a finger and
spring back when it leaves.

It is an influence field, not a drag. Nothing calls `preventDefault` and every listener is
passive, so the scroll that drives the entire journey is untouched — and a drag that
happens to cross the pond simply nudges it on the way past. On a mouse it responds to
hover; on touch it releases when the finger lifts.

Each object carries a damped spring (zeta around 0.6, so it overshoots once and settles in
roughly half a second). Force constants are derived from the displacement wanted, since a
spring settles at `force / stiffness` — a first pass picked them by feel and bent the stem
through the floor, throwing the seedhead off-screen at 361px of travel. Targets are now
about 11px for pads, 12px for blooms and 20px for the stem head, each with a hard clamp
behind it so no combination of a long frame and a close touch can fling anything.

On touch this runs on touch events, not pointer events. The instant a drag becomes a
scroll the browser fires `pointercancel` and stops delivering `pointermove` — which would
end the interaction at exactly the moment the finger is crossing the meadow. Passive
`touchmove` keeps arriving throughout. Pointer events are kept for the mouse only, since
hover is something a finger does not have. The canvas rect is cached rather than measured
per event: `touchmove` fires continuously while scrolling, and `getBoundingClientRect` on
each one is a layout read during the busiest moment on the page. The rect is safe to cache
because the canvas fills a viewport that is sticky at `top: 0`.

The stem bends on the same lever the breath uses, scaled by how far up it is touched: a
stem bends where it is furthest from its root. Blooms tip as well as shift, so they lean
rather than slide. Touching the water leaves expanding rings, and dragging leaves a trail
of them spaced by distance rather than time. Reduced motion disables the whole field.

## 8h. The dandelion alone is three-dimensional
The plant is drawn in WebGL through three.js on a transparent canvas stacked over the
painted meadow. Everything else — sky, hills, pond, lotuses, grass, and the seeds once
they are in flight — stays in the 2D canvas underneath. The 3D layer sits at `z-index: -1`,
above the meadow and below the paper grain, so the grain still lies across the whole
picture.

Three.js is vendored into `website/assets/vendor/` rather than loaded from a CDN, because
the page CSP is `script-src 'self'` and deliberately stays that way. Hugo's `js.Build`
tree-shakes it into the bundle. That costs about 500 KB minified, 139 KB over the wire —
by far the largest thing on the page, and the one real price of this decision.

Three things made 3D worth it, and all three are things the sprite could not do: the clock
is a genuine sphere of seeds rather than a flat disc of drawn hairs; the flower opens by
fanning several hundred real ray florets outward from the centre; and the seedhead empties
in place as the wish flies, because each seed is an object that can simply stop being
drawn.

The stage map is unchanged. `stageOf` in `dandelion.js` reproduces the thresholds from
`drawFlower` exactly — yellow opens `.37`, closes `.55-.61`, whitens `.68`, seedhead opens
`.77-.98` — because DECISIONS 6 locks the chapter cut points to them. The plant is also
built in the same design units and placed at the same base point, which is what keeps
`meadow.head()` correct without change, and so the countdown still pins to the seedhead.

Two curves had to be split apart that the 2D sprite had been able to leave joined. A ray
floret reaches full length while the bud is still shut and only then fans out, so length
and fan run off separate curves; driving both from one left the flower opening invisibly
inside its own bud. Likewise the bud body has to yield faster than the thing emerging from
it, in both directions.

The seeds fly in 3D as well. They cannot stay in the head's group - it is scaled by
maturity and turns with the stem tip - so released seeds get their own instanced mesh in
world space and cross the screen freely. Each one tumbles on its own axis and carries its
own z, so some pass close to the reader and some go away behind the plant, and perspective
sizes them without being asked. That depth is the whole argument for doing the flight in
3D rather than scattering sprites. The single seed that lands and sprouts flies the same
arc it always did, bowed towards the reader through the middle of the journey.

The sprout where it lands stays 2D. It sits flat on the ground and nothing is gained by
lifting it.

The 2D plant is not deleted. If the canvas is missing or WebGL is unavailable, `flat()` is
true and `drawFlower` paints the original flower and the original flight exactly as before.

## 8i. Growth is sprung, not scrubbed
Scroll sets a target; a critically damped spring follows it at 60fps on the 3D layer's own
rAF loop, independent of the meadow's 30fps ambient loop. Wheel scrolling arrives in
discrete jumps, and scrubbing the bloom straight off `window.scrollY` made those jumps
visible in the flower. The spring settles in about 0.15s, which is short enough that the
flower still feels directly under the reader's thumb.

`prefers-reduced-motion` bypasses the spring entirely and snaps to the target.

## 8j. Her words come apart into down
The wish echo already drifted on the same wind as the seeds and faded. It now ends
differently: at about three quarters of the way through the drift, the letters are sampled
where they are standing and handed to the 3D layer as motes, and the DOM text fades out
under them. What you see is the wish turning into down rather than dimming.

The motes start the colour the text is written in and warm to cream as they lift, staggered
so the change runs across the sentence rather than happening to all of it at once. Cream
from the start was invisible against a cream sky, and ink becoming light is the idea
anyway.

All of the drift, stagger and fade happens in the vertex shader from one progress uniform.
The CPU does nothing per frame, which is what keeps it smooth on top of everything else
running during the flight.

Nothing is stored. The string arrives as an argument to `dissolveWish`, is drawn once to an
offscreen canvas, read back as positions, and dropped. It never leaves the page, so the
privacy line still holds exactly as written.

Under `prefers-reduced-motion`, or with no WebGL, `spatial()` is false and the original
fade runs unchanged.

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
