import { createMeadow } from './meadow.js';
import { createBreathListener } from './breath.js';
import { createSound } from './sound.js';

const elements = Object.fromEntries([
  'journey', 'viewport', 'meadow', 'story-copy', 'eyebrow', 'title-line', 'title-accent',
  'description', 'wish-field', 'wish-input', 'grow-controls', 'gentle-note',
  'scroll-prompt', 'scroll-label', 'wish-controls', 'microphone-button',
  'tap-button', 'microphone-note', 'blow-controls', 'blow-button', 'blow-note', 'countdown',
  'cancel-button', 'replay-spot', 'wish-echo', 'finale',
  'birthday-line', 'brand', 'threshold', 'begin-button', 'option-noisy', 'option-private',
  'sound-toggle', 'confirm', 'confirm-list', 'confirm-continue', 'confirm-back', 'veil',
].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]));
const scenes = Object.fromEntries([...document.querySelectorAll('[data-scene]')].map((element) => [element.dataset.scene, element.dataset]));
const messages = Object.fromEntries([...document.querySelectorAll('[data-message]')].map((element) => [element.dataset.message, element.textContent]));
const chapterButtons = [...document.querySelectorAll('[data-chapter]')];
const sceneControls = document.querySelector('.scene-controls');
const chapterPositions = [0, 0.16, 0.42, 0.66, 0.9];
const chapterScenes = ['intro', 'sprout', 'bloom', 'change', 'wish'];
// Scroll is remapped onto growth so every chapter gets comparable dwell time while the
// canvas keeps the stage thresholds it was tuned against. Each pair is [scroll, growth].
const growthAnchors = [[0, 0], [0.06, 0.07], [0.3, 0.34], [0.55, 0.6], [0.78, 0.93], [1, 1]];
const chapterStarts = [0, 0.06, 0.3, 0.55, 0.78];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const meadow = createMeadow(elements.meadow);
const sound = createSound();
let phase = 'growing';
let scene = 'intro';
let chapter = 0;
let progress = 0;
let growth = 0;
let scrollRange = 1;
let scrollFrame = 0;
let timer = 0;
let flightFrame = 0;
let flightProgress = 0;
let flightTime = 0;
let lastFlightFrame = 0;
let breathListener = null;
let requestId = 0;
let microphoneMessage = '';
let entered = false;
let revealed = false;
let echoAnimation = null;
let spotTimer = 0;
let swellFrame = 0;
let replaying = false;

const toGrowth = (amount) => {
  for (let index = 1; index < growthAnchors.length; index += 1) {
    const [scrollTo, growthTo] = growthAnchors[index];
    if (amount <= scrollTo) {
      const [scrollFrom, growthFrom] = growthAnchors[index - 1];
      const span = scrollTo - scrollFrom;
      return growthFrom + (growthTo - growthFrom) * (span ? (amount - scrollFrom) / span : 1);
    }
  }
  return 1;
};

const toChapter = (amount) => {
  let index = 0;
  while (index < chapterStarts.length - 1 && amount >= chapterStarts[index + 1]) index += 1;
  return index;
};

