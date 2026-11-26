/**
 * main.js -- Main entry point for the Google-style tech event website.
 *
 * This ES module bootstraps every interactive feature on the home page
 * (index.html).  Each subsystem is wrapped in its own try/catch so that
 * a single failure never tears down the rest of the page.  The site is
 * built with progressive enhancement in mind: all critical content is
 * accessible even when JavaScript is disabled or a module fails to load.
 *
 * Initialization order:
 *   1. Navigation
 *   2. Scroll-reveal animations
 *   3. Countdown timer
 *   4. Three.js 3D scenes (hero, accent, podium)
 *   5. Leaderboard
 *   6. Notice board
 *   7. Certificate verification widget
 *   8. Events timeline status badges
 *   9. FAQ accordion enhancements
 */

// ---------------------------------------------------------------------------
// Module imports
// ---------------------------------------------------------------------------
import { createHeroScene, createAccentScene, createPodiumScene, checkWebGLSupport, checkReducedMotion } from '/js/three-scene.js';
import { initCountdown } from '/js/countdown.js';
import { initScrollReveal } from '/js/scroll-reveal.js';
import { initNav } from '/js/nav.js';
import { initLeaderboard } from '/js/leaderboard.js';
import { initNoticeBoard } from '/js/notices.js';
import { verifyCertificate } from '/js/data-loader.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely run an initializer.  If it throws, the error is logged and the
 * rest of the page continues to work.
 *
 * @param {string}   label  Human-readable name shown in the console.
 * @param {Function} fn     The initialization function to execute.
 */
