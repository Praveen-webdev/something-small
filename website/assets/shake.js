// The phone itself moving - a shake, a twist, a quick tilt - pushes the meadow the way a
// finger does. Each reading is turned into a push and dropped; nothing is kept or sent.
//
// iOS hands over motion only after asking, and will only ask from inside a tap, so this
// must be called synchronously from one; `begin` on the threshold is that tap. Android
// asks nothing. Both need HTTPS or localhost, and a desktop simply never sends an event.
export const listenForShake = (onShake) => {
  const Motion = window.DeviceMotionEvent;
  if (!Motion) return;
  // Only used where a device reports no gravity-free acceleration of its own: a slow
  // average of the raw reading stands in for gravity and is taken back off.
  const gravity = { x: 0, y: 0, z: 0, primed: false };

  const onMotion = (event) => {
    let { x, y, z } = event.acceleration || {};
    if (x == null) {
      const raw = event.accelerationIncludingGravity;
      if (raw?.x == null) return;
      if (!gravity.primed) Object.assign(gravity, { x: raw.x, y: raw.y, z: raw.z, primed: true });
      gravity.x += (raw.x - gravity.x) * .08;
      gravity.y += (raw.y - gravity.y) * .08;
      gravity.z += (raw.z - gravity.z) * .08;
      x = raw.x - gravity.x;
      y = raw.y - gravity.y;
      z = raw.z - gravity.z;
    }
    // The sensor reports in the phone's own axes; the meadow wants the screen's, which
    // turn with it in landscape.
    const angle = (screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const across = x * cos - y * sin;
    const down = -(x * sin + y * cos);
    const rate = event.rotationRate || {};
    const alpha = rate.alpha || 0;
    const beta = rate.beta || 0;
    const gamma = rate.gamma || 0;
    // Twisting in the plane of the screen, and turning about its upright.
    const twist = alpha;
    const turn = beta * sin + gamma * cos;
    // Rotation is in degrees a second and acceleration in m/s^2; the weights bring a brisk
    // twist level with a brisk shake. How hard it is moving counts every axis, so no turn
    // of the phone goes unanswered whichever axis a browser reports it on.
    onShake(
      -across + twist * .035 - turn * .02,
      -down,
      Math.hypot(x, y, z || 0) + Math.hypot(alpha, beta, gamma) * .012,
    );
  };

  const start = () => window.addEventListener('devicemotion', onMotion, { passive: true });
  if (typeof Motion.requestPermission === 'function') {
    Motion.requestPermission().then((answer) => {
      if (answer === 'granted') start();
    }, () => {});
  } else {
    start();
  }
};
