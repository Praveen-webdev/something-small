import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createBreathListener } from './breath.js';

const createEnvironment = () => {
  const frames = new Map();
  let frameId = 0;
  let amplitude = 0;
  const tracks = Array.from({ length: 2 }, () => Object.assign(new EventTarget(), {
    stop: mock(() => {}),
  }));
  const stream = { getTracks: () => tracks, getAudioTracks: () => tracks };
  const source = { connect: mock(() => {}), disconnect: mock(() => {}) };
  const analyser = {
    fftSize: 0,
    disconnect: mock(() => {}),
    getFloatTimeDomainData: mock((samples) => {
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = index % 2 ? amplitude : -amplitude;
      }
    }),
  };
  const audioContext = {
    state: 'running',
    resume: mock(async () => {}),
    close: mock(async () => { audioContext.state = 'closed'; }),
    createMediaStreamSource: mock(() => source),
    createAnalyser: mock(() => analyser),
  };
  const AudioContext = mock(() => audioContext);
  const getUserMedia = mock(async () => stream);
  const requestAnimationFrame = mock((callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  const cancelAnimationFrame = mock((id) => { frames.delete(id); });
  const callbacks = { onBlow: mock(() => {}), onInterrupted: mock(() => {}) };
  const tick = (timestamp, volume) => {
    amplitude = volume;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(timestamp));
  };
  return {
    frames, tracks, stream, source, analyser, audioContext, AudioContext,
    getUserMedia, requestAnimationFrame, cancelAnimationFrame, callbacks, tick,
  };
};