const setScene = (nextScene, description) => {
  const content = scenes[nextScene];
  if (scene !== nextScene) {
    scene = nextScene;
    elements.eyebrow.textContent = content.eyebrow;
    elements.eyebrow.hidden = !content.eyebrow;
    elements.titleLine.textContent = content.title;
    elements.titleAccent.textContent = content.accent;
    if (!reducedMotion.matches && entered) {
      elements.storyCopy.getAnimations().forEach((animation) => animation.cancel());
      elements.storyCopy.animate([{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 650, easing: 'ease-out' });
    }
  }
  elements.description.textContent = description || content.description;
};

const stopMicrophone = () => {
  requestId += 1;
  breathListener?.stop();
  breathListener = null;
  meadow?.setState({ breath: 0 });
  sound?.setBreath(0);
};

const clearEcho = () => {
  echoAnimation?.cancel();
  echoAnimation = null;
  elements.wishEcho.hidden = true;
  elements.wishEcho.textContent = '';
};

const setControls = () => {
  const isWish = phase === 'growing' && chapter === 4;
  const wishVisible = isWish || phase === 'permission';
  elements.viewport.dataset.phase = phase === 'growing' ? chapterScenes[chapter] : phase;
  elements.growControls.hidden = phase !== 'growing' || isWish;
  elements.wishField.hidden = !wishVisible;
  elements.wishControls.hidden = !wishVisible;
  elements.microphoneButton.disabled = phase === 'permission';
  elements.blowControls.hidden = phase !== 'listening';
  elements.countdown.hidden = phase !== 'countdown';
  elements.cancelButton.hidden = !['permission', 'countdown', 'listening'].includes(phase);
  if (phase !== 'end') {
    clearTimeout(spotTimer);
    elements.replaySpot.hidden = true;
  }
  elements.finale.hidden = phase !== 'end';
};

const updateGrowth = () => {
  scrollFrame = 0;
  if (phase !== 'growing') return;
  progress = Math.max(0, Math.min(1, window.scrollY / scrollRange));
  growth = toGrowth(progress);
  meadow?.setState({ growth, flight: 0 });
  sound?.setGrowth(growth);
  const nextChapter = toChapter(progress);
  if (chapter !== nextChapter) {
    chapter = nextChapter;
    setScene(chapterScenes[chapter]);
    chapterButtons.forEach((button, index) => {
      if (index === chapter) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    elements.scrollLabel.textContent = messages[chapter ? 'keepScrolling' : 'scrollHint'];
    elements.gentleNote.hidden = chapter > 0;
    setControls();
  }
};

const goToChapter = (index, immediate = false) => {
  window.scrollTo({ top: chapterPositions[index] * scrollRange, behavior: immediate || reducedMotion.matches ? 'instant' : 'smooth' });
};

const measure = () => {
  const previousRange = scrollRange;
  scrollRange = Math.max(1, elements.journey.offsetHeight - elements.viewport.offsetHeight);
  if (previousRange > 1 && previousRange !== scrollRange && phase === 'growing') {
    window.scrollTo({ top: progress * scrollRange, behavior: 'instant' });
  }
  updateGrowth();
};

const returnToWish = () => {
  clearTimeout(timer);
  cancelAnimationFrame(swellFrame);
  swellFrame = 0;
  stopMicrophone();
  clearEcho();
  phase = 'growing';
  chapter = 4;
  progress = chapterPositions[4];
  growth = toGrowth(progress);
  elements.microphoneNote.textContent = messages.microphonePrivacy;
  setScene('wish');
  setControls();
  meadow?.setState({ growth, flight: 0 });
  goToChapter(4, true);
  elements.microphoneButton.focus({ preventScroll: true });
};

// The wordmark is withheld until the wish has flown, so the seed mark never gives the
// meadow away. It arrives quietly in the header first and the greeting lands after it,
// so the name is the last thing to appear. Once shown it stays; nothing is persisted.
const revealFinale = () => {
  if (revealed) {
    elements.brand.hidden = false;
    return;
  }
  revealed = true;
  document.title = messages.revealedTitle;
  const fadeIn = (element, delay) => {
    if (!element) return;
    element.hidden = false;
    if (reducedMotion.matches) return;
    element.animate([{ opacity: 0, translate: '0 6px' }, { opacity: 1, translate: '0 0' }], { duration: 900, delay, easing: 'ease-out', fill: 'backwards' });
  };
  fadeIn(elements.brand, 350);
  fadeIn(elements.birthdayLine, 1300);
};

// Replay lives on the meadow itself now: a pulse over the seed that came to rest.
// It waits for the wordmark and the greeting to land before asking for attention.
const placeReplaySpot = () => {
  const point = meadow?.landing();
  if (!point) return;
  elements.replaySpot.style.left = `${point.x}px`;
  elements.replaySpot.style.top = `${point.y}px`;
};

const finishFlight = () => {
  phase = 'end';
  flightProgress = 1;
  meadow?.setState({ flight: 1 });
  sound?.setFlight(0.35);
  setScene('end');
  setControls();
  revealFinale();
  sound?.chime();
  navigator.vibrate?.([0, 18, 90, 26]);
  placeReplaySpot();
  spotTimer = window.setTimeout(() => {
    if (phase !== 'end') return;
    placeReplaySpot();
    elements.replaySpot.hidden = false;
    elements.replaySpot.focus({ preventScroll: true });
  }, reducedMotion.matches ? 1200 : 3400);
};

const animateFlight = (timestamp) => {
  if (phase !== 'flight' || document.hidden) return;
  if (lastFlightFrame) flightTime += Math.min(timestamp - lastFlightFrame, 64);
  lastFlightFrame = timestamp;
  flightProgress = Math.min(1, flightTime / (reducedMotion.matches ? 1800 : 8500));
  meadow?.setState({ flight: flightProgress });
  sound?.setFlight(Math.sin(flightProgress * Math.PI));
  if (flightProgress >= 1) finishFlight();
  else flightFrame = requestAnimationFrame(animateFlight);
};

// Her words ride the seeds and dissolve with them: carried, then let go. The text never
// leaves this variable, so "never saved or sent" stays literally true.
const echoWish = (wish) => {
  if (!wish) return;
  elements.wishEcho.textContent = wish;
  elements.wishEcho.hidden = false;
  if (reducedMotion.matches) {
    echoAnimation = elements.wishEcho.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.25 }, { opacity: 0.85, offset: 0.7 }, { opacity: 0 }], { duration: 1600, easing: 'ease-out' });
    // No drift under reduced motion; the fade alone carries it.
  } else {
    // Carried on the same wind as the seeds: they leave rightward and rising, so the
    // words do too. Straight up read as the text escaping the picture rather than
    // travelling with it.
    echoAnimation = elements.wishEcho.animate([
      { opacity: 0, translate: '-1.6rem 1.4rem', rotate: '-1.5deg' },
      { opacity: 0.9, translate: '0 0', rotate: '0deg', offset: 0.2 },
      { opacity: 0.8, translate: '3.6rem -1.9rem', rotate: '1.4deg', offset: 0.58 },
      { opacity: 0, translate: '11rem -4.4rem', rotate: '3.2deg' },
    ], { duration: 7200, easing: 'cubic-bezier(.25,.6,.3,1)' });
  }
  echoAnimation.finished.then(clearEcho, () => {});
};

