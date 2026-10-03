// The desktop mascot uses the same modeled silhouette and studio palette as
// prototipos/solzinho-3d.html. The emoji remains available if WebGL is absent.
(() => {
  const host = document.getElementById('sun');
  const wrap = document.getElementById('sun-wrap');
  const T = window.THREE;
  if (!host || !wrap || !T) return;
  T.ColorManagement.legacyMode = false;

  // Electron on macOS can fall back to software WebGL. A transparent window
  // then has to copy every rendered frame, which can saturate a CPU core.
  // Keep the same 3D artwork, rendered ahead of time, and animate its layers
  // with the compositor instead of running WebGL in the desktop window.
  if (/Mac/.test(navigator.platform)) {
    const body = document.createElement('img');
    body.className = 'sun-raster';
    body.src = 'assets/sun-idle.png';
    body.alt = '';
    body.draggable = false;
    host.insertBefore(body, host.firstChild);
    const origins = [
      [18, 20], [82, 34], [80, 75], [69, 15], [11, 49],
    ];
    for (let i = 0; i < origins.length; i++) {
      const layer = document.createElement('span');
      layer.className = 'sun-accent';
      layer.style.setProperty('--origin-x', `${origins[i][0]}%`);
      layer.style.setProperty('--origin-y', `${origins[i][1]}%`);
      layer.style.setProperty('--delay', `${i * 65}ms`);
      layer.style.setProperty('--float-delay', `${-i * 520}ms`);
      const image = document.createElement('img');
      image.src = `assets/accent-${i + 1}.png`;
      image.alt = '';
      image.draggable = false;
      layer.appendChild(image);
      host.insertBefore(layer, host.firstChild);
    }
    const point = (position) => {
      const x = Math.max(-1, Math.min(1, position.x));
      const y = Math.max(-1, Math.min(1, position.y));
      body.style.transform = `perspective(280px) rotateY(${(x * 8).toFixed(2)}deg) rotateX(${(-y * 6).toFixed(2)}deg)`;
    };
    if (window.solzinho?.onCursorRelative) {
      window.solzinho.onCursorRelative(point);
    } else {
      window.addEventListener('mousemove', (event) => {
        const box = host.getBoundingClientRect();
        point({
          x: (event.clientX - box.left - box.width / 2) / 240,
          y: (event.clientY - box.top - box.height / 2) / 240,
        });
      });
    }
    let burstTimer;
    wrap.addEventListener('mascot-poke', () => {
      host.classList.remove('accent-burst');
      void host.offsetWidth;
      host.classList.add('accent-burst');
      clearTimeout(burstTimer);
      burstTimer = setTimeout(() => host.classList.remove('accent-burst'), 1800);
    });
    host.classList.add('webgl-ready', 'raster-ready');
    return;
  }

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (error) {
    console.warn('Solzinho 3D indisponível:', error);
    return;
  }

  const SPAN = 2.96;
  // The mascot is only 96 CSS pixels wide. On macOS the transparent Electron
  // window may use software WebGL, so its backing buffer stays at 96 pixels.
  const softwareBudget = /Mac/.test(navigator.platform);
  renderer.setPixelRatio(softwareBudget ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(96, 96, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.LinearToneMapping;
  renderer.toneMappingExposure = 0.82;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.insertBefore(canvas, host.firstChild);

  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-SPAN / 2, SPAN / 2, SPAN / 2, -SPAN / 2, 0.1, 20);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);
  const studio = new T.Scene();
  studio.add(new T.Mesh(new T.BoxGeometry(20, 20, 20), new T.MeshBasicMaterial({
    color: new T.Color(0.24, 0.22, 0.18), side: T.BackSide,
  })));
  function softbox(x, y, z, w, h, strength) {
    const panel = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({
      color: new T.Color(strength, strength, strength * 0.94), side: T.DoubleSide,
    }));
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  }
  softbox(4, 5, 6, 4.5, 5.5, 4.2);
  softbox(-5, 2, 3, 2.5, 6, 0.35);
  softbox(0, 5, -4, 5, 3, 0.7);
  try {
    const pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(studio, 0.06).texture;
    pmrem.dispose();
  } catch (error) {
    console.warn('Reflexos 3D simplificados:', error);
  }
  studio.traverse((obj) => {
    if (obj.isMesh) { obj.geometry.dispose(); obj.material.dispose(); }
  });
  scene.add(new T.HemisphereLight('#FFFAEF', '#FFE7A9', 0.6));
  const key = new T.DirectionalLight('#FFF4E2', 0.8);
  key.position.set(4, 5, 6);
  scene.add(key);
  const fill = new T.DirectionalLight('#FFE9C9', 0.3);
  fill.position.set(-2, 1, 3);
  scene.add(fill);

  const smooth = (a, b, v) => Math.max(0, Math.min(1, (v - a) / (b - a)));
  const mix = (a, b, t) => a + (b - a) * t;
  const Z = new T.Vector3(0, 0, 1);
  const sphere = new T.SphereGeometry(1, 16, 12);
  const main = new T.Group();
  scene.add(main);

  function domePoint(x, y, offset = 0) {
    const z = 0.74 * 0.72 * Math.sqrt(Math.max(0.0001, 1 - x * x - y * y));
    const normal = new T.Vector3(x, y, z / (0.72 * 0.72)).normalize();
    return new T.Vector3(x * 0.74, y * 0.74, z).addScaledVector(normal, offset);
  }
  function project(geometry, cx, cy, lift) {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const p = domePoint(pos.getX(i) + cx, pos.getY(i) + cy, lift);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }
  function surfacePatch(shape) {
    const points = shape.getSpacedPoints(64); points.pop();
    if (!T.ShapeUtils.isClockWise(points)) points.reverse();
    const center = points.reduce((v, p) => v.add(p), new T.Vector2()).divideScalar(points.length);
    const positions = [], uv = [], index = [], N = points.length, rings = 8;
    for (let ring = 0; ring <= rings; ring++) for (const p of points) {
      const q = center.clone().lerp(p, ring / rings);
      positions.push(q.x, q.y, 0); uv.push(q.x, q.y);
    }
    for (let ring = 0; ring < rings; ring++) for (let i = 0; i < N; i++) {
      const a = ring * N + i, b = ring * N + (i + 1) % N;
      index.push(a, b, a + N, b, b + N, a + N);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geometry.setIndex(index); geometry.computeVertexNormals();
    return geometry;
  }
  function cushion(shape, depth, rings = 12) {
    const edge = shape.getSpacedPoints(120); edge.pop();
    const grid = 48, bounds = new T.Box2().setFromPoints(edge),
      size = bounds.getSize(new T.Vector2()), field = new Float32Array(grid * grid),
      inside = new Uint8Array(grid * grid);
    for (let iy = 1; iy < grid - 1; iy++) for (let ix = 1; ix < grid - 1; ix++) {
      const x = bounds.min.x + ix / (grid - 1) * size.x;
      const y = bounds.min.y + iy / (grid - 1) * size.y;
      let hit = false;
      for (let a = 0, b = edge.length - 1; a < edge.length; b = a++) {
        const p = edge[a], q = edge[b];
        if ((p.y > y) !== (q.y > y) && x < (q.x - p.x) * (y - p.y) / (q.y - p.y) + p.x) hit = !hit;
      }
      inside[iy * grid + ix] = hit ? 1 : 0;
    }
    for (let pass = 0; pass < 240; pass++) for (let i = grid + 1; i < field.length - grid - 1; i++) {
      if (inside[i]) field[i] = (field[i - 1] + field[i + 1] + field[i - grid] + field[i + grid] + 1) * 0.25;
    }
    const peak = Math.max(...field);
    function height(x, y) {
      const u = Math.max(0, Math.min(grid - 1.001, (x - bounds.min.x) / size.x * (grid - 1)));
      const v = Math.max(0, Math.min(grid - 1.001, (y - bounds.min.y) / size.y * (grid - 1)));
      const a = Math.floor(u), b = Math.floor(v), f = u - a, t = v - b, k = b * grid + a;
      return Math.sqrt(Math.max(0, mix(mix(field[k], field[k + 1], f), mix(field[k + grid], field[k + grid + 1], f), t) / peak));
    }
    const positions = [], index = [], N = edge.length;
    for (let j = 0; j <= rings * 2; j++) {
      const angle = Math.PI * j / (rings * 2), r = Math.sin(angle);
      for (const p of edge) {
        const x = p.x * r, y = p.y * r;
        positions.push(x, y, j === rings ? 0 : depth * height(x, y) * Math.sign(Math.cos(angle)));
      }
    }
    for (let j = 0; j < rings * 2; j++) for (let i = 0; i < N; i++) {
      const a = j * N + i, b = j * N + (i + 1) % N;
      index.push(a, a + N, b, b, a + N, b + N);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(index); geometry.computeVertexNormals();
    return geometry;
  }
  function starShape() {
    const points = [], n = 10;
    for (let i = 0; i < n * 2; i++) {
      const angle = Math.PI / 2 + i * Math.PI / n, r = i % 2 ? 0.77 : 1.13;
      points.push(new T.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
    }
    const shape = new T.Shape();
    for (let i = 0; i < points.length; i++) {
      const cur = points[i], f = i % 2 ? 0.42 : 0.32;
      const a = cur.clone().lerp(points[(i - 1 + points.length) % points.length], f);
      const b = cur.clone().lerp(points[(i + 1) % points.length], f);
      if (i) shape.lineTo(a.x, a.y); else shape.moveTo(a.x, a.y);
      shape.quadraticCurveTo(cur.x, cur.y, b.x, b.y);
    }
    shape.closePath(); return shape;
  }
  function heartShape() {
    const xy = (x, y) => [(x - 5) / 22, -(y - 9.5) / 22];
    const s = new T.Shape();
    s.moveTo(...xy(5, 5));
    s.bezierCurveTo(...xy(5, 5), ...xy(4, 0), ...xy(0, 0));
    s.bezierCurveTo(...xy(-6, 0), ...xy(-6, 7), ...xy(-6, 7));
    s.bezierCurveTo(...xy(-6, 11), ...xy(-3, 15.4), ...xy(5, 19));
    s.bezierCurveTo(...xy(12, 15.4), ...xy(16, 11), ...xy(16, 7));
    s.bezierCurveTo(...xy(16, 7), ...xy(16, 0), ...xy(10, 0));
    s.bezierCurveTo(...xy(7, 0), ...xy(5, 5), ...xy(5, 5));
    return s;
  }
  function sparkleShape() {
    const s = new T.Shape(), directions = [[0, 1], [-1, 0], [0, -1], [1, 0]];
    directions.forEach(([ux, uy], i) => {
      const vx = -uy, vy = ux;
      const ax = ux * 0.84 - vx * 0.07, ay = uy * 0.84 - vy * 0.07;
      const bx = ux * 0.84 + vx * 0.07, by = uy * 0.84 + vy * 0.07;
      if (i) s.lineTo(ax, ay); else s.moveTo(ax, ay);
      s.quadraticCurveTo(ux, uy, bx, by);
      const [nx, ny] = directions[(i + 1) % 4];
      s.quadraticCurveTo((ux + nx) * 0.17, (uy + ny) * 0.17,
        nx * 0.84 + ny * 0.07, ny * 0.84 - nx * 0.07);
    });
    return s;
  }
  function vinyl(color, options = {}) {
    return new T.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 0.28,
      clearcoatRoughness: 0.32, metalness: 0, envMapIntensity: 0.55, ...options });
  }

  const plate = new T.Mesh(cushion(starShape(), 0.22), vinyl('#FFB600'));
  plate.position.z = -0.06;
  main.add(plate);

  const bodyGeometry = new T.SphereGeometry(1, 64, 48);
  bodyGeometry.rotateY(-Math.PI / 2);
  const positions = bodyGeometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const top = new T.Color('#FFD21A'), bottom = new T.Color('#FFBB05');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    positions.setXYZ(i, x * 0.74, y * 0.74, z * 0.74 * 0.72);
    const c = top.clone().lerp(bottom, smooth(-0.75, 0.75, -y));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  bodyGeometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  bodyGeometry.computeVertexNormals();
  const bodyMaterial = vinyl('#FFFFFF', { vertexColors: true });
  bodyMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vSunLocal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvSunLocal = position / 0.74;');
    shader.fragmentShader = 'varying vec3 vSunLocal;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 cheek = (vec2(abs(vSunLocal.x), vSunLocal.y) - vec2(0.65, -0.09)) / vec2(0.19, 0.22);
      float blush = exp(-1.8 * dot(cheek, cheek)) * smoothstep(0.12, 0.45, vSunLocal.z);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.15, 0.008), blush * 0.90);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `
      float softbox = pow(max(dot(normal, normalize(vec3(0.43, 0.38, 1.0))), 0.0), 28.0);
      outgoingLight += vec3(1.0, 0.97, 0.76) * softbox * 0.46;
      #include <output_fragment>
    `);
  };
  bodyMaterial.customProgramCacheKey = () => 'desktop-sun-vinyl-v1';
  const body = new T.Mesh(bodyGeometry, bodyMaterial);
  main.add(body);

  const eyes = new T.Group(), eyeMaterial = vinyl('#3A2214', {
    roughness: 0.35, clearcoat: 0.3, clearcoatRoughness: 0.3,
  });
  for (const x of [-0.43, 0.43]) {
    const points = [];
    for (let j = 0; j <= 24; j++) {
      const a = (0.08 + 0.84 * j / 24) * Math.PI;
      points.push(domePoint(x + 0.16 * Math.cos(a),
        0.27 + 0.17 * Math.sin(a) - 0.085, 0.012));
    }
    eyes.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 48, 0.042 * 0.74, 10), eyeMaterial));
    for (const point of [points[0], points[points.length - 1]]) {
      const cap = new T.Mesh(sphere, eyeMaterial);
      cap.position.copy(point); cap.scale.setScalar(0.042 * 0.74); eyes.add(cap);
    }
  }
  main.add(eyes);

  const mouthShape = new T.Shape(), W = 0.4, depth = 0.49;
  mouthShape.moveTo(-W, -0.03);
  mouthShape.bezierCurveTo(-W, 0.10, -W * 0.76, 0.035, -W * 0.48, -0.015);
  mouthShape.bezierCurveTo(-W * 0.12, -0.10, W * 0.34, -0.075, W * 0.72, 0);
  mouthShape.bezierCurveTo(W * 0.97, 0.065, W * 1.03, -0.015, W * 0.98, -0.12);
  mouthShape.bezierCurveTo(W * 0.9, -depth * 0.82, W * 0.55, -depth, 0, -depth);
  mouthShape.bezierCurveTo(-W * 0.56, -depth, -W * 0.92, -depth * 0.75, -W, -0.03);
  const mouthMaterial = new T.MeshBasicMaterial({ color: '#310700', side: T.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  mouthMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec2 vMouth;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvMouth = uv;');
    shader.fragmentShader = 'varying vec2 vMouth;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float cavity = 1.0 - smoothstep(-0.48, -0.03, vMouth.y);
      diffuseColor.rgb *= 0.18 + cavity * 1.3;
    `);
  };
  const mouth = new T.Mesh(project(surfacePatch(mouthShape), 0, -0.035, 0.018), mouthMaterial);
  main.add(mouth);
  const tongueShape = new T.Shape();
  tongueShape.absellipse(0, -depth * 0.77, W * 0.65, depth * 0.23, 0, Math.PI * 2, false);
  const tongueGeo = project(surfacePatch(tongueShape), 0, -0.035, 0.035);
  const tonguePos = tongueGeo.attributes.position;
  for (let i = 0; i < tonguePos.count; i++) {
    const x = tonguePos.getX(i) / (0.74 * W * 0.65);
    const y = (tonguePos.getY(i) / 0.74 + 0.035 + depth * 0.77) / (depth * 0.23);
    tonguePos.setZ(i, tonguePos.getZ(i) + 0.07 * Math.sqrt(Math.max(0, 1 - x * x - y * y)));
  }
  tongueGeo.computeVertexNormals();
  const tongue = new T.Mesh(tongueGeo, vinyl('#FF3C16', { side: T.DoubleSide }));
  main.add(tongue);

  const decorations = new T.Group();
  main.add(decorations);
  const heartGeo = cushion(heartShape(), 0.28);
  const sparkleGeo = cushion(sparkleShape(), 0.25);
  const red = vinyl('#FF3012', { roughness: 0.25, clearcoat: 0.5,
    clearcoatRoughness: 0.2, envMapIntensity: 0.8 });
  const gold = vinyl('#FFCE16');
  const items = [
    [heartGeo, red, -0.93, 0.87, 0.15, 0.56, -0.30],
    [heartGeo, red, 1.06, 0.42, 0.12, 0.43, 0.30],
    [heartGeo, red, 1.01, -0.80, 0.17, 0.56, 0.30],
    [sparkleGeo, gold, 0.58, 1.03, 0.05, 0.15, 0],
    [sparkleGeo, gold, -1.16, -0.03, 0.10, 0.17, 0.05],
  ];
  const particles = items.map(([geometry, material, x, y, z, size, angle], index) => {
    const paint = material.clone();
    paint.transparent = true;
    paint.depthWrite = false;
    paint.opacity = 0;
    const mesh = new T.Mesh(geometry, paint);
    mesh.visible = false;
    mesh.position.set(x, y, z);
    decorations.add(mesh);
    return { mesh, x, y, z, size, angle, index, amount: 0 };
  });

  // A soft grounding shadow remains visible on transparent desktop windows.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128; shadowCanvas.height = 32;
  const ctx = shadowCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 16, 0, 64, 16, 63);
  gradient.addColorStop(0, 'rgba(71,42,13,.24)');
  gradient.addColorStop(1, 'rgba(71,42,13,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 32);
  const shadowTexture = new T.CanvasTexture(shadowCanvas);
  const shadow = new T.Sprite(new T.SpriteMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
  shadow.position.set(0, -1.30, -0.5); shadow.scale.set(1.3, 0.2, 1); scene.add(shadow);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pointer = { x: 0, y: 0 };
  if (window.solzinho?.onCursorRelative) {
    window.solzinho.onCursorRelative((position) => {
      pointer.x = Math.max(-1, Math.min(1, position.x));
      pointer.y = Math.max(-1, Math.min(1, position.y));
    });
  } else {
    // Keeps the standalone renderer preview interactive without Electron.
    window.addEventListener('mousemove', (event) => {
      const box = host.getBoundingClientRect();
      pointer.x = Math.max(-1, Math.min(1, (event.clientX - box.left - box.width / 2) / 240));
      pointer.y = Math.max(-1, Math.min(1, (event.clientY - box.top - box.height / 2) / 240));
    });
  }
  let last = 0, previousFrame = 0, contextLost = false;
  let burstUntil = 0, pulseUntil = 0, entranceAt = 0, wasDecorating = false;
  wrap.addEventListener('mascot-poke', () => {
    const now = performance.now() * 0.001;
    burstUntil = now + 1.8;
    pulseUntil = now + 0.42;
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    host.classList.remove('webgl-ready');
    canvas.style.display = 'none';
  });
  function draw(now) {
    if (contextLost) return;
    const energetic = ['shining', 'weee', 'weee-mild', 'dizzy', 'clicked',
      'checking-update', 'settling'].some(name => wrap.classList.contains(name))
      || now * 0.001 < burstUntil;
    const facing = wrap.classList.contains('facing-left') ? -1 : 1;
    const walkingNow = wrap.classList.contains('walking');
    const moonNow = wrap.classList.contains('moon-mode') || wrap.classList.contains('breathing');
    const following = !moonNow && (Math.abs(main.rotation.y - facing * pointer.x * 0.13) > 0.008
      || Math.abs(main.rotation.x - (pointer.y * 0.10 + (walkingNow ? 0.045 : 0))) > 0.008);
    // CSS already handles the continuous idle breath and walking bob. When
    // the cursor and face are still, the 3D surface only needs an occasional
    // refresh; expressive actions and cursor travel use the full cadence.
    const frameInterval = 1000 / (energetic || following
      ? (softwareBudget ? 24 : 30) : (softwareBudget ? 6 : 10));
    if (last && now - last < frameInterval) {
      requestAnimationFrame(draw);
      return;
    }
    const time = now * 0.001;
    const dt = Math.min(0.05, previousFrame ? time - previousFrame : 1 / 60);
    previousFrame = time;
    const active = !reduceMotion && document.visibilityState === 'visible';
    const has = (name) => wrap.classList.contains(name);
    const moon = has('moon-mode') || has('breathing') || has('moon-exit');
    const impact = has('dizzy');
    const wild = has('weee');
    const mild = has('weee-mild');
    const talking = has('shining') && !moon;
    const walking = has('walking');
    const checking = has('checking-update');
    const settling = has('settling');
    const cursorYaw = (has('facing-left') ? -1 : 1) * pointer.x * 0.13;
    let pitch = pointer.y * 0.10, yaw = cursorYaw, roll = 0, lift = 0;

    if (moon || !active) {
      pitch = yaw = roll = lift = 0;
    } else if (impact) {
      pitch = Math.sin(time * 17) * 0.13;
      yaw = Math.sin(time * 21) * 0.16;
      roll = Math.sin(time * 15) * 0.08;
    } else if (wild) {
      pitch = 0.09 + Math.sin(time * 9) * 0.045;
      yaw = Math.sin(time * 7) * 0.15;
      roll = Math.sin(time * 8) * 0.045;
    } else if (mild || settling) {
      pitch = pointer.y * 0.05 + Math.sin(time * 3.6) * 0.025;
      yaw = cursorYaw * 0.5 + Math.sin(time * 3) * 0.05;
      roll = Math.sin(time * 3) * 0.022;
    } else if (talking) {
      pitch = pointer.y * 0.08 + Math.sin(time * 5.5) * 0.035;
      yaw = cursorYaw + Math.sin(time * 3.2) * 0.045;
      roll = Math.sin(time * 4) * 0.025;
      lift = Math.sin(time * 6) * 0.012;
    } else if (checking) {
      yaw = Math.sin(time * 3) * 0.10;
      pitch = Math.sin(time * 2) * 0.05;
    } else if (walking) {
      pitch += 0.045;
    }
    const follow = active ? 1 - Math.exp(-dt * (impact ? 16 : 5)) : 1;
    main.rotation.x = mix(main.rotation.x, pitch, follow);
    main.rotation.y = mix(main.rotation.y, yaw, follow);
    main.rotation.z = mix(main.rotation.z, roll, follow);
    main.position.y = mix(main.position.y, lift, follow);
    const speaking = active && talking && !wild && !impact;
    mouth.scale.y = tongue.scale.y = speaking ? 0.86 + 0.14 * Math.abs(Math.sin(time * 12)) : 1;

    // A click gives the accents a short burst; a tip keeps them present
    // until its bubble closes. Breathing always clears the composition.
    const decorate = !moon && (talking || time < burstUntil);
    if (decorate && !wasDecorating) entranceAt = time;
    wasDecorating = decorate;
    for (const item of particles) {
      const delayed = Math.max(0, Math.min(1, (time - entranceAt - item.index * 0.075) / 0.48));
      const back = 1 + 2.70158 * Math.pow(delayed - 1, 3)
        + 1.70158 * Math.pow(delayed - 1, 2);
      const goal = decorate ? (active ? back : 1) : 0;
      item.amount = mix(item.amount, goal, 1 - Math.exp(-dt * (decorate ? 15 : 8)));
      const amount = Math.max(0, item.amount);
      item.mesh.visible = amount > 0.01;
      if (!item.mesh.visible) continue;
      const phase = item.index * 1.37;
      const pulse = active && time < pulseUntil ? 0.10 * Math.sin(Math.PI * (pulseUntil - time) / 0.42) : 0;
      item.mesh.scale.setScalar(item.size * Math.max(0.001, amount) * (1 + pulse));
      item.mesh.material.opacity = Math.min(1, amount);
      item.mesh.position.set(
        item.x + (active ? Math.sin(time * 1.1 + phase) * 0.012 : 0),
        item.y + (active ? Math.sin(time * 1.7 + phase) * 0.04 : 0),
        item.z,
      );
      item.mesh.rotation.set(
        active ? Math.sin(time * 1.0 + phase) * 0.08 : 0,
        active ? Math.sin(time * 0.8 + phase) * 0.18 : 0,
        item.angle + (active ? Math.sin(time * 1.2 + phase) * 0.10 : 0),
      );
    }
    if (active || now - last > 150) {
      try {
        renderer.render(scene, camera);
        host.classList.add('webgl-ready');
      } catch (error) {
        console.warn('Falha na renderização 3D:', error);
        host.classList.remove('webgl-ready');
        canvas.style.display = 'none';
        return;
      }
      last = now;
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
