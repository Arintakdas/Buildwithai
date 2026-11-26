/**
 * notices-page.js
 * ---------------
 * ES module for the dedicated Notice Board page (/notices/index.html).
 * Initializes navigation, scroll reveal, and the full notice board with
 * category filter chips.
 */

import { initNoticeBoard } from '/js/notices.js';
import { initNav } from '/js/nav.js';
import { initScrollReveal } from '/js/scroll-reveal.js';
import { createAccentScene, checkWebGLSupport, checkReducedMotion } from '/js/three-scene.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    initNav();
  } catch (err) {
    console.error('[notices-page.js] Nav init failed:', err);
  }

  try {
    initScrollReveal();
  } catch (err) {
    console.error('[notices-page.js] Scroll reveal init failed:', err);
  }

  const container = document.getElementById('notice-board-full');
  if (container) {
    try {
      await initNoticeBoard(container, { limit: null, showFilters: true });
    } catch (err) {
      console.error('[notices-page.js] Notice board init failed:', err);
    }
  }

  const accentContainer = document.getElementById('notices-accent-canvas');
  if (accentContainer && checkWebGLSupport() && !checkReducedMotion()) {
    try {
      createAccentScene(accentContainer);
    } catch (err) {
      console.error('[notices-page.js] Accent 3D scene failed:', err);
    }
  }
});