function safeInit(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[main.js] Failed to initialize "${label}":`, err);
  }
}

/**
 * Async variant of safeInit for modules that return promises.
 *
 * @param {string}   label  Human-readable name shown in the console.
 * @param {Function} fn     Async initialization function.
 */
async function safeInitAsync(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`[main.js] Failed to initialize "${label}":`, err);
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {

  // -----------------------------------------------------------------------
  // 1. Navigation
  // -----------------------------------------------------------------------
  safeInit('Navigation', () => {
    initNav();
  });

  // -----------------------------------------------------------------------
  // 2. Scroll-reveal animations
  // -----------------------------------------------------------------------
  safeInit('Scroll Reveal', () => {
    initScrollReveal();
  });

  // -----------------------------------------------------------------------
  // 3. Countdown timer
  // -----------------------------------------------------------------------
  safeInit('Countdown', () => {
    // Event date: 28 November 2026, 12:00 PM IST (UTC+05:30)
    const targetDate = new Date('2026-11-28T12:00:00+05:30');
    const container = document.getElementById('countdown');

    if (container) {
      initCountdown(targetDate, container);
    }
  });

  // -----------------------------------------------------------------------
  // 4. Three.js 3D scenes
  // -----------------------------------------------------------------------
  safeInit('3D Scenes', () => {
    const webglSupported = checkWebGLSupport();
    const prefersReducedMotion = checkReducedMotion();

    // Collect all fallback and canvas elements upfront
    const heroFallbacks = document.querySelectorAll('.hero-fallback');
    const heroCanvasContainer = document.getElementById('hero-canvas-container');
    const aboutCanvasContainer = document.getElementById('about-canvas-container');
    const ctaCanvasContainer = document.getElementById('cta-canvas-container');

    if (webglSupported && !prefersReducedMotion) {
      // --- Hero scene ---
      if (heroCanvasContainer) {
        createHeroScene(heroCanvasContainer);
      }

      // --- Accent scenes for About and CTA sections ---
      if (aboutCanvasContainer) {
        createAccentScene(aboutCanvasContainer);
      }
      if (ctaCanvasContainer) {
        createAccentScene(ctaCanvasContainer);
      }
    } else {
      // WebGL unavailable or user prefers reduced motion.
      // Show every static fallback and hide the 3D containers.
      heroFallbacks.forEach((el) => {
        el.style.display = '';
        el.removeAttribute('hidden');
      });

      const canvasContainers = [heroCanvasContainer, aboutCanvasContainer, ctaCanvasContainer];
      canvasContainers.forEach((el) => {
        if (el) {
          el.style.display = 'none';
          el.setAttribute('aria-hidden', 'true');
        }
      });

      // Reveal any static SVG fallbacks that may be hidden by default
      const svgFallbacks = document.querySelectorAll('.svg-fallback');
      svgFallbacks.forEach((el) => {
        el.style.display = '';
        el.removeAttribute('hidden');
      });
    }
  });

  // -----------------------------------------------------------------------
  // 5. Leaderboard (and optional podium 3D scene)
  // -----------------------------------------------------------------------
  safeInit('Leaderboard', () => {
    const leaderboardContainer = document.getElementById('leaderboard-container');

    if (leaderboardContainer) {
      initLeaderboard(leaderboardContainer);
    }

    // If WebGL is available the podium scene complements the leaderboard
    const podiumContainer = document.getElementById('podium-container');
    if (podiumContainer && checkWebGLSupport() && !checkReducedMotion()) {
      createPodiumScene(podiumContainer);
    }
  });

  // -----------------------------------------------------------------------
  // 6. Notice board
  // -----------------------------------------------------------------------
  safeInit('Notice Board', () => {
    const noticeBoardPreview = document.getElementById('notice-board-preview');

    if (noticeBoardPreview) {
      initNoticeBoard(noticeBoardPreview, { limit: 3, showFilters: false });
    }
  });

  // -----------------------------------------------------------------------
  // 7. Home-page certificate verification widget
  // -----------------------------------------------------------------------
  safeInit('Verify Widget', () => {
    const verifyInput = document.getElementById('verify-input');
    const verifyButton = document.getElementById('verify-button');
    const verifyResult = document.getElementById('verify-result');

    // Bail out gracefully if the markup is missing
    if (!verifyInput || !verifyButton || !verifyResult) {
      return;
    }

    /**
     * Clear previous result content safely.
     */
    function clearResult() {
      while (verifyResult.firstChild) {
        verifyResult.removeChild(verifyResult.firstChild);
      }
      // Reset any status classes
      verifyResult.className = 'verify-result';
    }

    /**
     * Create a small inline SVG icon element for verification status.
     *
     * @param {'verified'|'not_found'|'revoked'|'error'} type
     * @returns {SVGSVGElement}
     */
    function createStatusIcon(type) {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '20');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.verticalAlign = 'middle';
      svg.style.marginRight = '6px';
      svg.style.flexShrink = '0';

      const path = document.createElementNS(ns, 'path');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');

      switch (type) {
        case 'verified':
          // Checkmark circle -- green
          path.setAttribute('d', 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z');
          path.setAttribute('stroke', '#0d652d');
          break;
        case 'not_found':
          // X circle -- red
          path.setAttribute('d', 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z');
          path.setAttribute('stroke', '#c5221f');
          break;
        case 'revoked':
          // Warning triangle -- amber
          path.setAttribute('d', 'M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z');
          path.setAttribute('stroke', '#e37400');
          break;
        default:
          // Info circle -- grey (error / unknown)
          path.setAttribute('d', 'M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z');
          path.setAttribute('stroke', '#5f6368');
          break;
      }

      svg.appendChild(path);
      return svg;
    }

    /**
     * Display the verification outcome inside #verify-result.
     * All content is inserted with textContent / createElement -- never
     * innerHTML -- to prevent injection.
     *
     * @param {object} result  The object returned by verifyCertificate().
     */
    function showResult(result) {
      clearResult();

      const wrapper = document.createElement('span');
      wrapper.style.display = 'inline-flex';
      wrapper.style.alignItems = 'center';

      if (!result || !result.status) {
        const icon = createStatusIcon('error');
        const text = document.createElement('span');
        text.textContent = 'Could not verify. Try the full verification page.';
        wrapper.appendChild(icon);
        wrapper.appendChild(text);
        verifyResult.classList.add('verify-result--error');
        verifyResult.appendChild(wrapper);
        return;
      }

      switch (result.status) {
        case 'verified': {
          const icon = createStatusIcon('verified');
          const text = document.createElement('span');
          const participantName = result.data && result.data.name ? result.data.name : '';
          const displayName = participantName ? ' -- ' + participantName : '';
          text.textContent = 'Certificate verified' + displayName;
          wrapper.appendChild(icon);
          wrapper.appendChild(text);
          verifyResult.classList.add('verify-result--verified');
          break;
        }

        case 'not_found': {
          const icon = createStatusIcon('not_found');
          const text = document.createElement('span');
          text.textContent = 'Certificate not found';
          wrapper.appendChild(icon);
          wrapper.appendChild(text);
          verifyResult.classList.add('verify-result--not-found');
          break;
        }

        case 'revoked': {
          const icon = createStatusIcon('revoked');
          const text = document.createElement('span');
          text.textContent = 'Certificate revoked';
          wrapper.appendChild(icon);
          wrapper.appendChild(text);
          verifyResult.classList.add('verify-result--revoked');
          break;
        }

        default: {
          const icon = createStatusIcon('error');
          const text = document.createElement('span');
          text.textContent = 'Could not verify. Try the full verification page.';
          wrapper.appendChild(icon);
          wrapper.appendChild(text);
          verifyResult.classList.add('verify-result--error');
          break;
        }
      }

      verifyResult.appendChild(wrapper);
    }

    /**
     * Handle the verify action triggered by button click or Enter key.
     */
    async function handleVerify() {
      const id = verifyInput.value.trim();

      if (!id) {
        clearResult();
        const msg = document.createElement('span');
        msg.textContent = 'Please enter a certificate number';
        msg.classList.add('verify-result--empty');
        verifyResult.appendChild(msg);
        return;
      }

      // Show a brief loading state
      clearResult();
      const loading = document.createElement('span');
      loading.textContent = 'Verifying...';
      verifyResult.appendChild(loading);

      try {
        const result = await verifyCertificate(id);
        showResult(result);
      } catch (err) {
        console.error('[main.js] Certificate verification error:', err);
        showResult(null);
      }
    }

    // Button click
    verifyButton.addEventListener('click', handleVerify);

    // Enter key inside the input field
    verifyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleVerify();
      }
    });
  });

  // -----------------------------------------------------------------------
  // 8. Events timeline status badges
  // -----------------------------------------------------------------------
  safeInit('Timeline Status', () => {
    const schedule = document.getElementById('schedule');
    if (!schedule) {
      return;
    }

    const timelineItems = schedule.querySelectorAll('.timeline-item');
    if (!timelineItems.length) {
      return;
    }

    // The main event date -- 28 Nov 2026, 12:00 PM IST
    const eventDate = new Date('2026-11-28T12:00:00+05:30');
    const now = new Date();

    // If the entire event day is in the past, mark everything as completed
    const eventDayPast = now > eventDate;

    // Track the first upcoming item so we can attach a mini countdown
    let firstUpcomingItem = null;

    timelineItems.forEach((item) => {
      const dateAttr = item.getAttribute('data-date');
      if (!dateAttr) {
        return;
      }

      const itemDate = new Date(dateAttr);

      // Determine today boundaries in the item's context
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      let status;
      let cssClass;

      if (eventDayPast || itemDate < todayStart) {
        status = 'Completed';
        cssClass = 'timeline-item--completed';
      } else if (itemDate >= todayStart && itemDate < todayEnd) {
        status = 'Live';
        cssClass = 'timeline-item--live';
      } else {
        status = 'Upcoming';
        cssClass = 'timeline-item--upcoming';

        // Track the nearest upcoming item
        if (!firstUpcomingItem || itemDate < new Date(firstUpcomingItem.getAttribute('data-date'))) {
          firstUpcomingItem = item;
        }
      }

      // Apply the status class
      item.classList.add(cssClass);

      // Create and insert a status badge (only if one does not already exist)
      if (!item.querySelector('.timeline-badge')) {
        const badge = document.createElement('span');
        badge.classList.add('timeline-badge', 'timeline-badge--' + status.toLowerCase());
        badge.textContent = status;
        badge.setAttribute('aria-label', 'Status: ' + status);

        // Insert the badge as the first child of the item so it appears
        // prominently without breaking existing layout flow.
        item.insertBefore(badge, item.firstChild);
      }
    });

    // Mini countdown for the next upcoming item
    if (firstUpcomingItem && !eventDayPast) {
      const upcomingDate = new Date(firstUpcomingItem.getAttribute('data-date'));

      const miniCountdown = document.createElement('span');
      miniCountdown.classList.add('timeline-mini-countdown');

      /**
       * Update the mini countdown text every second.
       */
      function updateMiniCountdown() {
        const diff = upcomingDate - Date.now();

        if (diff <= 0) {
          miniCountdown.textContent = 'Starting now';
          clearInterval(miniTimer);
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        const parts = [];
        if (days > 0) parts.push(days + 'd');
        if (hours > 0) parts.push(hours + 'h');
        if (minutes > 0) parts.push(minutes + 'm');
        parts.push(seconds + 's');

        miniCountdown.textContent = 'Starts in ' + parts.join(' ');
      }

      updateMiniCountdown();
      const miniTimer = setInterval(updateMiniCountdown, 1000);

      firstUpcomingItem.appendChild(miniCountdown);
    }
  });

  // -----------------------------------------------------------------------
  // 9. FAQ accordion keyboard and ARIA enhancements
  // -----------------------------------------------------------------------
  safeInit('FAQ Accordion', () => {
    // Native <details>/<summary> already toggle on click.  Here we ensure
    // consistent keyboard handling and proper ARIA attributes for
    // assistive-technology users.
    const detailsElements = document.querySelectorAll('.faq details');
    if (!detailsElements.length) {
      return;
    }

    detailsElements.forEach((details) => {
      const summary = details.querySelector('summary');
      if (!summary) {
        return;
      }

      // Set the initial aria-expanded state
      summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');

      // Ensure the summary is focusable (should be by default, but be safe)
      if (!summary.getAttribute('tabindex')) {
        summary.setAttribute('tabindex', '0');
      }

      // Keep aria-expanded in sync whenever the details toggles
      details.addEventListener('toggle', () => {
        summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
      });

      // Explicit keyboard handling for Enter and Space
      summary.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();

          // Toggle the open attribute
          details.open = !details.open;

          // Manually fire the toggle event for browsers that might not
          // dispatch it when programmatically changing `open`.
          details.dispatchEvent(new Event('toggle'));
        }
      });
    });
  });

}); // end DOMContentLoaded