describe('createBreathListener', () => {
  let environment;
  let originals;
  let listeners;

  beforeEach(() => {
    environment = createEnvironment();
    listeners = [];
    const globals = {
      window: { isSecureContext: true, AudioContext: environment.AudioContext },
      navigator: { mediaDevices: { getUserMedia: environment.getUserMedia } },
      requestAnimationFrame: environment.requestAnimationFrame,
      cancelAnimationFrame: environment.cancelAnimationFrame,
    };
    originals = Object.keys(globals).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
    Object.entries(globals).forEach(([name, value]) => {
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    });
  });

  afterEach(async () => {
    try {
      listeners.forEach((listener) => listener.stop());
      await Promise.allSettled(listeners.map((listener) => listener.ready));
    } finally {
      originals.forEach(([name, descriptor]) => {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      });
    }
  });

  const start = () => {
    const listener = createBreathListener(environment.callbacks);
    listeners.push(listener);
    return listener;
  };

  const expectStopped = () => {
    expect(environment.frames.size).toBe(0);
    expect(environment.audioContext.close).toHaveBeenCalledTimes(1);
    expect(environment.audioContext.state).toBe('closed');
    expect(environment.source.disconnect).toHaveBeenCalledTimes(1);
    expect(environment.analyser.disconnect).toHaveBeenCalledTimes(1);
    environment.tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
  };

  test.each([
    ['insecure context', () => { window.isSecureContext = false; }],
    ['missing mediaDevices', () => { navigator.mediaDevices = undefined; }],
    ['missing getUserMedia', () => { navigator.mediaDevices = {}; }],
    ['missing AudioContext', () => { window.AudioContext = undefined; }],
  ])('rejects %s before opening audio or requesting permission', (_, configure) => {
    configure();
    expect(start).toThrow('MicrophoneUnavailable');
    expect(environment.AudioContext).not.toHaveBeenCalled();
    expect(environment.audioContext.resume).not.toHaveBeenCalled();
    expect(environment.getUserMedia).not.toHaveBeenCalled();
    expect(environment.requestAnimationFrame).not.toHaveBeenCalled();
  });

  test('supports the prefixed AudioContext fallback', async () => {
    window.webkitAudioContext = window.AudioContext;
    delete window.AudioContext;
    await expect(start().ready).resolves.toBe(true);
    expect(environment.AudioContext).toHaveBeenCalledTimes(1);
  });

  test('closes the audio context and preserves the permission denial', async () => {
    const error = new DOMException('Permission denied', 'NotAllowedError');
    environment.getUserMedia.mockRejectedValueOnce(error);
    await expect(start().ready).rejects.toBe(error);
    expect(environment.audioContext.close).toHaveBeenCalledTimes(1);
    expect(environment.audioContext.state).toBe('closed');
    expect(environment.audioContext.createMediaStreamSource).not.toHaveBeenCalled();
    expect(environment.audioContext.createAnalyser).not.toHaveBeenCalled();
    expect(environment.requestAnimationFrame).not.toHaveBeenCalled();
    expect(environment.callbacks.onBlow).not.toHaveBeenCalled();
    expect(environment.callbacks.onInterrupted).not.toHaveBeenCalled();
  });

  test('stops a late permission stream and resolves false after being stopped', async () => {
    const permission = Promise.withResolvers();
    environment.getUserMedia.mockReturnValueOnce(permission.promise);
    const listener = start();
    try {
      await Promise.resolve();
      expect(environment.getUserMedia).toHaveBeenCalledTimes(1);
      listener.stop();
      expect(environment.audioContext.close).toHaveBeenCalledTimes(1);
      permission.resolve(environment.stream);
      await expect(listener.ready).resolves.toBe(false);
      environment.tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
      expect(environment.audioContext.createMediaStreamSource).not.toHaveBeenCalled();
      expect(environment.audioContext.createAnalyser).not.toHaveBeenCalled();
      expect(environment.requestAnimationFrame).not.toHaveBeenCalled();
      expect(environment.callbacks.onBlow).not.toHaveBeenCalled();
      expect(environment.callbacks.onInterrupted).not.toHaveBeenCalled();
    } finally {
      permission.resolve(environment.stream);
      await listener.ready;
    }
  });

  test('calibrates while unarmed and keeps the calibrated threshold when armed', async () => {
    const listener = start();
    await listener.ready;
    for (let timestamp = 32; timestamp <= 2560; timestamp += 32) {
      environment.tick(timestamp, 0.03);
    }
    expect(environment.callbacks.onBlow).not.toHaveBeenCalled();
    listener.arm();
    for (let timestamp = 2592; timestamp <= 2816; timestamp += 32) {
      environment.tick(timestamp, 0.05);
    }
    expect(environment.callbacks.onBlow).not.toHaveBeenCalled();
    const staleFrame = environment.frames.values().next().value;
    for (let timestamp = 2848; timestamp <= 3072; timestamp += 32) {
      environment.tick(timestamp, 0.1);
    }
    staleFrame(3200);
    expect(environment.callbacks.onBlow).toHaveBeenCalledTimes(1);
    expect(environment.callbacks.onInterrupted).not.toHaveBeenCalled();
    expectStopped();
  });

  test.each([[179, 0], [180, 1]])('after %d ms above threshold, triggers %d times', async (duration, count) => {
    const listener = start();
    await listener.ready;
    listener.arm();
    [32, 64, 96, 128, 160].forEach((timestamp) => environment.tick(timestamp, 0.08));
    expect(environment.callbacks.onBlow).not.toHaveBeenCalled();
    environment.tick(32 + duration, 0.08);
    expect(environment.callbacks.onBlow).toHaveBeenCalledTimes(count);
    expect(environment.audioContext.close).toHaveBeenCalledTimes(count);
  });

  test('ignores sustained low RMS and resets the duration when a loud burst drops below threshold', async () => {
    const listener = start();
    await listener.ready;
    listener.arm();
    [32, 64, 96, 128, 160, 192, 224, 256].forEach((timestamp) => environment.tick(timestamp, 0.017));
    expect(environment.callbacks.onBlow).not.toHaveBeenCalled();
    [288, 320, 352, 384, 416].forEach((timestamp) => environment.tick(timestamp, 0.08));
    environment.tick(448, 0.017);
    [480, 512, 544, 576, 608, 640].forEach((timestamp) => environment.tick(timestamp, 0.08));
    expect(environment.callbacks.onBlow).not.toHaveBeenCalled();
    environment.tick(672, 0.08);
    expect(environment.callbacks.onBlow).toHaveBeenCalledTimes(1);
  });

  test('stop cancels the queued frame, stops tracks, disconnects nodes and closes audio', async () => {
    const listener = start();
    await expect(listener.ready).resolves.toBe(true);
    expect(environment.audioContext.resume).toHaveBeenCalledTimes(1);
    expect(environment.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
    expect(environment.audioContext.createMediaStreamSource).toHaveBeenCalledWith(environment.stream);
    expect(environment.source.connect).toHaveBeenCalledWith(environment.analyser);
    expect(environment.analyser.fftSize).toBe(2048);
    listener.arm();
    environment.tick(32, 0.08);
    const [[frameId, staleFrame]] = environment.frames;
    const requestedFrames = environment.requestAnimationFrame.mock.calls.length;
    listener.stop();
    expect(environment.cancelAnimationFrame).toHaveBeenCalledWith(frameId);
    staleFrame(300);
    expect(environment.requestAnimationFrame).toHaveBeenCalledTimes(requestedFrames);
    expect(environment.analyser.getFloatTimeDomainData).toHaveBeenCalledTimes(1);
    expect(environment.callbacks.onBlow).not.toHaveBeenCalled();
    expect(environment.callbacks.onInterrupted).not.toHaveBeenCalled();
    expectStopped();
  });

  test('an interrupted track notifies once and stops every track', async () => {
    const listener = start();
    await listener.ready;
    listener.arm();
    const frameId = environment.frames.keys().next().value;
    environment.tracks[0].dispatchEvent(new Event('ended'));
    environment.tracks[1].dispatchEvent(new Event('ended'));
    environment.tracks[0].dispatchEvent(new Event('ended'));
    expect(environment.callbacks.onInterrupted).toHaveBeenCalledTimes(1);
    expect(environment.callbacks.onBlow).not.toHaveBeenCalled();
    expect(environment.cancelAnimationFrame).toHaveBeenCalledWith(frameId);
    expectStopped();
  });
});
