import { createMeadow } from './meadow.js';
import { createBreathListener } from './breath.js';
import { createSound } from './sound.js';

const elements = Object.fromEntries([
  'journey', 'viewport', 'meadow', 'story-copy', 'eyebrow', 'title-line', 'title-accent',
  'description', 'wish-field', 'wish-input', 'heart-note', 'grow-controls', 'gentle-note',
  'scroll-prompt', 'scroll-label', 'wish-controls', 'microphone-button', 'microphone-label',
  'tap-button', 'microphone-note', 'blow-controls', 'blow-button', 'blow-note', 'countdown',
  'cancel-button', 'end-controls', 'replay-button', 'wish-echo', 'finale', 'signature',
  'birthday-line', 'brand', 'threshold', 'begin-button', 'option-noisy', 'option-private',
  'sound-toggle', 'confirm', 'confirm-list', 'confirm-continue', 'confirm-back',
].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]));
const scenes = Object.fromEntries([...document.querySelectorAll('[data-scene]')].map((element) => [element.dataset.scene, element.dataset]));
const messages = Object.fromEntries([...document.querySelectorAll('[data-message]')].map((element) => [element.dataset.message, element.textContent]));
const chapterButtons = [...document.querySelectorAll('[data-chapter]')];
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
let noisy = false;
let secret = false;
let revealed = false;
let echoAnimation = null;

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
  elements.wishField.hidden = !wishVisible || secret;
  elements.heartNote.hidden = !wishVisible || !secret;
  elements.wishControls.hidden = !wishVisible;
  elements.microphoneButton.disabled = phase === 'permission';
  elements.blowControls.hidden = phase !== 'listening';
  elements.countdown.hidden = phase !== 'countdown';
  elements.cancelButton.hidden = !['permission', 'countdown', 'listening'].includes(phase);
  elements.endControls.hidden = phase !== 'end';
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
    elements.scrollLabel.textContent = messages[chapter ? 'keepGrowing' : 'scrollHint'];
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
// meadow away. Once shown it stays for the rest of the session; nothing is persisted.
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
  fadeIn(elements.signature, 250);
  fadeIn(elements.birthdayLine, 1500);
  fadeIn(elements.brand, 2400);
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
  elements.replayButton.focus({ preventScroll: true });
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
  if (!wish || secret) return;
  elements.wishEcho.textContent = wish;
  elements.wishEcho.hidden = false;
  if (reducedMotion.matches) {
    echoAnimation = elements.wishEcho.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.25 }, { opacity: 0.85, offset: 0.7 }, { opacity: 0 }], { duration: 1600, easing: 'ease-out' });
  } else {
    echoAnimation = elements.wishEcho.animate([
      { opacity: 0, translate: '0 1.4rem' },
      { opacity: 0.9, translate: '0 0', offset: 0.2 },
      { opacity: 0.82, translate: '0 -1.6rem', offset: 0.62 },
      { opacity: 0, translate: '0 -4rem' },
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
  meadow?.setState({ growth: 1 });
  navigator.vibrate?.(14);
  echoWish(wish);
  flightFrame = requestAnimationFrame(animateFlight);
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

const beginCountdown = () => {
  clearTimeout(timer);
  phase = 'countdown';
  setScene('countdown');
  setControls();
  meadow?.setState({ growth: 1 });
  sound?.setGrowth(1);
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

const replay = () => {
  clearTimeout(timer);
  cancelAnimationFrame(flightFrame);
  stopMicrophone();
  clearEcho();
  phase = 'growing';
  chapter = -1;
  flightProgress = 0;
  elements.wishInput.value = '';
  elements.microphoneNote.textContent = messages.microphonePrivacy;
  sound?.setFlight(0);
  goToChapter(0, true);
  updateGrowth();
  elements.scrollPrompt.focus({ preventScroll: true });
};

const setMuted = (value) => {
  sound?.setMuted(value);
  elements.soundToggle.setAttribute('aria-pressed', String(!value));
};

// "Begin" is never gated on the checkboxes: skipping them costs nothing and yields the
// full experience. It doubles as the gesture browsers require before audio may start.
const begin = () => {
  if (entered) return;
  entered = true;
  noisy = !elements.optionNoisy.checked;
  secret = !elements.optionPrivate.checked;
  if (noisy) {
    elements.microphoneButton.classList.replace('primary-button', 'text-button');
    elements.tapButton.classList.replace('text-button', 'primary-button');
    elements.microphoneLabel.textContent = messages.useMicrophoneSecondary;
    elements.tapButton.textContent = messages.useTapPrimary;
  }
  sound?.unlock();
  // Sound is not tied to the noise tick: noise means the microphone will not hear her
  // breath, which says nothing about whether the wind should play. Mute stays one tap
  // away in the header, and nothing sounds until she has tapped `begin` herself.
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
elements.blowButton.addEventListener('click', releaseSeeds);
elements.cancelButton.addEventListener('click', returnToWish);
elements.replayButton.addEventListener('click', replay);
window.addEventListener('scroll', () => {
  if (!scrollFrame && phase === 'growing') scrollFrame = requestAnimationFrame(updateGrowth);
}, { passive: true });
window.addEventListener('resize', measure, { passive: true });
window.addEventListener('pagehide', () => {
  stopMicrophone();
  clearTimeout(timer);
  cancelAnimationFrame(flightFrame);
  cancelAnimationFrame(scrollFrame);
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