const releaseSeeds = () => {
  if (phase !== 'listening') return;
  clearTimeout(timer);
  stopMicrophone();
  const wish = elements.wishInput.value.trim();
  elements.wishInput.value = '';
  phase = 'flight';
  flightTime = 0;
  lastFlightFrame = 0;
  flightProgress = 0;
  setScene('flight');
  setControls();
  meadow?.setState({ growth: 1, breath: 0 });
  sound?.gust(1);
  navigator.vibrate?.(14);
  echoWish(wish);
  flightFrame = requestAnimationFrame(animateFlight);
};

// Tapping should feel like a breath too, or the fallback path is plainly the poorer
// one: the seedhead leans and the wind rises for a beat before anything lets go.
const tapRelease = () => {
  if (phase !== 'listening' || swellFrame) return;
  const started = performance.now();
  const duration = reducedMotion.matches ? 180 : 620;
  const step = (timestamp) => {
    if (phase !== 'listening') {
      swellFrame = 0;
      return;
    }
    const amount = Math.min(1, (timestamp - started) / duration);
    meadow?.setState({ breath: amount });
    sound?.setBreath(amount);
    if (amount < 1) {
      swellFrame = requestAnimationFrame(step);
      return;
    }
    swellFrame = 0;
    releaseSeeds();
  };
  swellFrame = requestAnimationFrame(step);
};

const beginListening = () => {
  phase = 'listening';
  setScene('listening', breathListener ? undefined : messages.tapDescription);
  setControls();
  elements.blowNote.textContent = breathListener ? messages.listeningNote : microphoneMessage;
  elements.blowButton.focus({ preventScroll: true });
  breathListener?.arm();
  if (breathListener) {
    timer = window.setTimeout(() => {
      stopMicrophone();
      elements.blowNote.textContent = messages.listeningTimeout;
      elements.description.textContent = messages.tapDescription;
    }, 15000);
  }
};

// The number sits on the seedhead itself rather than in a disc of its own, so it has to
// follow the actual flower rather than a guessed percentage of the viewport.
const placeCountdown = () => {
  const point = meadow?.head();
  if (!point) return;
  elements.countdown.style.left = `${point.x}px`;
  elements.countdown.style.top = `${point.y}px`;
};

const beginCountdown = () => {
  clearTimeout(timer);
  phase = 'countdown';
  setScene('countdown');
  setControls();
  meadow?.setState({ growth: 1 });
  sound?.setGrowth(1);
  placeCountdown();
  elements.cancelButton.focus({ preventScroll: true });
  let count = 3;
  const tick = () => {
    if (phase !== 'countdown') return;
    if (!count) {
      beginListening();
      return;
    }
    elements.countdown.textContent = String(count);
    if (!reducedMotion.matches) elements.countdown.animate([{ opacity: 0, scale: '.88' }, { opacity: 1, scale: '1' }], { duration: 450, easing: 'ease-out' });
    count -= 1;
    timer = window.setTimeout(tick, 1000);
  };
  tick();
};

