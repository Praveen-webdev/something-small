export const createBreathListener = ({ onBlow, onInterrupted, onLevel }) => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !AudioContext) {
    throw new Error('MicrophoneUnavailable');
  }

  const audioContext = new AudioContext();
  let stream;
  let source;
  let analyser;
  let frame = 0;
  let stopped = false;
  let armed = false;
  let baseline = 0.004;
  let aboveThresholdSince = 0;
  let lastSample = 0;
  let level = 0;

  const stop = () => {
    stopped = true;
    armed = false;
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach((track) => track.stop());
    source?.disconnect();
    analyser?.disconnect();
    if (audioContext.state !== 'closed') {
      audioContext.close().catch((error) => console.warn('Unable to close the audio context.', error.name));
    }
  };

  const ready = (async () => {
    try {
      await audioContext.resume();
      if (stopped) return false;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);

      stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => {
        if (stopped) return;
        stop();
        onInterrupted();
      }, { once: true }));

      const sample = (timestamp) => {
        if (stopped) return;
        frame = requestAnimationFrame(sample);
        if (timestamp - lastSample < 32) return;
        lastSample = timestamp;
        analyser.getFloatTimeDomainData(samples);
        let energy = 0;
        for (const value of samples) energy += value * value;
        const volume = Math.sqrt(energy / samples.length);
        if (!armed) {
          baseline = baseline * 0.94 + Math.min(volume, 0.05) * 0.06;
          return;
        }
        const threshold = Math.max(0.018, Math.min(0.12, baseline * 3.2));
        // Reported for the meadow to answer to. Smoothed so the seedhead breathes rather
        // than flickers, and deliberately separate from the release decision below.
        level = level * 0.62 + Math.min(1, volume / (threshold * 1.25)) * 0.38;
        onLevel?.(level);
        if (volume <= threshold) {
          aboveThresholdSince = 0;
          return;
        }
        if (!aboveThresholdSince) aboveThresholdSince = timestamp;
        if (timestamp - aboveThresholdSince >= 180) {
          stop();
          onBlow();
        }
      };

      frame = requestAnimationFrame(sample);
      return true;
    } catch (error) {
      stop();
      throw error;
    }
  })();

  return {
    ready,
    arm: () => {
      armed = true;
      aboveThresholdSince = 0;
    },
    stop,
  };
};
