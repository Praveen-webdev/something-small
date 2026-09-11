import { createMeadow } from './meadow.js';
import { createBreathListener } from './breath.js';

const elements = Object.fromEntries([
  'journey', 'viewport', 'meadow', 'story-copy', 'eyebrow', 'title-line', 'title-accent',
  'description', 'wish-field', 'wish-input', 'grow-controls', 'gentle-note', 'scroll-prompt',
  'scroll-label', 'wish-controls', 'microphone-button', 'tap-button', 'microphone-note',
  'blow-controls', 'blow-button', 'blow-note', 'countdown', 'cancel-button',
  'end-controls', 'replay-button', 'wish-shortcut', 'chapter-count',
].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]));
const scenes = Object.fromEntries([...document.querySelectorAll('[data-scene]')].map((element) => [element.dataset.scene, element.dataset]));
const messages = Object.fromEntries([...document.querySelectorAll('[data-message]')].map((element) => [element.dataset.message, element.textContent]));
const chapterButtons = [...document.querySelectorAll('[data-chapter]')];
const chapterPositions = [0, 0.25, 0.5, 0.72, 1];
const chapterScenes = ['intro', 'sprout', 'bloom', 'change', 'wish'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const meadow = createMeadow(elements.meadow);
let phase = 'growing';
let scene = 'intro';
let chapter = 0;
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

const setScene = (nextScene, description) => {
  const content = scenes[nextScene];
  if (scene !== nextScene) {
    scene = nextScene;
    elements.eyebrow.textContent = content.eyebrow;
    elements.titleLine.textContent = content.title;
    elements.titleAccent.textContent = content.accent;
    if (!reducedMotion.matches) {
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

const setControls = () => {
  const isWish = phase === 'growing' && chapter === 4;
  elements.viewport.dataset.phase = phase === 'growing' ? chapterScenes[chapter] : phase;
  elements.growControls.hidden = phase !== 'growing' || isWish;
  elements.wishField.hidden = !isWish && phase !== 'permission';
  elements.wishControls.hidden = !isWish && phase !== 'permission';
  elements.microphoneButton.disabled = phase === 'permission';
  elements.blowControls.hidden = phase !== 'listening';
  elements.countdown.hidden = phase !== 'countdown';
  elements.cancelButton.hidden = !['permission', 'countdown', 'listening'].includes(phase);
  elements.endControls.hidden = phase !== 'end';
};

const updateGrowth = () => {
  scrollFrame = 0;
  if (phase !== 'growing') return;
  growth = Math.max(0, Math.min(1, window.scrollY / scrollRange));
  meadow?.setState({ growth, flight: 0 });
  const nextChapter = growth < 0.07 ? 0 : growth < 0.34 ? 1 : growth < 0.6 ? 2 : growth < 0.93 ? 3 : 4;
  if (chapter !== nextChapter) {
    chapter = nextChapter;
    setScene(chapterScenes[chapter]);
    chapterButtons.forEach((button, index) => {
      if (index === chapter) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    elements.chapterCount.firstChild.textContent = `0${chapter + 1} `;
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
    window.scrollTo({ top: growth * scrollRange, behavior: 'instant' });
  }
  updateGrowth();
};

const returnToWish = () => {
  clearTimeout(timer);
  stopMicrophone();
  phase = 'growing';
  chapter = 4;
  growth = 1;
  elements.microphoneNote.textContent = messages.microphonePrivacy;
  setScene('wish');
  setControls();
  meadow?.setState({ growth: 1, flight: 0 });
  goToChapter(4, true);
  elements.microphoneButton.focus({ preventScroll: true });
};

const finishFlight = () => {
  phase = 'end';
  flightProgress = 1;
  meadow?.setState({ flight: 1 });
  setScene('end');
  setControls();
  elements.replayButton.focus({ preventScroll: true });
};

const animateFlight = (timestamp) => {
  if (phase !== 'flight' || document.hidden) return;
  if (lastFlightFrame) flightTime += Math.min(timestamp - lastFlightFrame, 64);
  lastFlightFrame = timestamp;
  flightProgress = Math.min(1, flightTime / (reducedMotion.matches ? 1800 : 8500));
  meadow?.setState({ flight: flightProgress });
  if (flightProgress >= 1) finishFlight();
  else flightFrame = requestAnimationFrame(animateFlight);
};

const releaseSeeds = () => {
  if (phase !== 'listening') return;
  clearTimeout(timer);
  stopMicrophone();
  elements.wishInput.value = '';
  phase = 'flight';
  flightTime = 0;
  lastFlightFrame = 0;
  flightProgress = 0;
  setScene('flight');
  setControls();
  meadow?.setState({ growth: 1 });
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
  phase = 'growing';
  chapter = -1;
  flightProgress = 0;
  elements.wishInput.value = '';
  elements.microphoneNote.textContent = messages.microphonePrivacy;
  goToChapter(0, true);
  updateGrowth();
  elements.scrollPrompt.focus({ preventScroll: true });
};

chapterButtons.forEach((button, index) => button.addEventListener('click', () => goToChapter(index)));
elements.scrollPrompt.addEventListener('click', () => goToChapter(Math.min(4, chapter + 1)));
elements.wishShortcut.addEventListener('click', () => goToChapter(4));
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
measure();