const requestMicrophone = async () => {
  if (phase !== 'growing' || chapter !== 4) return;
  stopMicrophone();
  const currentRequest = requestId;
  phase = 'permission';
  microphoneMessage = '';
  elements.microphoneNote.textContent = messages.requestingMicrophone;
  setControls();
  try {
    breathListener = createBreathListener({
      onBlow: releaseSeeds,
      // She should see the seedhead answer her before anything is released, so the
      // moment feels like a conversation rather than a trigger being tripped.
      onLevel: (level) => {
        if (phase !== 'listening') return;
        meadow?.setState({ breath: level });
        sound?.setBreath(level);
      },
      onInterrupted: () => {
        stopMicrophone();
        microphoneMessage = messages.microphoneInterrupted;
        if (phase === 'listening') {
          elements.blowNote.textContent = microphoneMessage;
          elements.description.textContent = messages.tapDescription;
        }
      },
    });
    const isReady = await breathListener.ready;
    if (currentRequest !== requestId || !isReady) return;
    beginCountdown();
  } catch (error) {
    if (currentRequest !== requestId) return;
    stopMicrophone();
    microphoneMessage = messages[error.name === 'NotAllowedError' ? 'microphoneDenied' : 'microphoneUnavailable'];
    beginCountdown();
  }
};

const useTap = () => {
  if (!['growing', 'permission'].includes(phase)) return;
  stopMicrophone();
  microphoneMessage = '';
  beginCountdown();
};

const resetJourney = () => {
  clearTimeout(timer);
  clearTimeout(spotTimer);
  cancelAnimationFrame(swellFrame);
  swellFrame = 0;
  cancelAnimationFrame(flightFrame);
  stopMicrophone();
  clearEcho();
  phase = 'growing';
  chapter = -1;
  flightProgress = 0;
  elements.wishInput.value = '';
  elements.microphoneNote.textContent = messages.microphonePrivacy;
  sound?.setFlight(0);
  meadow?.setState({ growth: 0, flight: 0, breath: 0 });
  goToChapter(0, true);
  updateGrowth();
};

// Replay is a loop, not a restart: the camera falls into the seed that just landed,
// the meadow is rebuilt behind the veil while nothing can be seen, and it lifts back
// out of a fresh one. The cut happens at full white, so there is no frame to jar on.
const replay = () => {
  if (replaying) return;
  replaying = true;
  const point = meadow?.landing();
  if (point) elements.meadow.style.transformOrigin = `${point.x}px ${point.y}px`;

  const settle = () => {
    elements.meadow.style.transformOrigin = '';
    replaying = false;
    elements.scrollPrompt.focus({ preventScroll: true });
  };

  if (reducedMotion.matches) {
    resetJourney();
    elements.veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320 }).finished.then(settle, settle);
    return;
  }

  const fading = [elements.storyCopy, sceneControls, elements.replaySpot].filter(Boolean);
  fading.forEach((element) => element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 620, easing: 'ease-in', fill: 'forwards' }));
  const veiling = elements.veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1150, easing: 'ease-in', fill: 'forwards' });
  const dive = elements.meadow.animate([{ scale: '1' }, { scale: '3.4' }], { duration: 1150, easing: 'cubic-bezier(.5,0,.85,.35)', fill: 'forwards' });
  sound?.gust(0.45);

  dive.finished.then(() => {
    fading.forEach((element) => element.getAnimations().forEach((animation) => animation.cancel()));
    dive.cancel();
    resetJourney();
    // settle must hang off the longest animation: clearing transform-origin early would
    // snap the camera to centre while the meadow is still lifting.
    const emerge = elements.meadow.animate([{ scale: '1.14' }, { scale: '1' }], { duration: 1500, easing: 'cubic-bezier(.16,.8,.3,1)' });
    veiling.cancel();
    elements.veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1250, easing: 'ease-out' });
    emerge.finished.then(settle, settle);
  }, settle);
};

const setMuted = (value) => {
  sound?.setMuted(value);
  elements.soundToggle.setAttribute('aria-pressed', String(!value));
};

// The threshold ticks steer nothing. They are a settling-in ritual, and everyone gets
// the identical experience whatever they answer, so no one can accidentally opt out of
// the best version of this. `begin` also supplies the gesture audio needs to start.
const begin = () => {
  if (entered) return;
  entered = true;
  sound?.unlock();
  setMuted(false);
  elements.soundToggle.hidden = !sound;
  document.body.classList.remove('held');
  elements.viewport.dataset.entered = 'true';
  setControls();
  const dismiss = () => { elements.threshold.hidden = true; };
  if (reducedMotion.matches) dismiss();
  else elements.threshold.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' }).finished.then(dismiss, dismiss);
  elements.scrollPrompt.focus({ preventScroll: true });
};

const ticks = () => [elements.optionNoisy, elements.optionPrivate];

