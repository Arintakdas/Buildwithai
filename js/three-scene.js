/**
 * three-scene.js
 * ---------------------------------------------------------------------------
 * Reusable Three.js 3D scene module for a Google-style tech event website.
 * Provides hero, accent, verify-badge, and podium scenes with performance
 * optimisations, mouse parallax, scroll response, and graceful fallback.
 *
 * Exports:
 *   createHeroScene(container)    - full interactive hero background
 *   createAccentScene(container)  - lightweight decorative shapes
 *   createVerifyBadge(container)  - rotating badge with state transitions
 *   createPodiumScene(container)  - leaderboard podium blocks
 *   checkWebGLSupport()           - returns boolean
 *   checkReducedMotion()          - returns boolean
 * ---------------------------------------------------------------------------
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/* =========================================================================
   SHARED CONSTANTS AND UTILITIES
   ========================================================================= */

/** Google brand colours */
const COLORS = {
  blue:   0x4285F4,
  red:    0xEA4335,
  yellow: 0xFBBC04,
  green:  0x34A853,
  white:  0xFFFFFF,
  gray:   0x9AA0A6,
  amber:  0xF9AB00,
};

/** All four brand colours as an array for easy iteration */
const BRAND_PALETTE = [COLORS.blue, COLORS.red, COLORS.yellow, COLORS.green];

/* ---- Math helpers ---- */

/**
 * Linear interpolation between a and b by factor t.
 * @param {number} a - start value
 * @param {number} b - end value
 * @param {number} t - interpolation factor (0-1)
 * @returns {number}
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Smooth-step easing (ease-in-out).
 * @param {number} t - input 0-1
 * @returns {number}
 */
function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Clamp a value between min and max.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Debounce utility -- returns a wrapper that delays fn by `delay` ms.
 */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* =========================================================================
   SHARED GEOMETRY AND MATERIAL FACTORIES
   ========================================================================= */

/**
 * Create a low-poly rounded box geometry.
 * Three.js BoxGeometry with extra width/height/depth segments gives a
 * "rounded" feel when combined with flat or smooth shading.
 */
function createRoundedBox(w = 1, h = 1, d = 1, segments = 2) {
  return new THREE.BoxGeometry(w, h, d, segments, segments, segments);
}

/**
 * Create a matte MeshStandardMaterial in a Google brand colour.
 * @param {number} color - hex colour
 * @returns {THREE.MeshStandardMaterial}
 */
function createMatteMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.1,
    flatShading: false,
  });
}

/**
 * Create a glassy MeshPhysicalMaterial with partial transmission.
 * @param {number} color - hex colour
 * @returns {THREE.MeshPhysicalMaterial}
 */
function createGlassMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.15,
    metalness: 0.0,
    transmission: 0.6,
    thickness: 0.5,
    transparent: true,
    opacity: 0.85,
  });
}

/* =========================================================================
   SHARED RENDERER FACTORY
   ========================================================================= */

/**
 * Build a WebGLRenderer attached to the given container.
 * - Transparent background (alpha: true)
 * - Capped pixel ratio for performance
 * - Sized to container
 *
 * @param {HTMLElement} container
 * @returns {{ renderer: THREE.WebGLRenderer, canvas: HTMLCanvasElement }}
 */
function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0); // fully transparent
  container.appendChild(renderer.domElement);
  return { renderer, canvas: renderer.domElement };
}

/* =========================================================================
   SHARED LIFECYCLE HELPERS
   ========================================================================= */

/**
 * Set up IntersectionObserver + visibilitychange so the animation loop
 * pauses when the canvas is off-screen or the tab is hidden.
 *
 * Returns an object { isActive(), cleanup() }.
 */
function createVisibilityGuard(canvas) {
  let tabVisible = !document.hidden;
  let onScreen = true;

  const onVisChange = () => {
    tabVisible = !document.hidden;
  };
  document.addEventListener('visibilitychange', onVisChange);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        onScreen = e.isIntersecting;
      });
    },
    { threshold: 0 }
  );
  observer.observe(canvas);

  return {
    /** True when we should keep rendering */
    isActive() {
      return tabVisible && onScreen;
    },
    cleanup() {
      document.removeEventListener('visibilitychange', onVisChange);
      observer.disconnect();
    },
  };
}

