const clamp = (value) => Math.max(0, Math.min(1, value));

// Swappable audio source. Today the wind is synthesised, so nothing is fetched and
// nothing is shipped. Replacing `buildWind` with a decoded recording is the only
// change required to move to real audio files.
const buildNoise = (context) => {
  const overlap = Math.floor(context.sampleRate * 0.5);
  const length = Math.floor(context.sampleRate * 6);
  const raw = new Float32Array(length + overlap);
  let last = 0;
  for (let index = 0; index < raw.length; index += 1) {
    last = (last + (Math.random() * 2 - 1) * 0.04) / 1.04;
    raw[index] = last * 3.2;
  }
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  channel.set(raw.subarray(0, length));
  // Fold the tail back over the head so the loop point cannot click.
  for (let index = 0; index < overlap; index += 1) {
    const amount = index / overlap;
    channel[index] = channel[index] * amount + raw[length + index] * (1 - amount);
  }
  return buffer;
};

export const createSound = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  let context = null;
  let master = null;
  let windFilter = null;
  let windGain = null;
  let muted = false;
  let growth = 0;
  let flight = 0;

  const apply = () => {
    if (!context) return;
    const now = context.currentTime;
    const presence = clamp(growth * 0.7 + flight * 1.1);
    windGain.gain.setTargetAtTime(muted ? 0 : 0.014 + presence * 0.082, now, 0.7);
    windFilter.frequency.setTargetAtTime(210 + presence * 940, now, 0.9);
  };

  return {
    unlock() {
      if (context) {
        context.resume?.();
        return;
      }
      try {
        context = new AudioContextClass();
      } catch (error) {
        context = null;
        return;
      }
      master = context.createGain();
      master.gain.value = 1;
      master.connect(context.destination);
      windGain = context.createGain();
      windGain.gain.value = 0;
      windFilter = context.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 210;
      windFilter.Q.value = 0.6;
      const wind = context.createBufferSource();
      wind.buffer = buildNoise(context);
      wind.loop = true;
      wind.connect(windFilter).connect(windGain).connect(master);
      wind.start();
      context.resume?.();
      apply();
    },
    setGrowth(value) {
      growth = clamp(value);
      apply();
    },
    setFlight(value) {
      flight = clamp(value);
      apply();
    },
    setMuted(value) {
      muted = Boolean(value);
      apply();
    },
    chime() {
      if (!context || muted) return;
      const now = context.currentTime;
      [880, 1320, 1760].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        const start = now + index * 0.09;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.085 / (index + 1), start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 3.4);
        oscillator.connect(gain).connect(master);
        oscillator.start(start);
        oscillator.stop(start + 3.6);
      });
    },
  };
};
