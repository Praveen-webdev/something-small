import { createDandelion } from './dandelion.js';

const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => { const amount = clamp(value); return amount * amount * (3 - 2 * amount); };
const randomGenerator = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const circle = (context, x, y, radius, color) => {
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, Math.max(0.01, radius), 0, Math.PI * 2);
  context.fill();
};
const ellipse = (context, x, y, radiusX, radiusY, color, rotation = 0) => {
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(x, y, Math.max(0.01, radiusX), Math.max(0.01, radiusY), rotation, 0, Math.PI * 2);
  context.fill();
};

export const createMeadow = (canvas, bloomCanvas) => {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return null;
  // The dandelion itself is drawn in WebGL on its own transparent canvas above this
  // one. If that canvas is missing or WebGL is unavailable the 2D plant below is still
  // here and takes over, so the page never loses its flower.
  const dandelion = bloomCanvas ? createDandelion(bloomCanvas) : null;
  const flat = () => !dandelion || !dandelion.alive();
  const background = document.createElement('canvas');
  const backdrop = background.getContext('2d', { alpha: false });
  const puff = document.createElement('canvas');
  const puffContext = puff.getContext('2d');
  const blossom = document.createElement('canvas');
  const blossomContext = blossom.getContext('2d');
  const seedSprite = document.createElement('canvas');
  const seedContext = seedSprite.getContext('2d');
  if (!backdrop || !puffContext || !blossomContext || !seedContext) return null;
  const state = { growth: 0, flight: 0, motion: true, breath: 0 };
  const pointer = { x: 0, y: 0, active: false, pressed: false, trailX: 0, trailY: 0 };
  const ripples = [];
  let spots = null;

  // Where the seedhead sits, in CSS pixels. Sway is deliberately excluded so anything
  // pinned here does not drift with the breeze.
  const headPoint = () => {
    const scale = height / 800 * (width < 600 ? .92 : 1);
    const landscape = width > height * 1.7 && height < 500;
    const stemGrowth = ease((state.growth - .035) / .28);
    return {
      x: width * (landscape ? .72 : .5) + stemGrowth * 7 * scale,
      y: height * .88 - (landscape ? 350 : 238) * stemGrowth * scale,
    };
  };

  const landingPoint = () => ({
    x: width * (width > height * 1.7 && height < 500 ? .5 : width < 600 ? .83 : .66),
    y: height * .87,
  });
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let frame = 0;
  let lastRender = 0;
  let time = 0;
  let dirty = true;
  let destroyed = false;

  const paintCloud = (x, y, size, seed) => {
    const random = randomGenerator(seed);
    backdrop.save();
    backdrop.translate(x, y);
    backdrop.scale(size, size);
    for (let layer = 0; layer < 4; layer += 1) {
      for (let index = 0; index < 65; index += 1) {
        const cloudX = (random() - .5) * 240;
        const top = Math.sin((cloudX / 240 + .5) * Math.PI);
        const cloudY = (random() - .68) * 55 * top + layer * 3;
        ellipse(backdrop, cloudX, cloudY, 15 + random() * 34, 5 + random() * 14, layer === 0 ? '#8faea314' : '#fffcef18');
      }
    }
    for (let index = 0; index < 28; index += 1) {
      const cloudX = (random() - .5) * 190;
      ellipse(backdrop, cloudX, -10 - Math.sin((cloudX / 190 + .5) * Math.PI) * 23, 14 + random() * 25, 6 + random() * 9, '#fffff31b');
    }
    backdrop.restore();
  };

  const paintBackground = () => {
    const random = randomGenerator(8732);
    backdrop.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const sky = backdrop.createLinearGradient(0, 0, width * .18, height);
    sky.addColorStop(0, '#bbd7d6');
    sky.addColorStop(.38, '#e0e8d5');
    sky.addColorStop(.65, '#f2ebce');
    sky.addColorStop(1, '#d9dca8');
    backdrop.fillStyle = sky;
    backdrop.fillRect(0, 0, width, height);
    const sunshine = backdrop.createRadialGradient(width * .7, height * .27, 0, width * .7, height * .27, width * .7);
    sunshine.addColorStop(0, '#fff6ce44');
    sunshine.addColorStop(1, '#fff6ce00');
    backdrop.fillStyle = sunshine;
    backdrop.fillRect(0, 0, width, height);
    const cloudScale = Math.max(.7, width / 1200);
    paintCloud(width * .07, height * .22, cloudScale * 1.55, 51);
    paintCloud(width * .91, height * .34, cloudScale * 1.45, 913);
    paintCloud(width * .75, height * .12, cloudScale * .8, 325);
    paintCloud(width * .28, height * .48, cloudScale * .65, 789);
    paintCloud(width * .97, height * .53, cloudScale * .75, 69);

    backdrop.fillStyle = '#adc4b36b';
    backdrop.beginPath();
    backdrop.moveTo(0, height * .66);
    backdrop.bezierCurveTo(width * .04, height * .6, width * .08, height * .64, width * .13, height * .59);
    backdrop.bezierCurveTo(width * .21, height * .51, width * .25, height * .62, width * .32, height * .6);
    backdrop.bezierCurveTo(width * .43, height * .62, width * .54, height * .68, width * .62, height * .64);
    backdrop.bezierCurveTo(width * .72, height * .61, width * .79, height * .54, width * .87, height * .58);
    backdrop.bezierCurveTo(width * .95, height * .62, width * .96, height * .56, width, height * .59);
    backdrop.lineTo(width, height);
    backdrop.lineTo(0, height);
    backdrop.fill();

    backdrop.fillStyle = '#9bb58c';
    backdrop.beginPath();
    backdrop.moveTo(0, height * .65);
    backdrop.bezierCurveTo(width * .2, height * .59, width * .38, height * .75, width * .6, height * .67);
    backdrop.bezierCurveTo(width * .77, height * .61, width * .89, height * .64, width, height * .65);
    backdrop.lineTo(width, height);
    backdrop.lineTo(0, height);
    backdrop.fill();

    for (let index = 0; index < 190; index += 1) {
      const x = random() * width;
      const y = height * (.665 + .012 * Math.sin(x / width * 13));
      const radius = (1.5 + random() * 4.5) * height / 800;
      ellipse(backdrop, x, y, radius * 1.4, radius, ['#76997460', '#8aab7c66', '#adc38c88'][index % 3]);
    }

    const grass = backdrop.createLinearGradient(0, height * .65, width * .12, height);
    grass.addColorStop(0, '#b5c68a');
    grass.addColorStop(.26, '#a5b979');
    grass.addColorStop(.65, '#88a461');
    grass.addColorStop(1, '#718c50');
    backdrop.fillStyle = grass;
    backdrop.beginPath();
    backdrop.moveTo(0, height * .74);
    backdrop.bezierCurveTo(width * .24, height * .71, width * .34, height * .66, width * .55, height * .685);
    backdrop.bezierCurveTo(width * .78, height * .69, width * .85, height * .74, width, height * .705);
    backdrop.lineTo(width, height);
    backdrop.lineTo(0, height);
    backdrop.closePath();
    backdrop.save();
    backdrop.clip();
    backdrop.fillRect(0, height * .64, width, height * .36);
    const light = backdrop.createRadialGradient(width * .53, height * .75, 0, width * .53, height * .75, width * .6);
    light.addColorStop(0, '#ebdfa844');
    light.addColorStop(1, '#ebdfa800');
    backdrop.fillStyle = light;
    backdrop.fillRect(0, height * .64, width, height * .36);

    for (let index = 0; index < 7400; index += 1) {
      const x = random() * width;
      const y = height * (.65 + random() * .37);
      const depth = clamp((y / height - .66) / .34);
      const brushWidth = (1 + random() * 8) * (.4 + depth) * Math.max(.7, width / 1400);
      ellipse(backdrop, x, y, brushWidth, .4 + depth * random() * 1.8, ['#e2dda52b', '#d3d49025', '#45693619', '#65824120', '#f0e4af23'][index % 5], -.2 + random() * .4);
    }

    for (let index = 0; index < Math.min(2300, width * 1.65); index += 1) {
      const x = random() * width;
      const y = height * (.69 + random() * .33);
      const depth = clamp((y / height - .66) / .34);
      const grassHeight = (2 + random() * 23) * depth * height / 800;
      backdrop.strokeStyle = ['#506f3f37', '#64814660', '#d0ce875b', '#e3d99b52', '#728c493d'][index % 5];
      backdrop.lineWidth = .4 + depth * random();
      backdrop.beginPath();
      backdrop.moveTo(x, y);
      backdrop.quadraticCurveTo(x + grassHeight * .2, y - grassHeight * .7, x + (random() - .5) * grassHeight, y - grassHeight);
      backdrop.stroke();
    }

    for (let index = 0; index < 130; index += 1) {
      const x = random() * width;
      const y = height * (.74 + random() * .23);
      const depth = (y / height - .65) * 2.4;
      if (Math.abs(x - width * .5) < width * .18 && y > height * .8) continue;
      backdrop.strokeStyle = '#6b854b77';
      backdrop.lineWidth = .8;
      backdrop.beginPath();
      backdrop.moveTo(x, y + 5 * depth);
      backdrop.lineTo(x + 1, y - 2 * depth);
      backdrop.stroke();
      const flowerColor = index % 3 === 0 ? '#eee8be' : index % 3 === 1 ? '#ead386' : '#bdc4a0';
      ellipse(backdrop, x, y - 3 * depth, 1.8 * depth, 1 * depth, flowerColor);
    }
    backdrop.restore();

    for (let index = 0; index < 75; index += 1) {
      const side = index % 2 ? 1 : -1;
      const x = side === -1 ? random() * width * .25 : width * (.77 + random() * .23);
      const y = height * (.98 + random() * .04);
      const length = (16 + random() * 50) * height / 800;
      backdrop.strokeStyle = ['#4e713d75', '#597b416b', '#a5b96a85'][index % 3];
      backdrop.lineWidth = 1 + random() * 1.6;
      backdrop.beginPath();
      backdrop.moveTo(x, y);
      backdrop.quadraticCurveTo(x - side * length * .25, y - length * .65, x + side * length * .16, y - length);
      backdrop.stroke();
    }

    for (let index = 0; index < 6500; index += 1) {
      backdrop.fillStyle = index % 2 ? '#ffffff07' : '#50634806';
      backdrop.fillRect(random() * width, random() * height, .6 + random() * 1.5, .5 + random());
    }
  };

  const paintFlowers = () => {
    const random = randomGenerator(904);
    puff.width = puff.height = 320;
    puffContext.translate(160, 160);
    puffContext.scale(2, 2);
    const glow = puffContext.createRadialGradient(0, 0, 3, 0, 0, 68);
    glow.addColorStop(0, '#a9a78019');
    glow.addColorStop(.58, '#f6f3dc68');
    glow.addColorStop(.88, '#fffef040');
    glow.addColorStop(1, '#fffef000');
    circle(puffContext, 0, 0, 69, glow);
    for (let index = 0; index < 270; index += 1) {
      const angle = index * 2.399963;
      const radius = Math.sqrt((index + .5) / 270) * 61;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const inner = .15 + random() * .16;
      puffContext.strokeStyle = index % 4 ? '#f9f9eaaa' : '#8c98746b';
      puffContext.lineWidth = .35 + random() * .3;
      puffContext.beginPath();
      puffContext.moveTo(x * inner, y * inner);
      puffContext.quadraticCurveTo(x * .6 - y * .05, y * .6 + x * .05, x, y);
      puffContext.stroke();
      const feather = 3 + random() * 7;
      for (let strand = 0; strand < 9; strand += 1) {
        const featherAngle = angle + (strand - 4) * .3;
        puffContext.strokeStyle = index % 3 ? '#fffff2d9' : '#ffffef91';
        puffContext.lineWidth = .28 + random() * .25;
        puffContext.beginPath();
        puffContext.moveTo(x, y);
        puffContext.quadraticCurveTo(x + Math.cos(featherAngle) * feather * .7, y + Math.sin(featherAngle) * feather * .7, x + Math.cos(featherAngle) * feather, y + Math.sin(featherAngle) * feather);
        puffContext.stroke();
      }
      if (index % 4 === 0) ellipse(puffContext, x * .23, y * .23, .45, 1.15, '#807c5260', angle);
    }
    circle(puffContext, -5, -8, 8, '#fffdf130');

    blossom.width = blossom.height = 320;
    blossomContext.translate(160, 160);
    blossomContext.scale(2, 2);
    for (let layer = 0; layer < 4; layer += 1) {
      const count = 65 - layer * 9;
      for (let index = 0; index < count; index += 1) {
        const angle = index / count * Math.PI * 2 + random() * .1;
        const length = 59 - layer * 11 + random() * 9;
        const petalWidth = 1 + random() * 2;
        blossomContext.save();
        blossomContext.rotate(angle);
        blossomContext.fillStyle = ['#d8a927', '#e9ba31', '#f4cc40', '#f8da55'][layer];
        blossomContext.beginPath();
        blossomContext.moveTo(-petalWidth * .5, 5);
        blossomContext.bezierCurveTo(-petalWidth * 1.2, -length * .4, -petalWidth, -length * .85, 1, -length);
        blossomContext.lineTo(1.6, -length + 2.5);
        blossomContext.lineTo(2.5, -length + .6);
        blossomContext.bezierCurveTo(petalWidth * 1.4, -length * .7, petalWidth, -length * .3, petalWidth * .5, 5);
        blossomContext.fill();
        blossomContext.strokeStyle = '#fff1a553';
        blossomContext.lineWidth = .55;
        blossomContext.beginPath();
        blossomContext.moveTo(0, -8);
        blossomContext.quadraticCurveTo(2, -length * .6, 1, -length + 4);
        blossomContext.stroke();
        blossomContext.restore();
      }
    }
    for (let index = 0; index < 60; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = random() * 13;
      circle(blossomContext, Math.cos(angle) * radius, Math.sin(angle) * radius, .8 + random(), index % 3 ? '#eabe35' : '#ffdf69');
    }

    seedSprite.width = 120;
    seedSprite.height = 140;
    seedContext.translate(60, 22);
    seedContext.scale(2, 2);
    seedContext.lineWidth = .65;
    seedContext.strokeStyle = '#fdfbeac9';
    for (let index = 0; index < 23; index += 1) {
      const angle = Math.PI + index / 22 * Math.PI;
      const reach = 13 + Math.sin(index * 3.4) * 2;
      seedContext.beginPath();
      seedContext.moveTo(0, 16);
      seedContext.quadraticCurveTo(Math.cos(angle) * reach * .55, 6 + Math.sin(angle) * reach * .6, Math.cos(angle) * reach, 5 + Math.sin(angle) * reach * .65);
      seedContext.stroke();
    }
    seedContext.strokeStyle = '#68724cc2';
    seedContext.lineWidth = .65;
    seedContext.beginPath();
    seedContext.moveTo(0, 16);
    seedContext.quadraticCurveTo(-1, 25, -3, 35);
    seedContext.stroke();
    ellipse(seedContext, -3, 35, 1.15, 3.2, '#867449', .24);
  };

  const drawLeaf = (x, y, length, angle, opacity = 1) => {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.globalAlpha *= opacity;
    const leafColor = context.createLinearGradient(0, 0, 0, -length);
    leafColor.addColorStop(0, '#4b703a');
    leafColor.addColorStop(.6, '#7e9b49');
    leafColor.addColorStop(1, '#a2b468');
    context.fillStyle = leafColor;
    context.beginPath();
    context.moveTo(0, 0);
    for (let index = 1; index < 7; index += 1) {
      const position = index / 7;
      const leafWidth = Math.sin(position * Math.PI) * length * .17;
      context.lineTo(-leafWidth, -length * position + length * .07);
      context.lineTo(-leafWidth * .36, -length * position - length * .015);
    }
    context.lineTo(0, -length);
    for (let index = 6; index > 0; index -= 1) {
      const position = index / 7;
      const leafWidth = Math.sin(position * Math.PI) * length * .17;
      context.lineTo(leafWidth * .4, -length * position - length * .015);
      context.lineTo(leafWidth, -length * position + length * .06);
    }
    context.closePath();
    context.fill();
    context.strokeStyle = '#ccd39070';
    context.lineWidth = .8;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, -length * .93);
    context.stroke();
    context.restore();
  };

  const drawBud = (amount, white = false) => {
    context.save();
    const opening = clamp(amount);
    const budHeight = 27 + opening * 6;
    const budWidth = 10 + opening * 9;
    const budGradient = context.createLinearGradient(-budWidth, 0, budWidth, 0);
    budGradient.addColorStop(0, '#4d703a');
    budGradient.addColorStop(.45, '#8ca34d');
    budGradient.addColorStop(.7, '#a9b95b');
    budGradient.addColorStop(1, '#557b3e');
    context.fillStyle = budGradient;
    context.beginPath();
    context.moveTo(-6, 10);
    context.bezierCurveTo(-budWidth - 3, 0, -budWidth, -budHeight * .7, -budWidth * .65, -budHeight);
    context.quadraticCurveTo(0, -budHeight - 5, budWidth * .65, -budHeight);
    context.bezierCurveTo(budWidth, -budHeight * .7, budWidth + 3, 0, 6, 10);
    context.fill();
    for (let index = -4; index <= 4; index += 1) {
      const x = index / 4 * budWidth * .7;
      context.strokeStyle = index % 2 ? '#d0cc6966' : '#3d623b6b';
      context.lineWidth = .8;
      context.beginPath();
      context.moveTo(x * .5, 5);
      context.quadraticCurveTo(x * 1.25, -budHeight * .6, x, -budHeight);
      context.stroke();
    }
    if (opening > .03) {
      for (let index = 0; index < 23; index += 1) {
        const x = Math.sin(index * 2.399) * budWidth * .65;
        context.strokeStyle = white ? ['#fffce5', '#e0e5cf', '#f7f6e1'][index % 3] : ['#e7b629', '#f6d54c', '#d7a12c'][index % 3];
        context.lineWidth = white ? .9 : 1.45;
        context.beginPath();
        context.moveTo(x, -budHeight + 3);
        context.quadraticCurveTo(x * .85, -budHeight - opening * 9, x * .9 + Math.sin(index) * 2, -budHeight - opening * (8 + Math.cos(index * 7) * 4));
        context.stroke();
      }
    }
    context.restore();
  };

  const drawSepals = (spread) => {
    for (let index = 0; index < 7; index += 1) {
      const side = (index - 3) / 3;
      context.fillStyle = index % 2 ? '#6e9046' : '#8fa757';
      context.beginPath();
      context.moveTo(side * 7, 6);
      context.quadraticCurveTo(side * (20 + spread * 15), 5 + spread * 11, side * (23 + spread * 12), 19 + Math.abs(side) * 9);
      context.quadraticCurveTo(side * 14, 15, side * 4, 12);
      context.fill();
    }
  };

  const drawSeed = (x, y, size, angle, opacity = 1) => {
    context.save();
    context.globalAlpha *= opacity;
    context.translate(x, y);
    context.rotate(angle);
    context.drawImage(seedSprite, -30 * size, -11 * size, 60 * size, 70 * size);
    context.restore();
  };

  const drawFlower = () => {
    const growth = state.growth;
    const flight = state.flight;
    const scale = height / 800 * (width < 600 ? .92 : 1);
    const landscape = width > height * 1.7 && height < 500;
    const baseX = width * (landscape ? .72 : .5);
    const baseY = height * .88;
    const stemGrowth = ease((growth - .035) / .28);
    const stemHeight = (landscape ? 350 : 238) * stemGrowth;
    const sway = state.motion ? Math.sin(time * .0008) * 3 + Math.sin(time * .0013) : 0;
    const breath = state.breath;
    const tremble = breath && state.motion ? (Math.sin(time * .022) * 2.4 + Math.sin(time * .039) * 1.2) * breath : 0;
    const bend = stemNode.x / scale;
    dandelion?.setState({ bend });
    const headX = sway + stemGrowth * 7 + breath * 10 + tremble + bend;
    const headY = -stemHeight;
    context.save();
    context.translate(baseX, baseY);
    context.scale(scale, scale);
    context.globalAlpha = 1 - ease((flight - .8) / .2);
    if (growth > .01) {
      const leaves = ease((growth - .01) / .21);
      ellipse(context, 0, 2, 60 * leaves, 6 * leaves, '#3e622721');
      if (flat()) {
        drawLeaf(-3, 2, 83 * leaves, -1.07 + sway * .002);
        drawLeaf(3, 3, 78 * leaves, 1.04 + sway * .002);
        drawLeaf(-1, 4, 62 * leaves, -.53);
        drawLeaf(2, 4, 56 * leaves, .67);
        if (stemHeight > 1) {
          context.lineCap = 'round';
          context.strokeStyle = '#4f713b';
          context.lineWidth = 6.5;
          context.beginPath();
          context.moveTo(0, 0);
          context.bezierCurveTo(-9 + bend * .12, -stemHeight * .35, 15 + sway + bend * .5, -stemHeight * .66, headX, headY + 6);
          context.stroke();
          context.strokeStyle = '#b1bd7794';
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(-1.5, 0);
          context.bezierCurveTo(-10.5 + bend * .12, -stemHeight * .35, 13.5 + sway + bend * .5, -stemHeight * .66, headX - 1.5, headY + 6);
          context.stroke();
          context.save();
          context.translate(headX, headY);
          const maturity = ease((growth - .13) / .14);
          context.scale(maturity, maturity);
          drawSepals(growth > .76 ? 1 : .3);
          if (growth < .37) drawBud(ease((growth - .23) / .14));
          else if (growth < .6) {
            const opening = ease((growth - .37) / .1);
            const closing = ease((growth - .55) / .06);
            if (opening < .9) drawBud(1);
            context.save();
            context.scale(.3 + opening * .7 - closing * .48, .5 + opening * .32 - closing * .2);
            context.rotate(-.06 + sway * .002);
            context.drawImage(blossom, -80, -84, 160, 160);
            context.restore();
          } else if (growth < .77) {
            const white = growth > .68;
            drawBud(ease((growth - .65) / .12), white);
            if (!white) {
              context.save();
              context.globalAlpha = 1 - ease((growth - .6) / .08);
              context.drawImage(blossom, -15, -40, 30, 21);
              context.restore();
            }
          } else {
            const opening = ease((growth - .77) / .21);
            ellipse(context, 0, 0, 10, 7, '#9aae61');
            for (let index = 0; index < 21; index += 1) circle(context, Math.sin(index * 2.399) * 8, Math.cos(index * 2.399) * 5, .7, '#5e794498');
            if (flight < .55) {
              context.save();
              context.globalAlpha *= 1 - ease(flight / .55);
              context.rotate(breath * .1 + tremble * .006);
              context.scale((.38 + opening * .62) * (1 + breath * .07), (.22 + opening * .78) * (1 - breath * .05));
              context.drawImage(puff, -80, -80 - (1 - opening) * 25, 160, 160);
              context.restore();
            }
          }
          context.restore();
        }
      }
    }
    context.restore();

    if (flight > 0) {
      const { x: landingX, y: landingY } = landingPoint();
      // The seeds fly in 3D now. Only the sprout where one lands is still painted here.
      if (flat()) {
        const random = randomGenerator(443);
        const flowerX = baseX + headX * scale;
        const flowerY = baseY + headY * scale;
        for (let index = 0; index < 65; index += 1) {
          const angle = random() * Math.PI * 2;
          const radius = Math.sqrt(random()) * 53 * scale;
          const delay = random() * .19;
          const progress = clamp((flight - delay) / (.55 + random() * .2));
          const speed = .65 + random() * .8;
          const seedScale = (.24 + random() * .28) * scale;
          const rise = .15 + random() * .3;
          if (flight < delay || progress >= 1) continue;
          const x = flowerX + Math.cos(angle) * radius + Math.pow(progress, .75) * width * speed;
          const y = flowerY + Math.sin(angle) * radius - Math.sin(progress * Math.PI * .8) * height * rise + Math.sin(progress * 8 + index) * 15;
          const opacity = ease(progress * 18) * (1 - ease((progress - .76) / .24));
          drawSeed(x, y, seedScale, -.4 + Math.sin(index + progress * 6) * .4, opacity);
        }
        const progress = ease(clamp((flight - .06) / .9));
        const inverse = 1 - progress;
        const x = inverse ** 3 * (flowerX + 20 * scale) + 3 * inverse ** 2 * progress * width * .93 + 3 * inverse * progress ** 2 * width * 1.02 + progress ** 3 * landingX;
        const y = inverse ** 3 * (flowerY - 20 * scale) + 3 * inverse ** 2 * progress * height * .12 + 3 * inverse * progress ** 2 * height * .5 + progress ** 3 * (landingY - 22 * scale);
        if (flight < .97) drawSeed(x, y, .65 * scale, -.45 * Math.sin(progress * Math.PI) + Math.sin(progress * 11) * .15, ease(flight * 15) * (1 - ease((flight - .91) / .06)));
      }
      if (flight > .91) {
        const sprout = ease((flight - .91) / .09);
        context.save();
        context.translate(landingX, landingY);
        context.scale(scale, scale);
        context.strokeStyle = '#536f36';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, 0);
        context.quadraticCurveTo(3, -8 * sprout, 0, -18 * sprout);
        context.stroke();
        drawLeaf(0, -9 * sprout, 18 * sprout, -.8);
        drawLeaf(0, -10 * sprout, 16 * sprout, .95);
        context.restore();
      }
    }
  };

  // A small pond off to one side. Painted live each frame rather than baked into the
  // cached backdrop because it moves; every motion term rides `time`, which only
  // advances while `state.motion` is true, so reduced motion freezes it with no branch.
  const pondGeometry = () => {
    const landscape = width > height * 1.7 && height < 500;
    const rx = Math.min(width * (landscape ? .17 : .23), 215);
    return { cx: width * (landscape ? .13 : .2), cy: height * (landscape ? .78 : .715), rx, ry: rx * .34 };
  };

  // Flat and upright: two rows of petals fanned from a common base, back row then front.
  // No depth sorting and no cone — at this size a handful of clean shapes reads as a
  // lotus, where a full whorl of them just reads as a blob.
  const petalRows = [
    { angles: [-1.22, -.63, 0, .63, 1.22], length: 1, width: .27, hue: 342, sat: 46, light: 71 },
    { angles: [-.44, 0, .44], length: .68, width: .23, hue: 346, sat: 40, light: 82 },
  ];

  const drawPetal = (angle, length, width2, hue, sat, light) => {
    const tipX = Math.sin(angle) * length;
    const tipY = -Math.cos(angle) * length;
    const normalX = -tipY / length * width2;
    const normalY = tipX / length * width2;
    const petal = context.createLinearGradient(0, 0, tipX, tipY);
    petal.addColorStop(0, `hsl(${hue} ${sat}% ${light - 9}%)`);
    petal.addColorStop(1, `hsl(${hue} ${sat - 14}% ${light + 17}%)`);
    context.fillStyle = petal;
    context.beginPath();
    context.moveTo(0, 0);
    context.bezierCurveTo(tipX * .2 + normalX * .7, tipY * .2 + normalY * .7, tipX * .68 + normalX, tipY * .68 + normalY, tipX, tipY);
    context.bezierCurveTo(tipX * .68 - normalX, tipY * .68 - normalY, tipX * .2 - normalX * .7, tipY * .2 - normalY * .7, 0, 0);
    context.fill();
    context.strokeStyle = `hsla(${hue} ${sat}% ${light - 26}% / .26)`;
    context.lineWidth = .5;
    context.stroke();
  };

  const drawLotus = (x, y, size, tilt) => {
    context.save();
    context.translate(x, y);
    context.rotate(tilt);
    context.scale(size, size);
    petalRows.forEach((row, index) => {
      row.angles.forEach((angle) => drawPetal(angle, row.length, row.width, row.hue, row.sat, row.light));
      if (!index) ellipse(context, 0, -.12, .17, .1, '#dcc270');
    });
    context.restore();
  };

  const drawStem = (x, y, height2, lean) => {
    context.strokeStyle = '#5d8250';
    context.lineWidth = Math.max(1, height2 * .07);
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + lean * height2 * .18, y - height2 * .55, x + lean * height2 * .3, y - height2);
    context.stroke();
  };

  const drawPad = (x, y, radius, notch, hue) => {
    context.save();
    context.translate(x, y);
    context.scale(1, .34);
    context.beginPath();
    context.arc(0, 0, radius, notch + .42, notch + Math.PI * 2 - .42);
    context.closePath();
    context.fillStyle = `hsl(${hue} 30% 34%)`;
    context.fill();
    context.translate(0, -radius * .1);
    context.beginPath();
    context.arc(0, 0, radius, notch + .42, notch + Math.PI * 2 - .42);
    context.closePath();
    context.fillStyle = `hsl(${hue} 36% 52%)`;
    context.fill();
    context.strokeStyle = `hsla(${hue} 34% 24% / .4)`;
    context.lineWidth = Math.max(.6, radius * .05);
    for (let index = 0; index < 7; index += 1) {
      const angle = notch + .6 + index / 7 * (Math.PI * 2 - 1.2);
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(Math.cos(angle) * radius * .92, Math.sin(angle) * radius * .92);
      context.stroke();
    }
    context.restore();
  };

  const pads = [[-.62, .1, 17, .4, 104], [.26, .46, 15, 2.2, 96], [.58, -.16, 12, 4.1, 110], [-.2, .56, 13, 1.1, 92], [-.04, -.3, 11, 5.2, 100]];
  const blooms = [[.18, -.05, 8, .9], [-.55, .3, 12, 1.35], [.6, .48, 10, 1.15]];

  // Touch is an influence field, not a drag: things are pushed away from the pointer and
  // spring back when it leaves. Nothing calls preventDefault, so the scroll that drives
  // the whole journey is untouched, and dragging past the pond nudges it on the way.
  const padNodes = pads.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
  const bloomNodes = blooms.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
  const stemNode = { x: 0, y: 0, vx: 0, vy: 0 };

  const spring = (node, forceX, forceY, step, stiffness, damping, limit) => {
    node.vx += (forceX - node.x * stiffness - node.vx * damping) * step;
    node.vy += (forceY - node.y * stiffness - node.vy * damping) * step;
    node.x += node.vx * step;
    node.y += node.vy * step;
    if (Math.abs(node.x) > limit) {
      node.x = Math.sign(node.x) * limit;
      node.vx *= .2;
    }
    if (Math.abs(node.y) > limit) {
      node.y = Math.sign(node.y) * limit;
      node.vy *= .2;
    }
  };

  const pushFrom = (x, y, radius, strength) => {
    if (!pointer.active) return [0, 0];
    const awayX = x - pointer.x;
    const awayY = y - pointer.y;
    const distance = Math.hypot(awayX, awayY);
    if (distance > radius) return [0, 0];
    const falloff = (1 - distance / radius) ** 2;
    const power = strength * falloff * (pointer.pressed ? 1.7 : 1) / Math.max(distance, 7);
    return [awayX * power, awayY * power];
  };

  const inWater = (x, y) => {
    const { cx, cy, rx, ry } = pondGeometry();
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  };

  const addRipple = (x, y) => {
    if (!state.motion || !inWater(x, y)) return;
    ripples.push({ x, y, born: time });
    if (ripples.length > 6) ripples.shift();
  };

  // Rest positions, wind included. Shared by the physics and the painting so the two can
  // never disagree about where anything is.
  const surfaceSpots = () => {
    const { cx, cy, rx, ry } = pondGeometry();
    const unit = rx / 90;
    return {
      cx, cy, rx, ry, unit,
      pads: pads.map(([offsetX, offsetY, radius, notch, hue], index) => ({
        x: cx + offsetX * rx * .74 + Math.sin(time * .0006 + index * 2.1) * 2 * unit,
        y: cy + offsetY * ry * .7 + Math.sin(time * .0009 + index * 1.7) * 1.4 * unit,
        radius: radius * unit,
        notch: notch + Math.sin(time * .0011 + index) * .1,
        hue,
      })),
      blooms: blooms.map(([offsetX, offsetY, size, lean], index) => ({
        x: cx + offsetX * rx * .74 + Math.sin(time * .0007 + index * 3.4) * 2.2 * unit,
        y: cy + offsetY * ry * .68,
        size: size * unit,
        sway: Math.sin(time * .0013 + index * 1.9) * .16,
        lean,
      })),
    };
  };

  const stepPhysics = (delta) => {
    spots = surfaceSpots();
    // Clamp the step so a long stall (a background tab, a slow frame) cannot fling the
    // springs past their rest position when the page comes back.
    const step = Math.min(2.2, delta / 16.67);
    if (!state.motion) {
      [...padNodes, ...bloomNodes, stemNode].forEach((node) => { node.x = 0; node.y = 0; node.vx = 0; node.vy = 0; });
      return;
    }
    spots.pads.forEach((pad, index) => {
      const [forceX, forceY] = pushFrom(pad.x, pad.y, pad.radius + 52, .8);
      spring(padNodes[index], forceX, forceY * .45, step, .062, .3, 15);
    });
    spots.blooms.forEach((bloom, index) => {
      const [forceX, forceY] = pushFrom(bloom.x, bloom.y - bloom.size * .9, bloom.size + 56, .7);
      spring(bloomNodes[index], forceX, forceY * .3, step, .05, .28, 17);
    });

    let stemForce = 0;
    const scale = height / 800 * (width < 600 ? .92 : 1);
    const landscape = width > height * 1.7 && height < 500;
    const baseX = width * (landscape ? .72 : .5);
    const baseY = height * .88;
    const stemHeight = (landscape ? 350 : 238) * ease((state.growth - .035) / .28) * scale;
    if (pointer.active && stemHeight > 8) {
      const topY = baseY - stemHeight;
      const alongY = Math.max(topY, Math.min(baseY, pointer.y));
      const awayX = baseX - pointer.x;
      const distance = Math.hypot(awayX, alongY - pointer.y);
      const radius = 96;
      if (distance < radius) {
        // A stem bends most where it is furthest from the root.
        const leverage = 1 - (alongY - topY) / stemHeight;
        const falloff = (1 - distance / radius) ** 2;
        stemForce = awayX / Math.max(distance, 8) * 1.7 * falloff * leverage * (pointer.pressed ? 1.7 : 1);
      }
    }
    spring(stemNode, stemForce, 0, step, .046, .26, 24);
  };

  const drawPond = () => {
    const { cx, cy, rx, ry, unit } = spots || surfaceSpots();

    ellipse(context, cx, cy + ry * .06, rx + 6 * unit, ry + 5 * unit, '#7f9c74a8');
    const water = context.createLinearGradient(cx, cy - ry, cx, cy + ry);
    water.addColorStop(0, '#6f9ca0');
    water.addColorStop(.5, '#84b2aa');
    water.addColorStop(1, '#a3c6b2');
    ellipse(context, cx, cy, rx, ry, water);

    context.save();
    context.beginPath();
    context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    context.clip();

    const sheen = context.createRadialGradient(cx + rx * .3, cy - ry * .5, 0, cx + rx * .3, cy - ry * .5, rx * .95);
    sheen.addColorStop(0, '#fdfbe654');
    sheen.addColorStop(1, '#fdfbe600');
    ellipse(context, cx, cy, rx, ry, sheen);

    // Reflections first, so the ripples and glints ride over them.
    spots.blooms.forEach((bloom, index) => {
      const node = bloomNodes[index];
      context.save();
      context.globalAlpha = .16;
      context.translate(bloom.x + node.x * .6 + Math.sin(time * .0016 + index) * 2.2 * unit, bloom.y + node.y * .6);
      context.scale(1, -.44);
      drawLotus(0, -bloom.size * 1.3, bloom.size, bloom.sway + node.x * .012);
      context.restore();
    });

    // Rings from wherever a finger has touched the water.
    for (let index = ripples.length - 1; index >= 0; index -= 1) {
      const age = (time - ripples[index].born) / 1800;
      if (age >= 1 || age < 0) {
        ripples.splice(index, 1);
        continue;
      }
      const spread = ease(age);
      context.beginPath();
      context.ellipse(ripples[index].x, ripples[index].y, spread * rx * .52, spread * ry * .52, 0, 0, Math.PI * 2);
      context.strokeStyle = `rgba(255,253,238,${(1 - age) ** 2 * .5})`;
      context.lineWidth = (1 - age * .6) * 1.6 * unit;
      context.stroke();
    }

    for (let index = 0; index < 3; index += 1) {
      const progress = (time * .00021 + index * .37) % 1;
      context.beginPath();
      context.ellipse(cx + (index - 1) * rx * .34, cy + (index % 2 ? .22 : -.26) * ry, progress * rx * .46, progress * ry * .46, 0, 0, Math.PI * 2);
      context.strokeStyle = `rgba(253,251,232,${(1 - progress) * .28})`;
      context.lineWidth = 1.2 * unit;
      context.stroke();
    }

    for (let index = 0; index < 6; index += 1) {
      const drift = ((time * .00004 + index / 6) % 1) * 2 - 1;
      const span = rx * Math.sqrt(Math.max(0, 1 - (drift * .84) ** 2)) * .5;
      const glintY = cy + drift * ry * .84;
      context.beginPath();
      context.moveTo(cx - span + Math.sin(time * .0007 + index) * 4 * unit, glintY);
      context.lineTo(cx + span + Math.sin(time * .0009 + index) * 4 * unit, glintY);
      context.strokeStyle = `rgba(255,253,238,${.1 + Math.sin(time * .0012 + index) * .06})`;
      context.lineWidth = unit;
      context.stroke();
    }
    context.restore();

    // Nearer things last: on this plane, lower on screen means closer to the eye.
    const surface = [];
    spots.pads.forEach((pad, index) => {
      const node = padNodes[index];
      surface.push({
        y: pad.y + node.y,
        paint: (padY) => drawPad(pad.x + node.x, padY, pad.radius, pad.notch + node.x * .006, pad.hue),
      });
    });
    spots.blooms.forEach((bloom, index) => {
      const node = bloomNodes[index];
      const stand = bloom.size * .9;
      // The push tips the flower as well as moving it, so it leans away rather than
      // sliding across the water like a game piece.
      const tilt = bloom.lean * .12 + bloom.sway * .5 + node.x * .016;
      surface.push({
        y: bloom.y + node.y + .1,
        paint: (bloomY) => {
          drawStem(bloom.x + node.x, bloomY, stand, tilt);
          drawLotus(bloom.x + node.x + tilt * stand * .3, bloomY - stand, bloom.size, bloom.sway + node.x * .014);
        },
      });
    });
    surface.sort((a, b) => a.y - b.y).forEach((item) => item.paint(item.y));
  };

  const render = (timestamp = 0) => {
    frame = 0;
    if (destroyed || document.hidden) return;
    if (dirty || timestamp - lastRender >= 32) {
      const delta = Math.min(timestamp - lastRender, 64);
      if (state.motion) time += delta;
      lastRender = timestamp;
      stepPhysics(delta);
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(background, 0, 0);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawPond();
      drawFlower();
      const random = randomGenerator(875);
      for (let index = 0; index < 17; index += 1) {
        const x = (random() * width + time * (.002 + random() * .003)) % width;
        const y = height * (.45 + random() * .49) + Math.sin(time * .0006 + index) * 5;
        const alpha = .12 + (.5 + Math.sin(time * .001 + index) * .5) * .3;
        ellipse(context, x, y, .7 + random() * 1.1, .45 + random() * .65, `rgba(255,249,216,${alpha})`, -.5);
      }
      dirty = false;
    }
    if (state.motion) frame = requestAnimationFrame(render);
  };

  const requestRender = () => {
    dirty = true;
    if (!frame && !destroyed && !document.hidden) frame = requestAnimationFrame(render);
  };

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(bounds.width));
    const nextHeight = Math.max(1, Math.round(bounds.height));
    const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (nextWidth === width && nextHeight === height && nextRatio === pixelRatio) return;
    width = nextWidth;
    height = nextHeight;
    pixelRatio = nextRatio;
    canvas.width = background.width = Math.round(width * pixelRatio);
    canvas.height = background.height = Math.round(height * pixelRatio);
    dandelion?.resize(width, height, pixelRatio);
    paintBackground();
    requestRender();
  };

  const onVisibility = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!document.hidden) requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener('visibilitychange', onVisibility);
  paintFlowers();
  resize();

  return {
    landing: landingPoint,
    head: headPoint,
    pointerAt: (x, y, pressed) => {
      if (!state.motion) return;
      pointer.x = x;
      pointer.y = y;
      pointer.pressed = Boolean(pressed);
      if (!pointer.active) {
        pointer.trailX = x;
        pointer.trailY = y;
      }
      pointer.active = true;
      // Trailing rings while a finger is dragging across the water, spaced by distance
      // rather than by time so a slow drag does not pile them up.
      if (pointer.pressed && Math.hypot(x - pointer.trailX, y - pointer.trailY) > 26) {
        pointer.trailX = x;
        pointer.trailY = y;
        addRipple(x, y);
      }
      requestRender();
    },
    pointerOut: () => {
      pointer.active = false;
      pointer.pressed = false;
      requestRender();
    },
    poke: (x, y) => {
      addRipple(x, y);
      requestRender();
    },
    setState: (next) => {
      if (typeof next.growth === 'number') state.growth = clamp(next.growth);
      if (typeof next.flight === 'number') state.flight = clamp(next.flight);
      if (typeof next.breath === 'number') state.breath = clamp(next.breath);
      if (typeof next.motion === 'boolean') state.motion = next.motion;
      dandelion?.setState(next);
      requestRender();
    },
    destroy: () => {
      destroyed = true;
      dandelion?.destroy();
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
};