/**
 * Set up a debounced resize handler that updates camera aspect and
 * renderer size to match the container.
 *
 * @returns {{ cleanup: Function }}
 */
function createResizeHandler(container, camera, renderer) {
  const onResize = debounce(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }, 150);

  window.addEventListener('resize', onResize);
  return {
    cleanup() {
      window.removeEventListener('resize', onResize);
    },
  };
}

/* =========================================================================
   DISPOSE HELPER
   ========================================================================= */

/**
 * Recursively dispose geometries, materials, and textures in a scene.
 */
function disposeSceneResources(scene) {
  scene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => disposeMaterial(m));
      } else {
        disposeMaterial(obj.material);
      }
    }
  });
}

function disposeMaterial(mat) {
  if (!mat) return;
  // Dispose any textures attached to the material
  for (const key of Object.keys(mat)) {
    const value = mat[key];
    if (value && value.isTexture) {
      value.dispose();
    }
  }
  mat.dispose();
}

/* =========================================================================
   1. HERO SCENE
   ========================================================================= */

/**
 * Create the full interactive hero background scene.
 *
 * Features:
 * - Floating geometric shapes (boxes, spheres, torus, tetrahedra)
 * - Central "neural network" cluster (ring of spheres + connecting lines)
 * - Mouse parallax (touch devices get automatic gentle motion)
 * - Scroll-based parallax depth
 * - Gentle float animation with sin(time) offsets
 *
 * @param {HTMLElement} container - DOM element to mount the canvas into
 * @returns {Object} { renderer, scene, camera, animate, dispose }
 */