// A nudge, never a toll gate: the dialogue only names the boxes back to her and both
// ways out are one tap. It deliberately says nothing about what changes, because that
// copy would give the meadow away before she has seen a single frame of it.
const closeConfirm = () => {
  elements.confirm.hidden = true;
  (ticks().find((input) => !input.checked) || elements.beginButton).focus({ preventScroll: true });
};

const askBeforeBeginning = () => {
  const pending = ticks().filter((input) => !input.checked);
  if (!pending.length) {
    begin();
    return;
  }
  elements.confirmList.textContent = '';
  pending.forEach((input) => {
    const item = document.createElement('li');
    item.textContent = input.closest('.tick').querySelector('span:last-of-type').textContent;
    elements.confirmList.append(item);
  });
  elements.confirm.hidden = false;
  elements.confirmContinue.focus({ preventScroll: true });
};

// Pointer input for the meadow. Every listener is passive and none calls
// preventDefault, so the scroll that drives the whole journey keeps working and a drag
// that happens to pass over the pond simply nudges it along the way.
const meadowPoint = (event) => {
  const bounds = elements.meadow.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
};

if (meadow) {
  window.addEventListener('pointermove', (event) => {
    const point = meadowPoint(event);
    meadow.pointerAt(point.x, point.y, event.pointerType === 'touch' || event.buttons > 0);
  }, { passive: true });
  window.addEventListener('pointerdown', (event) => {
    const point = meadowPoint(event);
    meadow.pointerAt(point.x, point.y, true);
    meadow.poke(point.x, point.y);
  }, { passive: true });
  window.addEventListener('pointerup', (event) => {
    // A finger that lifts is gone; a mouse is still hovering.
    if (event.pointerType === 'touch') {
      meadow.pointerOut();
      return;
    }
    const point = meadowPoint(event);
    meadow.pointerAt(point.x, point.y, false);
  }, { passive: true });
  window.addEventListener('pointercancel', () => meadow.pointerOut(), { passive: true });
  document.addEventListener('pointerleave', () => meadow.pointerOut(), { passive: true });
}

chapterButtons.forEach((button, index) => button.addEventListener('click', () => goToChapter(index)));
elements.scrollPrompt.addEventListener('click', () => goToChapter(Math.min(4, chapter + 1)));
elements.beginButton.addEventListener('click', askBeforeBeginning);
elements.confirmContinue.addEventListener('click', () => {
  elements.confirm.hidden = true;
  begin();
});
elements.confirmBack.addEventListener('click', closeConfirm);
elements.threshold.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.confirm.hidden) closeConfirm();
});
elements.soundToggle.addEventListener('click', () => setMuted(elements.soundToggle.getAttribute('aria-pressed') === 'true'));
elements.microphoneButton.addEventListener('click', requestMicrophone);
elements.tapButton.addEventListener('click', useTap);
elements.blowButton.addEventListener('click', tapRelease);
elements.cancelButton.addEventListener('click', returnToWish);
elements.replaySpot.addEventListener('click', replay);
window.addEventListener('scroll', () => {
  if (!scrollFrame && phase === 'growing') scrollFrame = requestAnimationFrame(updateGrowth);
}, { passive: true });
window.addEventListener('resize', () => {
  measure();
  if (!elements.replaySpot.hidden) placeReplaySpot();
  if (phase === 'countdown') placeCountdown();
}, { passive: true });
window.addEventListener('pagehide', () => {
  stopMicrophone();
  clearTimeout(timer);
  cancelAnimationFrame(flightFrame);
  cancelAnimationFrame(scrollFrame);
  cancelAnimationFrame(swellFrame);
  clearTimeout(spotTimer);
});
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  scrollFrame = 0;
  if (['permission', 'countdown', 'listening'].includes(phase)) returnToWish();
  if (phase === 'flight') {
    lastFlightFrame = 0;
    flightFrame = requestAnimationFrame(animateFlight);
  }
  measure();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (['permission', 'countdown', 'listening'].includes(phase)) returnToWish();
    if (phase === 'flight') cancelAnimationFrame(flightFrame);
  } else if (phase === 'flight') {
    lastFlightFrame = 0;
    flightFrame = requestAnimationFrame(animateFlight);
  }
});
reducedMotion.addEventListener('change', () => meadow?.setState({ motion: !reducedMotion.matches }));
meadow?.setState({ motion: !reducedMotion.matches });
if (!meadow) {
  elements.gentleNote.textContent = messages.canvasFallback;
  console.warn('Canvas 2D is not available in this browser.');
}
// Browsers restore form state across a soft reload; every visit must start fresh.
elements.optionNoisy.checked = false;
elements.optionPrivate.checked = false;
elements.beginButton.focus({ preventScroll: true });
measure();
