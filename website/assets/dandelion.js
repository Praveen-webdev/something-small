import * as THREE from './vendor/three.module.js';

// The dandelion alone is three-dimensional. Everything else in the meadow - sky, hills,
// pond, lotuses, the seeds once they are in flight - stays in the 2D canvas underneath.
// This layer is a transparent WebGL canvas sitting directly on top of that one.
//
// Design units are the same units `drawFlower` in meadow.js works in: the plant is built
// at stem-height 238, then the whole group is scaled by the meadow's `scale`. That is what
// keeps `meadow.head()` - which the countdown pins itself to - correct without change.

const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => { const amount = clamp(value); return amount * amount * (3 - 2 * amount); };
const randomGenerator = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mix = (from, to, amount) => from + (to - from) * amount;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// A ribbon swept along +Y: `profile(t)` gives half-width, `spine(t)` gives the centre line
// offset, `fold(t)` lifts the edges into a channel so the strap is never a flat card.
const ribbon = (segments, columns, profile, spine, fold) => {
  const positions = [];
  const colors = [];
  const indices = [];
  const columnCount = columns.length;
  for (let step = 0; step <= segments; step += 1) {
    const t = step / segments;
    const halfWidth = profile(t);
    const [spineY, spineZ, tint] = spine(t);
    const curl = fold(t);
    for (let column = 0; column < columnCount; column += 1) {
      const across = columns[column];
      positions.push(across * halfWidth, spineY, spineZ + curl * across * across);
      colors.push(tint[0], tint[1], tint[2]);
    }
  }
  for (let step = 0; step < segments; step += 1) {
    for (let column = 0; column < columnCount - 1; column += 1) {
      const a = step * columnCount + column;
      const b = a + columnCount;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const shade = (hex) => { const color = new THREE.Color(hex); return [color.r, color.g, color.b]; };

// A dandelion leaf is runcinate - deep triangular lobes pointing back down towards the
// root. The lobe term is what stops it reading as a generic blade.
const buildLeaf = (random) => {
  const base = shade('#41652f');
  const middle = shade('#7e9b49');
  const tip = shade('#a7b96d');
  const lobes = 3 + Math.floor(random() * 2);
  const skew = .82 + random() * .36;
  return ribbon(
    34,
    [-1, -.62, -.24, 0, .24, .62, 1],
    (t) => {
      const body = Math.sin(Math.pow(t, .62) * Math.PI) * .95 + .05;
      const teeth = Math.abs(Math.sin(t * Math.PI * lobes * skew));
      const cut = .34 + .66 * Math.pow(teeth, .55);
      return (body * cut * .2 + .012) * 83;
    },
    (t) => {
      // The blade arches up out of the rosette and then droops back towards the ground.
      const y = Math.sin(t * 1.42) / Math.sin(1.42) * 83 * .78;
      const z = (1 - Math.cos(t * 1.55)) * 83 * .42;
      const tint = t < .55
        ? [mix(base[0], middle[0], t / .55), mix(base[1], middle[1], t / .55), mix(base[2], middle[2], t / .55)]
        : [mix(middle[0], tip[0], (t - .55) / .45), mix(middle[1], tip[1], (t - .55) / .45), mix(middle[2], tip[2], (t - .55) / .45)];
      return [y, z, tint];
    },
    (t) => -4.6 * (1 - t * .55),
  );
};

// One ray floret: a strap with a squared, five-toothed tip. At full bloom there are a few
// hundred of these and each is only three or four pixels wide, so the teeth read as a
// texture along the rim rather than as detail you can count.
const buildFloret = () => {
  const root = shade('#dda92c');
  const belly = shade('#f7cd3e');
  const edge = shade('#ffea80');
  const geometry = ribbon(
    9,
    [-1, -.34, .34, 1],
    (t) => {
      if (t > .93) return .5 * (1 - (t - .93) / .07 * .35);
      return mix(.34, .5, ease(t * 2.4));
    },
    (t) => {
      const y = t;
      const z = (1 - Math.cos(t * 1.15)) * .34;
      const tint = t < .5
        ? [mix(root[0], belly[0], t * 2), mix(root[1], belly[1], t * 2), mix(root[2], belly[2], t * 2)]
        : [mix(belly[0], edge[0], (t - .5) * 2), mix(belly[1], edge[1], (t - .5) * 2), mix(belly[2], edge[2], (t - .5) * 2)];
      return [y, z, tint];
    },
    () => -.22,
  );
  return geometry;
};

// An involucral bract. These sit under the flower, close over the bud, and reflex right
// back down the stem once the seedhead opens - which is the tell that it is a dandelion
// and not any other yellow composite.
const buildBract = () => {
  const root = shade('#4d703a');
  const tip = shade('#93a95a');
  return ribbon(
    8,
    [-1, -.4, .4, 1],
    (t) => mix(.85, .06, Math.pow(t, 1.35)),
    (t) => {
      const tint = [mix(root[0], tip[0], t), mix(root[1], tip[1], t), mix(root[2], tip[2], t)];
      return [t, (1 - Math.cos(t * .9)) * .5, tint];
    },
    () => -.5,
  );
};

// A single seed, built along +Y: achene, then the long beak, then the pappus umbrella of
// filaments. `aRadial` carries the direction each filament tip should splay in, so the
// whole puff can open from a tight silver bud to full fluff from one uniform, without
// rebuilding two hundred instances of geometry every frame.
const buildSeed = (random) => {
  const positions = [];
  const colors = [];
  const radials = [];
  const indices = [];
  const vertex = (x, y, z, tint, radial) => {
    positions.push(x, y, z);
    colors.push(tint[0], tint[1], tint[2]);
    radials.push(radial[0], radial[1], radial[2]);
    return positions.length / 3 - 1;
  };
  const quad = (a, b, c, d) => indices.push(a, b, c, a, c, d);

  const husk = shade('#9c8a5c');
  const huskLit = shade('#c4b585');
  const beak = shade('#b6b795');
  const down = shade('#ffffff');
  const downSoft = shade('#f6f4e4');

  // Achene and beak share one swept tube so the seed has a continuous silhouette.
  const RADIAL = 5;
  const spine = [
    [0, .0, .0125], [.035, .0, .022], [.085, .0, .017], [.14, .0, .0105],
    [.3, .0, .0072], [.46, .0, .0062], [.6, .0, .0058],
  ];
  const rings = spine.map(([y, , radius], index) => {
    const tint = index < 3 ? (index < 2 ? husk : huskLit) : beak;
    const ring = [];
    for (let step = 0; step < RADIAL; step += 1) {
      const angle = step / RADIAL * Math.PI * 2;
      ring.push(vertex(Math.cos(angle) * radius, y, Math.sin(angle) * radius, tint, [0, 0, 0]));
    }
    return ring;
  });
  for (let index = 0; index < rings.length - 1; index += 1) {
    for (let step = 0; step < RADIAL; step += 1) {
      const next = (step + 1) % RADIAL;
      quad(rings[index][step], rings[index + 1][step], rings[index + 1][next], rings[index][next]);
    }
  }

  // The pappus. Each filament is two crossed strips so it still catches light when it
  // happens to turn edge-on to the camera.
  const FILAMENTS = 14;
  const SEGMENTS = 3;
  for (let index = 0; index < FILAMENTS; index += 1) {
    const angle = index / FILAMENTS * Math.PI * 2 + random() * .18;
    const lean = .66 + random() * .34;
    const reach = .3 + random() * .1;
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    for (let plane = 0; plane < 2; plane += 1) {
      const sideX = plane ? -dirZ : 0;
      const sideZ = plane ? dirX : 0;
      const sideY = plane ? 0 : 1;
      const edge = [];
      for (let step = 0; step <= SEGMENTS; step += 1) {
        const t = step / SEGMENTS;
        const spread = Math.pow(t, .78) * reach * lean;
        const x = dirX * spread;
        const z = dirZ * spread;
        const y = .58 + t * .42 * (1 - lean * .22);
        const halfWidth = mix(.0075, .0022, t);
        const tint = index % 3 ? down : downSoft;
        const radial = [dirX * t * t * .42, -t * t * .12, dirZ * t * t * .42];
        edge.push([
          vertex(x - sideX * halfWidth, y - sideY * halfWidth, z - sideZ * halfWidth, tint, radial),
          vertex(x + sideX * halfWidth, y + sideY * halfWidth, z + sideZ * halfWidth, tint, radial),
        ]);
      }
      for (let step = 0; step < SEGMENTS; step += 1) {
        quad(edge[step][0], edge[step + 1][0], edge[step + 1][1], edge[step][1]);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aRadial', new THREE.Float32BufferAttribute(radials, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

// The stem is swept fresh every frame rather than bent in a shader, because the meadow
// already knows the bend as a number and 48 rings of 9 is far too little geometry to be
// worth the indirection. Frames are parallel-transported so the taper never twists.
const createStem = (rings, radial) => {
  const positions = new Float32Array((rings + 1) * radial * 3);
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute('position', attribute);
  const indices = [];
  for (let ring = 0; ring < rings; ring += 1) {
    for (let step = 0; step < radial; step += 1) {
      const next = (step + 1) % radial;
      const a = ring * radial + step;
      const b = ring * radial + next;
      const c = (ring + 1) * radial + step;
      const d = (ring + 1) * radial + next;
      indices.push(a, c, d, a, d, b);
    }
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3(1, 0, 0);
  const binormal = new THREE.Vector3();
  const scratch = new THREE.Vector3();

  const sweep = (curve, radiusAt) => {
    normal.set(1, 0, 0);
    for (let ring = 0; ring <= rings; ring += 1) {
      const t = ring / rings;
      curve.getPoint(t, point);
      curve.getTangent(t, tangent).normalize();
      scratch.copy(normal).addScaledVector(tangent, -normal.dot(tangent));
      if (scratch.lengthSq() < 1e-6) scratch.set(tangent.y, -tangent.x, 0);
      normal.copy(scratch).normalize();
      binormal.crossVectors(tangent, normal).normalize();
      const radius = radiusAt(t);
      for (let step = 0; step < radial; step += 1) {
        const angle = step / radial * Math.PI * 2;
        const offsetX = Math.cos(angle) * radius;
        const offsetY = Math.sin(angle) * radius;
        const index = (ring * radial + step) * 3;
        positions[index] = point.x + normal.x * offsetX + binormal.x * offsetY;
        positions[index + 1] = point.y + normal.y * offsetX + binormal.y * offsetY;
        positions[index + 2] = point.z + normal.z * offsetX + binormal.z * offsetY;
      }
    }
    attribute.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  };

  return { geometry, sweep };
};

// Stage thresholds are lifted verbatim from `drawFlower` in meadow.js. They are not free
// numbers: DECISIONS.md 6 locks the chapter cut points to them, so the copy that says
// "not every ending is an ending" still lands on a flower that has just gone over.
const stageOf = (growth) => {
  const open = ease((growth - .37) / .1);
  const close = ease((growth - .55) / .06);
  return {
    stem: ease((growth - .035) / .28),
    leaves: ease((growth - .01) / .21),
    maturity: ease((growth - .13) / .14),
    bud: ease((growth - .23) / .14),
    bloom: open * (1 - close),
    reclose: ease((growth - .65) / .12),
    whiten: ease((growth - .655) / .085),
    puff: ease((growth - .77) / .21),
  };
};

const spring = (current, target, velocity, omega, delta) => {
  const next = velocity + ((target - current) * omega * omega - 2 * omega * velocity) * delta;
  return [current + next * delta, next];
};

const sampleText = (text, font, maxWidth, lineHeight) => {
  const sheet = document.createElement('canvas');
  const ink = sheet.getContext('2d', { willReadFrequently: true });
  if (!ink) return null;
  ink.font = font;
  const lines = [];
  let line = '';
  text.split(/\s+/).forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && ink.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  if (!lines.length) return null;
  const width = Math.ceil(Math.min(maxWidth, Math.max(...lines.map((entry) => ink.measureText(entry).width)))) + 6;
  const height = Math.ceil(lines.length * lineHeight) + 6;
  sheet.width = width;
  sheet.height = height;
  ink.font = font;
  ink.textAlign = 'center';
  ink.textBaseline = 'middle';
  ink.fillStyle = '#000';
  lines.forEach((entry, index) => ink.fillText(entry, width / 2, (index + .5) * lineHeight + 3));
  const pixels = ink.getImageData(0, 0, width, height).data;
  const points = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 80) points.push(x - width / 2, y - height / 2);
    }
  }
  if (!points.length) return null;
  // A long wish can run to many thousands of motes. Thin them evenly rather than letting
  // the count run away.
  const LIMIT = 4200;
  const total = points.length / 2;
  if (total <= LIMIT) return points;
  const thinned = [];
  const stride = total / LIMIT;
  for (let index = 0; index < LIMIT; index += 1) {
    const source = Math.floor(index * stride) * 2;
    thinned.push(points[source], points[source + 1]);
  }
  return thinned;
};

export const createDandelion = (canvas) => {
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    return null;
  }
  if (!renderer) return null;
  renderer.setClearAlpha(0);

  const DEPTH = 1250;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 20, DEPTH * 3);
  camera.position.set(0, 0, DEPTH);

  scene.add(new THREE.HemisphereLight(0xfff6dd, 0x7d9355, 1.35));
  const key = new THREE.DirectionalLight(0xfff0c6, 1.75);
  key.position.set(-520, 900, 720);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd5e6ff, .5);
  rim.position.set(640, 180, -780);
  scene.add(rim);

  const radial = (color, power) => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0 }, uPower: { value: power } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uAlpha;
      uniform float uPower;
      varying vec2 vUv;
      void main() {
        float fall = pow(clamp(1. - length(vUv - .5) * 2., 0., 1.), uPower);
        float amount = fall * uAlpha;
        if (amount < .004) discard;
        gl_FragColor = vec4(uColor, amount);
      }
    `,
  });

  // Backlight. Real down is mostly lit from behind, which is why a dandelion clock glows
  // rather than simply being pale.
  const back = new THREE.DirectionalLight(0xfff2cf, 1.15);
  back.position.set(120, 620, -980);
  scene.add(back);

  const haloMaterial = radial(0xfff6d8, 1.7);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloMaterial);
  halo.frustumCulled = false;
  scene.add(halo);
  const haloGold = new THREE.Color(0xffdf92);
  const haloWhite = new THREE.Color(0xfff8e2);

  const groundMaterial = radial(0x3d5c2c, 1.35);
  const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMaterial);
  groundShadow.frustumCulled = false;

  const random = randomGenerator(20609);
  const plant = new THREE.Group();
  scene.add(plant);
  plant.add(groundShadow);

  const leafMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .74, metalness: 0, side: THREE.DoubleSide });
  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x57763f, roughness: .68, metalness: 0 });
  const floretMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .52, metalness: 0, side: THREE.DoubleSide, emissive: 0xf0b62e, emissiveIntensity: .3 });
  const bractMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, metalness: 0, side: THREE.DoubleSide });
  const seedMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide, emissive: 0xfffef5, emissiveIntensity: .58 });
  const splay = { value: 0 };
  seedMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uSplay = splay;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRadial;\nuniform float uSplay;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += aRadial * uSplay;');
  };

  // --- the rosette -------------------------------------------------------------------
  const LEAVES = 7;
  const leaves = [];
  for (let index = 0; index < LEAVES; index += 1) {
    const mesh = new THREE.Mesh(buildLeaf(random), leafMaterial);
    const angle = index / LEAVES * Math.PI * 2 + random() * .35;
    const pitch = .98 + random() * .46;
    mesh.rotation.set(pitch, angle, 0, 'YXZ');
    mesh.userData.reach = .88 + random() * .42;
    mesh.userData.phase = random() * Math.PI * 2;
    mesh.userData.pitch = pitch;
    mesh.userData.angle = angle;
    plant.add(mesh);
    leaves.push(mesh);
  }

  // --- the stem ----------------------------------------------------------------------
  const stem = createStem(46, 9);
  const stemMesh = new THREE.Mesh(stem.geometry, stemMaterial);
  stemMesh.frustumCulled = false;
  plant.add(stemMesh);
  const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());

  // --- the head ----------------------------------------------------------------------
  const crown = new THREE.Group();
  plant.add(crown);

  const receptacle = new THREE.Mesh(
    new THREE.SphereGeometry(9.2, 20, 12, 0, Math.PI * 2, 0, Math.PI * .58),
    new THREE.MeshStandardMaterial({ color: 0x9aae61, roughness: .85, metalness: 0 }),
  );
  receptacle.position.y = -1.5;
  crown.add(receptacle);

  const budMaterial = new THREE.MeshStandardMaterial({ color: 0x7e9c48, roughness: .78, metalness: 0 });
  const budBody = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), budMaterial);
  crown.add(budBody);
  const budGreen = new THREE.Color(0x7e9c48);
  const budSilver = new THREE.Color(0xdedbc1);

  const BRACTS = 18;
  const bractMesh = new THREE.InstancedMesh(buildBract(), bractMaterial, BRACTS);
  bractMesh.frustumCulled = false;
  crown.add(bractMesh);

  const FLORETS = 430;
  const floretMesh = new THREE.InstancedMesh(buildFloret(), floretMaterial, FLORETS);
  floretMesh.frustumCulled = false;
  crown.add(floretMesh);

  const FLY = 72;
  const flyGeometry = buildSeed(randomGenerator(7741));
  const flyMesh = new THREE.InstancedMesh(flyGeometry, seedMaterial, FLY);
  flyMesh.frustumCulled = false;
  scene.add(flyMesh);
  // The one seed the eye follows, the one that lands and sprouts.
  const hero = new THREE.Mesh(flyGeometry, seedMaterial);
  hero.frustumCulled = false;
  scene.add(hero);

  const SEEDS = 264;
  const seedMesh = new THREE.InstancedMesh(buildSeed(random), seedMaterial, SEEDS);
  seedMesh.frustumCulled = false;
  crown.add(seedMesh);

  // Per-instance constants, worked out once. Only the matrices move each frame.
  const florets = [];
  for (let index = 0; index < FLORETS; index += 1) {
    const ratio = Math.sqrt((index + .5) / FLORETS);
    florets.push({
      ratio,
      angle: index * GOLDEN_ANGLE,
      length: mix(41, 57, Math.pow(ratio, .5)) * (.9 + random() * .2),
      // The outermost ring opens first and the centre unpacks last, which is the way a
      // dandelion actually comes out.
      delay: (1 - ratio) * .52,
      jitter: random() * .14 - .07,
    });
  }
  const flyers = [];
  for (let index = 0; index < FLY; index += 1) {
    flyers.push({
      angle: random() * Math.PI * 2,
      radius: Math.sqrt(random()) * 53,
      delay: random() * .19,
      span: .55 + random() * .2,
      speed: .65 + random() * .8,
      rise: .15 + random() * .3,
      size: 17 + random() * 14,
      // Some seeds come towards the reader and some go away behind the plant. That is the
      // whole reason to do this in three dimensions rather than scatter sprites.
      depth: 40 + random() * 118,
      drift: (random() - .5) * 460,
      spin: new THREE.Vector3(random() - .5, random() - .5, random() - .5).normalize(),
      phase: random() * Math.PI * 2,
    });
  }

  const seeds = [];
  for (let index = 0; index < SEEDS; index += 1) {
    const level = (index + .5) / SEEDS;
    const y = mix(-.42, 1, level);
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    seeds.push({
      direction: new THREE.Vector3(Math.cos(index * GOLDEN_ANGLE) * ring, y, Math.sin(index * GOLDEN_ANGLE) * ring),
      delay: level * .12 + random() * .1,
      length: .88 + random() * .24,
      leaves: random(),
      phase: random() * Math.PI * 2,
    });
  }

  // Her words come apart into down and go with the seeds. Every mote carries its own
  // seed value, so the whole drift, stagger and fade happens in the vertex shader and the
  // CPU does nothing per frame - which is what keeps it smooth under everything else
  // already running during the flight.
  const wishMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uProgress: { value: 0 },
      uSize: { value: 3 },
      uDepth: { value: DEPTH },
      uSpan: { value: new THREE.Vector2(240, 150) },
      uColor: { value: new THREE.Color(0xfdfbec) },
      uInk: { value: new THREE.Color(0x2c4634) },
    },
    vertexShader: `
      attribute float aSeed;
      uniform float uProgress;
      uniform float uSize;
      uniform float uDepth;
      uniform vec2 uSpan;
      varying float vFade;
      varying float vLocal;
      void main() {
        float local = clamp((uProgress - aSeed * .3) / .7, 0., 1.);
        vLocal = local;
        float lift = local * local;
        vec3 shifted = position;
        shifted.x += lift * uSpan.x * (.55 + aSeed);
        shifted.y += lift * uSpan.y * (.5 + aSeed * .9) + sin(local * 7. + aSeed * 12.) * 9.;
        shifted.z += sin(local * 5. + aSeed * 9.) * 40.;
        vFade = 1. - smoothstep(.38, 1., local);
        vec4 viewed = modelViewMatrix * vec4(shifted, 1.);
        // Ink is tight; down is fluffier. The mote swells a little as it changes.
        gl_PointSize = uSize * (1. + local * .55) * (uDepth / max(1., -viewed.z));
        gl_Position = projectionMatrix * viewed;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uInk;
      varying float vFade;
      varying float vLocal;
      void main() {
        float edge = smoothstep(.5, .08, length(gl_PointCoord - .5));
        if (edge * vFade < .004) discard;
        gl_FragColor = vec4(mix(uInk, uColor, smoothstep(0., .5, vLocal)), edge * vFade);
      }
    `,
  });
  let wishCloud = null;
  let wishProgress = 1;

  // --- per-frame state ---------------------------------------------------------------
  const state = { growth: 0, flight: 0, breath: 0, motion: true, bend: 0 };
  const shown = { growth: 0, breath: 0, bend: 0 };
  const velocity = { growth: 0, breath: 0, bend: 0 };
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let time = 0;
  let frame = 0;
  let last = 0;
  let lost = false;
  let destroyed = false;
  let lastFade = 1;
  let blank = false;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scaleVector = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const HIDDEN = new THREE.Vector3(0, -99999, 0);

  const hide = (mesh, index) => {
    matrix.compose(HIDDEN, quaternion.identity(), scaleVector.set(.0001, .0001, .0001));
    mesh.setMatrixAt(index, matrix);
  };

  const paint = (delta) => {
    const stage = stageOf(shown.growth);
    const landscape = width > height * 1.7 && height < 500;
    const scale = height / 800 * (width < 600 ? .92 : 1);
    const baseX = width * (landscape ? .72 : .5);
    const baseY = height * .88;
    const stemHeight = (landscape ? 350 : 238) * stage.stem;
    const breath = shown.breath;
    const sway = state.motion ? Math.sin(time * .0008) * 3 + Math.sin(time * .0013) : 0;
    const swayZ = state.motion ? Math.sin(time * .0011 + 1.7) * 2.4 : 0;
    const tremble = breath && state.motion ? (Math.sin(time * .022) * 2.4 + Math.sin(time * .039) * 1.2) * breath : 0;
    const bend = shown.bend;

    plant.position.set(baseX - width / 2, height / 2 - baseY, 0);
    plant.scale.setScalar(scale);
    const fade = 1 - ease((state.flight - .8) / .2);
    if (fade !== lastFade) {
      canvas.style.opacity = fade === 1 ? '' : String(fade);
      lastFade = fade;
    }
    if (wishCloud && wishProgress < 1) {
      wishProgress = Math.min(1, wishProgress + delta / 3.4);
      wishMaterial.uniforms.uProgress.value = wishProgress;
      wishMaterial.uniforms.uSize.value = 3.6 * pixelRatio * (height / 800);
      wishMaterial.uniforms.uSpan.value.set(width * .34, height * .2);
      if (wishProgress >= 1) {
        scene.remove(wishCloud);
        wishCloud.geometry.dispose();
        wishCloud = null;
      }
    }

    const headX = sway + stage.stem * 7 + breath * 10 + tremble + bend;
    const headWorldX = baseX + headX * scale - width / 2;
    const headWorldY = height / 2 - (baseY - stemHeight * scale);
    const headWorldZ = (6 + swayZ * 1.4 + breath * 5) * scale;
    const flying = state.flight > 0;
    flyMesh.visible = flying;
    hero.visible = flying && state.flight < .97;
    if (flying) {
      for (let index = 0; index < FLY; index += 1) {
        const flyer = flyers[index];
        const progress = clamp((state.flight - flyer.delay) / flyer.span);
        if (state.flight < flyer.delay || progress >= 1) {
          hide(flyMesh, index);
          continue;
        }
        const spread = flyer.radius * scale;
        position.set(
          headWorldX + Math.cos(flyer.angle) * spread + Math.pow(progress, .75) * width * flyer.speed,
          headWorldY + Math.sin(flyer.angle) * spread + Math.sin(progress * Math.PI * .8) * height * flyer.rise - Math.sin(progress * 8 + index) * 15,
          headWorldZ + Math.sin(progress * 5 + flyer.phase) * flyer.depth + progress * flyer.drift,
        );
        quaternion.setFromAxisAngle(flyer.spin, flyer.phase + progress * 9);
        const size = flyer.size * scale;
        matrix.compose(position, quaternion, scaleVector.set(size, size, size));
        flyMesh.setMatrixAt(index, matrix);
      }
      flyMesh.instanceMatrix.needsUpdate = true;

      if (hero.visible) {
        // The same arc the 2D layer flew, lifted into world space and bowed towards the
        // reader through the middle of the journey.
        const p = ease(clamp((state.flight - .06) / .9));
        const q = 1 - p;
        const landingX = width * (landscape ? .5 : width < 600 ? .83 : .66);
        const landingY = height * .87;
        const acrossOf = (value) => value - width / 2;
        const upOf = (value) => height / 2 - value;
        hero.position.set(
          q ** 3 * acrossOf(baseX + headX * scale + 20 * scale) + 3 * q * q * p * acrossOf(width * .93) + 3 * q * p * p * acrossOf(width * 1.02) + p ** 3 * acrossOf(landingX),
          q ** 3 * upOf(baseY - stemHeight * scale - 20 * scale) + 3 * q * q * p * upOf(height * .12) + 3 * q * p * p * upOf(height * .5) + p ** 3 * upOf(landingY - 22 * scale),
          q ** 3 * headWorldZ + 3 * q * q * p * 300 + 3 * q * p * p * 150,
        );
        hero.quaternion.setFromAxisAngle(axis.set(.35, .5, .79).normalize(), .6 + p * 7);
        hero.scale.setScalar(42 * scale);
      }
    }

    // The light through the head: warm gold behind the flower, near-white behind the
    // clock, and nothing at all while it is a shut bud.
    const glow = Math.max(stage.puff * .5, stage.bloom * .26) * fade * (1 - state.flight * .85);
    halo.visible = glow > .004 && stage.maturity > .2;
    if (halo.visible) {
      const reach = mix(250, 340, stage.puff) * stage.maturity * scale;
      halo.position.set(headWorldX, headWorldY, headWorldZ - 34 * scale);
      halo.scale.set(reach, reach, 1);
      haloMaterial.uniforms.uAlpha.value = glow;
      haloMaterial.uniforms.uColor.value.copy(stage.puff > .3 ? haloWhite : haloGold);
    }

    plant.visible = shown.growth > .008 && fade > .002;
    if (!plant.visible) return flying || Boolean(wishCloud);

    const leafAmount = stage.leaves;
    groundShadow.visible = leafAmount > .02;
    if (groundShadow.visible) {
      groundShadow.position.set(bend * .18, 3, -3);
      groundShadow.scale.set(178 * leafAmount, 34 * leafAmount, 1);
      groundMaterial.uniforms.uAlpha.value = .15 * leafAmount;
    }

    // Leaves.
    leaves.forEach((leaf, index) => {
      leaf.visible = leafAmount > .01;
      if (!leaf.visible) return;
      const drift = state.motion ? Math.sin(time * .0009 + leaf.userData.phase) * .045 : 0;
      leaf.scale.setScalar(leafAmount * leaf.userData.reach);
      leaf.rotation.set(leaf.userData.pitch + drift, leaf.userData.angle + drift * .4, 0, 'YXZ');
    });

    // Stem. The control points mirror the 2D bezier so the plant keeps the same posture
    // it always had, with a little depth added on the z axis.
    curve.v0.set(0, 0, 0);
    curve.v1.set(-9 + bend * .12, stemHeight * .35, 4 + swayZ * .3);
    curve.v2.set(15 + sway + bend * .5, stemHeight * .66, -3 + swayZ);
    curve.v3.set(headX, stemHeight, 6 + swayZ * 1.4 + breath * 5);
    stemMesh.visible = stemHeight > 1;
    if (stemMesh.visible) stem.sweep(curve, (t) => mix(3.5, 2.0, ease(t * 1.1)) * mix(.55, 1, ease(stage.stem * 3)));

    // The head rides the end of the stem, tilted towards the viewer so the bloom and the
    // clock are seen into rather than edge-on.
    curve.getPoint(1, tip);
    curve.getTangent(1, tangent).normalize();
    crown.position.copy(tip);
    crown.scale.setScalar(stage.maturity);
    crown.visible = stage.maturity > .01 && stemMesh.visible;
    const tilt = mix(.09, .04, stage.puff);
    quaternion.setFromUnitVectors(UP, tangent);
    axis.set(1, 0, 0).applyQuaternion(quaternion);
    crown.quaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(axis.set(1, 0, 0), tilt));
    if (!crown.visible) return true;

    receptacle.visible = stage.puff > .02 || stage.bloom > .02;

    // Bracts: closed over the bud, flared under the open flower, reflexed hard down the
    // stem once the clock is out.
    const flare = Math.max(stage.bloom * .8, ease((shown.growth - .745) / .075));
    for (let index = 0; index < BRACTS; index += 1) {
      const angle = index / BRACTS * Math.PI * 2;
      const outer = index % 2;
      const reflex = mix(.04, outer ? 2.62 : 2.12, flare);
      euler.set(reflex, angle, 0, 'YXZ');
      position.set(Math.sin(angle) * 3.1, -2.4, Math.cos(angle) * 3.1);
      scaleVector.set(mix(6.6, 4.2, flare) * (outer ? .92 : 1), outer ? 30 : 24, 3);
      matrix.compose(position, quaternion.setFromEuler(euler), scaleVector);
      bractMesh.setMatrixAt(index, matrix);
    }
    bractMesh.instanceMatrix.needsUpdate = true;

    // Ray florets.
    const budShow = shown.growth < .37 ? stage.bud : 0;
    const bloom = Math.max(stage.bloom, budShow * .16);
    floretMesh.visible = bloom > .004 && stage.puff < .02;
    if (floretMesh.visible) {
      for (let index = 0; index < FLORETS; index += 1) {
        const floret = florets[index];
        const grow = ease(clamp((bloom - floret.delay * .35) / .5));
        const fan = ease(clamp((bloom - floret.delay) / (1 - floret.delay * .75)));
        const radius = mix(1.2, 9.6, floret.ratio) * mix(.3, 1, fan);
        const pitch = mix(.07, mix(.3, 1.92, Math.pow(floret.ratio, .82)) + floret.jitter, fan) + Math.sin(time * .0013 + floret.angle) * .012 * (state.motion ? 1 : 0);
        euler.set(pitch, floret.angle, 0, 'YXZ');
        position.set(Math.sin(floret.angle) * radius, mix(12.5, .8, floret.ratio) * mix(.4, 1, fan), Math.cos(floret.angle) * radius);
        const length = floret.length * mix(.45, 1, grow);
        scaleVector.set(5.2, length, 5.2);
        matrix.compose(position, quaternion.setFromEuler(euler), scaleVector);
        floretMesh.setMatrixAt(index, matrix);
      }
      floretMesh.instanceMatrix.needsUpdate = true;
    }

    // The clock. `splay` opens the filament umbrellas from one uniform; the instances only
    // have to travel outwards and grow.
    const puff = stage.puff;
    seedMesh.visible = puff > .004 && state.flight < .97;
    if (seedMesh.visible) {
      splay.value = ease(puff * 1.45);
      const gust = state.motion ? breath : 0;
      // Seeds leave in the same order the 2D layer launches them, so the clock empties as
      // the flight fills up rather than vanishing all at once.
      const flown = state.flight * 1.12;
      for (let index = 0; index < SEEDS; index += 1) {
        const seed = seeds[index];
        if (seed.leaves < flown) {
          hide(seedMesh, index);
          continue;
        }
        const local = ease(clamp((puff - seed.delay) / (.7 - seed.delay * .5)));
        const wobble = state.motion ? Math.sin(time * .0026 + seed.phase) * .035 + gust * Math.sin(time * .019 + seed.phase) * .09 : 0;
        axis.copy(seed.direction).applyAxisAngle(UP, wobble).normalize();
        const reach = mix(3.2, 8.4, local);
        position.copy(axis).multiplyScalar(reach);
        quaternion.setFromUnitVectors(UP, axis);
        const length = mix(14, 56 * seed.length, local) * mix(1, 1.06, gust);
        scaleVector.set(length, length, length);
        matrix.compose(position, quaternion, scaleVector);
        seedMesh.setMatrixAt(index, matrix);
      }
      seedMesh.instanceMatrix.needsUpdate = true;
    }

    // The closed head, both before the flower and again after it. It whitens through the
    // stretch where the 2D layer used to swap a yellow bud for a white one.
    const closed = clamp(1 - bloom * 1.7) * (1 - clamp(puff * 2.4));
    budBody.visible = closed > .02;
    if (budBody.visible) {
      budBody.scale.set(mix(6.5, 10.5, closed), mix(4, 17, closed), mix(6.5, 10.5, closed));
      budBody.position.y = mix(2, 13, closed);
      budMaterial.color.copy(budGreen).lerp(budSilver, stage.whiten * (1 - puff));
    }
    receptacle.scale.setScalar(mix(1, .62, puff));
    return true;
  };

  const render = (timestamp) => {
    frame = 0;
    if (destroyed || lost || document.hidden) return;
    const delta = Math.min((timestamp - last) / 1000, 1 / 30) || 1 / 60;
    last = timestamp;
    if (state.motion) time += delta * 1000;

    if (state.motion) {
      [shown.growth, velocity.growth] = spring(shown.growth, state.growth, velocity.growth, 26, delta);
      [shown.breath, velocity.breath] = spring(shown.breath, state.breath, velocity.breath, 30, delta);
      [shown.bend, velocity.bend] = spring(shown.bend, state.bend, velocity.bend, 22, delta);
    } else {
      shown.growth = state.growth;
      shown.breath = state.breath;
      shown.bend = state.bend;
      velocity.growth = velocity.breath = velocity.bend = 0;
    }

    const drew = paint(delta);
    if (drew || !blank) renderer.render(scene, camera);
    blank = !drew;
    // The wish cloud has to keep its own frames coming: under reduced motion nothing else
    // would ask for them, and the motes would hang in the air half dissolved.
    if (state.motion || wishProgress < 1 || Math.abs(state.growth - shown.growth) > .0002 || Math.abs(velocity.growth) > .0002) {
      frame = requestAnimationFrame(render);
    }
  };

  const wake = () => {
    if (!frame && !destroyed && !lost && !document.hidden) {
      last = performance.now();
      frame = requestAnimationFrame(render);
    }
  };

  const onLost = (event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    frame = 0;
  };
  canvas.addEventListener('webglcontextlost', onLost);

  const onVisibility = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!document.hidden) wake();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    alive: () => !lost && !destroyed,
    resize: (nextWidth, nextHeight, nextRatio) => {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      pixelRatio = nextRatio;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = 2 * Math.atan(height / 2 / DEPTH) * 180 / Math.PI;
      camera.updateProjectionMatrix();
      wake();
    },
    // Called once, as the echo of her wish starts to go. The text is sampled, turned into
    // motes, and dropped; it is never held anywhere.
    dissolveWish: ({ text, font, maxWidth, lineHeight, centreX, centreY, ink }) => {
      if (lost || destroyed || !text) return false;
      const points = sampleText(text, font, maxWidth, lineHeight);
      if (!points) return false;
      if (ink) wishMaterial.uniforms.uInk.value.set(ink);
      const count = points.length / 2;
      const positions = new Float32Array(count * 3);
      const seeds = new Float32Array(count);
      const scatter = randomGenerator(9133);
      for (let index = 0; index < count; index += 1) {
        positions[index * 3] = centreX + points[index * 2] - width / 2;
        positions[index * 3 + 1] = height / 2 - (centreY + points[index * 2 + 1]);
        positions[index * 3 + 2] = (scatter() - .5) * 70;
        seeds[index] = scatter();
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
      if (wishCloud) {
        scene.remove(wishCloud);
        wishCloud.geometry.dispose();
      }
      wishCloud = new THREE.Points(geometry, wishMaterial);
      wishCloud.frustumCulled = false;
      scene.add(wishCloud);
      wishProgress = 0;
      wishMaterial.uniforms.uProgress.value = 0;
      wake();
      return true;
    },
    setState: (next) => {
      if (typeof next.growth === 'number') state.growth = clamp(next.growth);
      if (typeof next.flight === 'number') state.flight = clamp(next.flight);
      if (typeof next.breath === 'number') state.breath = clamp(next.breath);
      if (typeof next.bend === 'number') state.bend = next.bend;
      if (typeof next.motion === 'boolean') state.motion = next.motion;
      wake();
    },
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(frame);
      canvas.removeEventListener('webglcontextlost', onLost);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.dispose();
    },
  };
};