export function createHeroScene(container) {
  /* ---- Scene, Camera, Renderer ---- */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 12);

  const { renderer, canvas } = createRenderer(container);

  /* ---- Lighting ---- */
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight1.position.set(5, 8, 6);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(COLORS.blue, 0.3);
  dirLight2.position.set(-4, -3, 4);
  scene.add(dirLight2);

  const dirLight3 = new THREE.DirectionalLight(COLORS.yellow, 0.2);
  dirLight3.position.set(0, -5, 2);
  scene.add(dirLight3);

  /* ---- Shared geometries (reused across shapes) ---- */
  const boxGeo      = createRoundedBox(0.7, 0.7, 0.7, 2);
  const sphereGeo   = new THREE.SphereGeometry(0.4, 12, 10);
  const torusGeo    = new THREE.TorusGeometry(0.5, 0.15, 10, 24);
  const tetraGeo    = new THREE.TetrahedronGeometry(0.5, 0);
  const smallBoxGeo = createRoundedBox(0.3, 0.3, 0.3, 1);

  /* ---- Shared materials (one per brand colour, matte) ---- */
  const matteMats = BRAND_PALETTE.map((c) => createMatteMaterial(c));
  const glassMats = BRAND_PALETTE.map((c) => createGlassMaterial(c));

  /* ---- Floating peripheral shapes ---- */

  /**
   * Each entry: { mesh, basePos, floatSpeed, floatAmp, rotSpeed }
   * We place shapes in a rough ring around the centre.
   */
  const floatingShapes = [];

  const shapeConfigs = [
    { geo: boxGeo,    pos: [-4.5, 2.5, -2],  mat: matteMats[0] },
    { geo: sphereGeo, pos: [4.0, -2.0, -1],  mat: glassMats[1] },
    { geo: torusGeo,  pos: [-3.5, -3.0, -3], mat: matteMats[2] },
    { geo: tetraGeo,  pos: [5.0, 1.5, -2],   mat: matteMats[3] },
    { geo: boxGeo,    pos: [3.0, 3.5, -4],   mat: glassMats[0] },
    { geo: sphereGeo, pos: [-5.0, 0.5, -3],  mat: matteMats[1] },
    { geo: torusGeo,  pos: [1.5, -3.5, -2],  mat: glassMats[2] },
    { geo: tetraGeo,  pos: [-2.0, 3.5, -1],  mat: matteMats[3] },
    { geo: boxGeo,    pos: [-1.5, -2.5, -4], mat: glassMats[3] },
    { geo: sphereGeo, pos: [5.5, -0.5, -3],  mat: matteMats[2] },
  ];

  shapeConfigs.forEach((cfg, i) => {
    const mesh = new THREE.Mesh(cfg.geo, cfg.mat);
    mesh.position.set(...cfg.pos);
    // Give each shape a random initial rotation so they don't look uniform
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    scene.add(mesh);

    floatingShapes.push({
      mesh,
      basePos: new THREE.Vector3(...cfg.pos),
      floatSpeed: 0.4 + Math.random() * 0.4,   // seconds-1
      floatAmp: 0.15 + Math.random() * 0.2,     // world units
      phaseOffset: (i / shapeConfigs.length) * Math.PI * 2,
      rotSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.15
      ),
    });
  });

  /* ---- Central cluster: ring of spheres + connecting lines ---- */

  const clusterGroup = new THREE.Group();
  scene.add(clusterGroup);

  const nodeSphereGeo = new THREE.SphereGeometry(0.15, 8, 6);
  const nodePositions = [];
  const nodeCount = 8;
  const ringRadius = 1.6;

  for (let i = 0; i < nodeCount; i++) {
    const angle = (i / nodeCount) * Math.PI * 2;
    const x = Math.cos(angle) * ringRadius;
    const y = Math.sin(angle) * ringRadius * 0.6; // slightly elliptical
    const z = Math.sin(angle * 2) * 0.4;          // slight depth variation

    const mat = matteMats[i % matteMats.length];
    const nodeMesh = new THREE.Mesh(nodeSphereGeo, mat);
    nodeMesh.position.set(x, y, z);
    clusterGroup.add(nodeMesh);
    nodePositions.push(new THREE.Vector3(x, y, z));
  }

  // Add a central hub node
  const hubMat = createMatteMaterial(COLORS.blue);
  const hubMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    hubMat
  );
  clusterGroup.add(hubMesh);
  nodePositions.push(new THREE.Vector3(0, 0, 0)); // hub is last

  // Connect nodes with thin lines (BufferGeometry)
  const lineMatColor = new THREE.Color(COLORS.blue);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: lineMatColor,
    transparent: true,
    opacity: 0.35,
  });

  // Lines from each node to the hub, plus adjacent ring connections
  const linePoints = [];
  for (let i = 0; i < nodeCount; i++) {
    // Node to hub
    linePoints.push(nodePositions[i].x, nodePositions[i].y, nodePositions[i].z);
    linePoints.push(0, 0, 0);
    // Node to next neighbour
    const next = (i + 1) % nodeCount;
    linePoints.push(nodePositions[i].x, nodePositions[i].y, nodePositions[i].z);
    linePoints.push(nodePositions[next].x, nodePositions[next].y, nodePositions[next].z);
  }

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(linePoints, 3)
  );
  const lineSegments = new THREE.LineSegments(lineGeo, lineMaterial);
  clusterGroup.add(lineSegments);

  // Add a few small cubes scattered in the cluster to suggest "code blocks"
  for (let i = 0; i < 5; i++) {
    const cubeMesh = new THREE.Mesh(smallBoxGeo, glassMats[i % glassMats.length]);
    const angle = Math.random() * Math.PI * 2;
    const r = 0.6 + Math.random() * 0.8;
    cubeMesh.position.set(
      Math.cos(angle) * r,
      Math.sin(angle) * r * 0.7,
      (Math.random() - 0.5) * 0.6
    );
    cubeMesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      0
    );
    clusterGroup.add(cubeMesh);
  }

  /* ---- Mouse parallax state ---- */
  const mouse = { x: 0, y: 0 };           // normalised -1..1
  const smoothMouse = { x: 0, y: 0 };     // lerped value
  let isTouchDevice = false;

  const onMouseMove = (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
  };

  const onTouchStart = () => {
    isTouchDevice = true;
    // Remove mouse listener once we know it is a touch device
    window.removeEventListener('mousemove', onMouseMove);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('touchstart', onTouchStart, { once: true });

  /* ---- Scroll parallax state ---- */
  let scrollY = 0;
  const onScroll = () => {
    scrollY = window.scrollY || window.pageYOffset;
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---- Lifecycle guards ---- */
  const visibility = createVisibilityGuard(canvas);
  const resizer = createResizeHandler(container, camera, renderer);

  /* ---- Animation loop ---- */
  let animFrameId = null;
  const clock = new THREE.Clock();

  function tick() {
    animFrameId = requestAnimationFrame(tick);

    if (!visibility.isActive()) return; // skip render when hidden

    const elapsed = clock.getElapsedTime();

    // --- Mouse parallax (smooth) ---
    if (isTouchDevice) {
      // Automatic gentle sway for touch devices
      mouse.x = Math.sin(elapsed * 0.3) * 0.3;
      mouse.y = Math.cos(elapsed * 0.2) * 0.2;
    }
    smoothMouse.x = lerp(smoothMouse.x, mouse.x, 0.05);
    smoothMouse.y = lerp(smoothMouse.y, mouse.y, 0.05);

    // Scroll factor (normalised so first viewport is 0..1)
    const scrollFactor = scrollY / (window.innerHeight || 1);

    // --- Animate floating shapes ---
    floatingShapes.forEach((s) => {
      const t = elapsed * s.floatSpeed + s.phaseOffset;

      // Bobbing
      s.mesh.position.y = s.basePos.y + Math.sin(t) * s.floatAmp;
      s.mesh.position.x = s.basePos.x + Math.cos(t * 0.7) * s.floatAmp * 0.4;

      // Mouse parallax offset (deeper shapes move less -- simple depth factor)
      const depthFactor = 1.0 + (s.basePos.z * -0.15);
      s.mesh.position.x += smoothMouse.x * 0.5 * depthFactor;
      s.mesh.position.y += smoothMouse.y * 0.3 * depthFactor;

      // Scroll parallax -- push shapes upward as user scrolls
      s.mesh.position.y += scrollFactor * s.basePos.z * 0.15;

      // Slow rotation
      s.mesh.rotation.x += s.rotSpeed.x * 0.016;
      s.mesh.rotation.y += s.rotSpeed.y * 0.016;
      s.mesh.rotation.z += s.rotSpeed.z * 0.016;
    });

    // --- Animate central cluster ---
    clusterGroup.rotation.y = elapsed * 0.08;
    clusterGroup.rotation.x = Math.sin(elapsed * 0.15) * 0.1;

    // Mouse influence on cluster
    clusterGroup.position.x = smoothMouse.x * -0.4;
    clusterGroup.position.y = smoothMouse.y * -0.25;

    // Scroll: cluster drifts upward
    clusterGroup.position.y -= scrollFactor * 0.5;

    renderer.render(scene, camera);
  }

  /* ---- Public API ---- */

  function animate() {
    clock.start();
    tick();
  }

  function dispose() {
    cancelAnimationFrame(animFrameId);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('scroll', onScroll);
    visibility.cleanup();
    resizer.cleanup();
    disposeSceneResources(scene);
    renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  return { renderer, scene, camera, animate, dispose };
}

/* =========================================================================
   2. ACCENT SCENE
   ========================================================================= */

/**
 * Create a lightweight decorative 3D accent scene.
 * 1-3 slowly rotating shapes suitable for section backgrounds.
 *
 * @param {HTMLElement} container
 * @returns {Object} { renderer, scene, camera, animate, dispose }
 */
export function createAccentScene(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    50
  );
  camera.position.set(0, 0, 6);

  const { renderer, canvas } = createRenderer(container);

  /* Lighting -- simple and soft */
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(3, 4, 5);
  scene.add(dirLight);

  /* Shared geometries */
  const torusGeo  = new THREE.TorusGeometry(0.6, 0.18, 10, 24);
  const sphereGeo = new THREE.SphereGeometry(0.35, 10, 8);
  const boxGeo    = createRoundedBox(0.4, 0.4, 0.4, 1);

  /* Create three accent shapes */
  const shapes = [];

  const configs = [
    { geo: torusGeo,  color: COLORS.blue,   pos: [-1.2, 0.5, 0] },
    { geo: sphereGeo, color: COLORS.green,  pos: [1.0, -0.4, -0.5] },
    { geo: boxGeo,    color: COLORS.yellow, pos: [0.3, 0.8, -1] },
  ];

  configs.forEach((cfg, i) => {
    const mat = createMatteMaterial(cfg.color);
    const mesh = new THREE.Mesh(cfg.geo, mat);
    mesh.position.set(...cfg.pos);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    scene.add(mesh);
    shapes.push({
      mesh,
      rotSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.15,
        0
      ),
      floatPhase: (i / configs.length) * Math.PI * 2,
      baseY: cfg.pos[1],
    });
  });

  /* Lifecycle */
  const visibility = createVisibilityGuard(canvas);
  const resizer = createResizeHandler(container, camera, renderer);
  let animFrameId = null;
  const clock = new THREE.Clock();

  function tick() {
    animFrameId = requestAnimationFrame(tick);
    if (!visibility.isActive()) return;

    const elapsed = clock.getElapsedTime();

    shapes.forEach((s) => {
      s.mesh.rotation.x += s.rotSpeed.x * 0.016;
      s.mesh.rotation.y += s.rotSpeed.y * 0.016;
      s.mesh.position.y = s.baseY + Math.sin(elapsed * 0.5 + s.floatPhase) * 0.12;
    });

    renderer.render(scene, camera);
  }

  function animate() {
    clock.start();
    tick();
  }

  function dispose() {
    cancelAnimationFrame(animFrameId);
    visibility.cleanup();
    resizer.cleanup();
    disposeSceneResources(scene);
    renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  return { renderer, scene, camera, animate, dispose };
}

/* =========================================================================
   3. VERIFY BADGE
   ========================================================================= */

/**
 * Create a slowly rotating badge / shield shape whose colour transitions
 * based on verification state.
 *
 * States: 'loading' (neutral), 'success' (green), 'error' (red), 'revoked' (amber)
 *
 * @param {HTMLElement} container
 * @returns {Object} { renderer, scene, camera, animate, dispose, setBadgeState }
 */
export function createVerifyBadge(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    40,
    container.clientWidth / container.clientHeight,
    0.1,
    30
  );
  camera.position.set(0, 0, 5);

  const { renderer, canvas } = createRenderer(container);

  /* Lighting */
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(2, 3, 4);
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight(COLORS.blue, 0.3);
  rimLight.position.set(-3, -1, 2);
  scene.add(rimLight);

  /* Badge mesh -- dodecahedron gives a nice shield-like faceted look */
  const badgeGeo = new THREE.DodecahedronGeometry(1.0, 0);
  const badgeMat = new THREE.MeshStandardMaterial({
    color: COLORS.gray,
    roughness: 0.4,
    metalness: 0.15,
    flatShading: true,
  });
  const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
  // Slightly squash on Z for a more shield-like profile
  badgeMesh.scale.set(1, 1.15, 0.6);
  scene.add(badgeMesh);

  // Add a subtle inner ring (torus) for visual flair
  const ringGeo = new THREE.TorusGeometry(1.15, 0.04, 8, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: COLORS.gray,
    roughness: 0.5,
    metalness: 0.1,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  scene.add(ringMesh);

  /* State management */
  const STATE_COLORS = {
    loading: new THREE.Color(COLORS.gray),
    success: new THREE.Color(COLORS.green),
    error:   new THREE.Color(COLORS.red),
    revoked: new THREE.Color(COLORS.amber),
  };

  let targetColor = STATE_COLORS.loading.clone();
  let currentColor = STATE_COLORS.loading.clone();

  /**
   * Transition badge to a new state.
   * @param {'loading'|'success'|'error'|'revoked'} state
   */
  function setBadgeState(state) {
    const col = STATE_COLORS[state];
    if (col) {
      targetColor.copy(col);
    }
  }

  /* Lifecycle */
  const visibility = createVisibilityGuard(canvas);
  const resizer = createResizeHandler(container, camera, renderer);
  let animFrameId = null;
  const clock = new THREE.Clock();

  function tick() {
    animFrameId = requestAnimationFrame(tick);
    if (!visibility.isActive()) return;

    const elapsed = clock.getElapsedTime();

    // Slow rotation
    badgeMesh.rotation.y = elapsed * 0.3;
    badgeMesh.rotation.x = Math.sin(elapsed * 0.2) * 0.1;
    ringMesh.rotation.y = elapsed * 0.3;
    ringMesh.rotation.z = elapsed * 0.15;

    // Gentle float
    badgeMesh.position.y = Math.sin(elapsed * 0.6) * 0.08;
    ringMesh.position.y = badgeMesh.position.y;

    // Smooth colour transition (lerp each RGB channel)
    currentColor.r = lerp(currentColor.r, targetColor.r, 0.04);
    currentColor.g = lerp(currentColor.g, targetColor.g, 0.04);
    currentColor.b = lerp(currentColor.b, targetColor.b, 0.04);

    badgeMat.color.copy(currentColor);
    ringMat.color.copy(currentColor);

    renderer.render(scene, camera);
  }

  function animate() {
    clock.start();
    tick();
  }

  function dispose() {
    cancelAnimationFrame(animFrameId);
    visibility.cleanup();
    resizer.cleanup();
    disposeSceneResources(scene);
    renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  return { renderer, scene, camera, animate, dispose, setBadgeState };
}

/* =========================================================================
   4. LEADERBOARD PODIUM
   ========================================================================= */

/**
 * Create three podium blocks at varying heights for a leaderboard display.
 *
 * Layout (looking at the scene from the front):
 *   2nd (left) | 1st (centre, tallest) | 3rd (right)
 *
 * @param {HTMLElement} container
 * @returns {Object} { renderer, scene, camera, animate, dispose }
 */
export function createPodiumScene(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    40,
    container.clientWidth / container.clientHeight,
    0.1,
    30
  );
  camera.position.set(0, 1.5, 7);
  camera.lookAt(0, 0.5, 0);

  const { renderer, canvas } = createRenderer(container);

  /* Lighting */
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
  dirLight.position.set(3, 6, 5);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(COLORS.blue, 0.2);
  fillLight.position.set(-3, 2, 3);
  scene.add(fillLight);

  /* Podium blocks */
  const podiumData = [
    // { label, height, xPos, color }
    { label: '2nd', height: 1.5, x: -1.6, color: COLORS.red },
    { label: '1st', height: 2.2, x: 0,    color: COLORS.blue },
    { label: '3rd', height: 1.0, x: 1.6,  color: COLORS.green },
  ];

  const podiums = [];
  const blockWidth = 1.2;
  const blockDepth = 1.0;
  const segments = 2; // rounded box segments

  podiumData.forEach((p) => {
    const geo = createRoundedBox(blockWidth, p.height, blockDepth, segments);
    const mat = createMatteMaterial(p.color);
    const mesh = new THREE.Mesh(geo, mat);
    // Position so bottom of each block sits on y=0
    mesh.position.set(p.x, p.height / 2, 0);
    scene.add(mesh);
    podiums.push({ mesh, baseY: p.height / 2 });
  });

  /* Lifecycle */
  const visibility = createVisibilityGuard(canvas);
  const resizer = createResizeHandler(container, camera, renderer);
  let animFrameId = null;
  const clock = new THREE.Clock();

  function tick() {
    animFrameId = requestAnimationFrame(tick);
    if (!visibility.isActive()) return;

    const elapsed = clock.getElapsedTime();

    // Gentle float for each podium block (slightly staggered)
    podiums.forEach((p, i) => {
      p.mesh.position.y =
        p.baseY + Math.sin(elapsed * 0.5 + i * 1.2) * 0.06;
    });

    renderer.render(scene, camera);
  }

  function animate() {
    clock.start();
    tick();
  }

  function dispose() {
    cancelAnimationFrame(animFrameId);
    visibility.cleanup();
    resizer.cleanup();
    disposeSceneResources(scene);
    renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  return { renderer, scene, camera, animate, dispose };
}

/* =========================================================================
   5. CAPABILITY CHECKS (FALLBACK)
   ========================================================================= */

/**
 * Test whether the current browser/device supports WebGL.
 * Returns true if WebGL is available, false otherwise.
 *
 * @returns {boolean}
 */
export function checkWebGLSupport() {
  try {
    const testCanvas = document.createElement('canvas');
    const gl =
      testCanvas.getContext('webgl2') ||
      testCanvas.getContext('webgl') ||
      testCanvas.getContext('experimental-webgl');
    return !!gl;
  } catch (_err) {
    return false;
  }
}

/**
 * Check whether the user prefers reduced motion.
 * Returns true if the user has enabled "prefers-reduced-motion: reduce".
 *
 * @returns {boolean}
 */
export function checkReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
