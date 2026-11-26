/**
 * scroll-reveal.js
 * ----------------
 * ES module that uses IntersectionObserver to animate elements on scroll.
 * Elements are identified by the `data-reveal` attribute. Supported
 * animation types: fade-up (default), fade-left, fade-right, fade-in,
 * scale-up. Respects the prefers-reduced-motion user preference.
 */

/**
 * Map of reveal types to their initial CSS transform values.
 * When an element is "revealed", transform resets to "none" and opacity
 * transitions to 1 via the .revealed class.
 */
const TRANSFORM_MAP = {
  'fade-up': 'translateY(30px)',
  'fade-left': 'translateX(-30px)',
  'fade-right': 'translateX(30px)',
  'fade-in': 'none',
  'scale-up': 'scale(0.92)'
};

/**
 * Default transition duration and easing applied to revealable elements.
 */
const TRANSITION_DURATION = '0.6s';
const TRANSITION_EASING = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';

/**
 * Check whether the user has requested reduced motion.
 * @returns {boolean}
 */
function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Apply the initial hidden styles to an element based on its reveal type.
 * @param {HTMLElement} element
 * @param {string} revealType - One of the TRANSFORM_MAP keys.
 */
function applyInitialStyles(element, revealType) {
  const transform = TRANSFORM_MAP[revealType] || TRANSFORM_MAP['fade-up'];

  element.style.opacity = '0';
  if (transform !== 'none') {
    element.style.transform = transform;
  }

  // Read optional delay from data attribute.
  const delay = element.getAttribute('data-reveal-delay');
  const delayValue = delay ? delay + 'ms' : '0ms';

  element.style.transition =
    'opacity ' + TRANSITION_DURATION + ' ' + TRANSITION_EASING + ' ' + delayValue + ', ' +
    'transform ' + TRANSITION_DURATION + ' ' + TRANSITION_EASING + ' ' + delayValue;

  // Promote to its own compositing layer for smoother animation.
  element.style.willChange = 'opacity, transform';
}

/**
 * Mark an element as revealed by adding the class and resetting styles.
 * @param {HTMLElement} element
 */
function revealElement(element) {
  element.classList.add('revealed');
  element.style.opacity = '1';
  element.style.transform = 'none';

  // Clean up will-change after the transition completes to free GPU memory.
  element.addEventListener('transitionend', function onEnd() {
    element.style.willChange = 'auto';
    element.removeEventListener('transitionend', onEnd);
  }, { once: true });
}

/**
 * Immediately reveal an element without animation (for reduced-motion).
 * @param {HTMLElement} element
 */
function revealImmediately(element) {
  element.classList.add('revealed');
  element.style.opacity = '1';
  element.style.transform = 'none';
  element.style.transition = 'none';
  element.style.willChange = 'auto';
}

/**
 * Initialize scroll-based reveal animations for all elements with the
 * data-reveal attribute.
 *
 * Usage in HTML:
 *   <div data-reveal="fade-up" data-reveal-delay="200">...</div>
 *
 * CSS note: elements start hidden via inline styles applied by this module.
 * The .revealed class triggers the visible state.
 *
 * @returns {{ destroy: Function }} An object with a destroy method to
 *   disconnect the observer and clean up.
 */
export function initScrollReveal() {
  const elements = document.querySelectorAll('[data-reveal], .scroll-reveal, .scroll-reveal-scale');

  // Nothing to observe -- return a no-op destroyer.
  if (elements.length === 0) {
    return { destroy: function () { } };
  }

  // If the user prefers reduced motion, reveal everything immediately
  // without any transition or observer overhead.
  if (prefersReducedMotion()) {
    elements.forEach(function (el) {
      revealImmediately(el);
    });
    return { destroy: function () { } };
  }

  // Apply hidden styles to each element before the observer starts.
  elements.forEach(function (el) {
    const revealType = el.getAttribute('data-reveal') || 'fade-up';
    applyInitialStyles(el, revealType);
  });

  // Create a single IntersectionObserver for all revealable elements.
  // A threshold of 0.12 means roughly 12% of the element must be visible.
  const observer = new IntersectionObserver(
    function handleIntersection(entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        revealElement(entry.target);

        // Each element only animates once -- stop observing after reveal.
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
      // Start observing a bit before the element reaches the viewport
      // so the animation feels natural as the user scrolls.
      rootMargin: '0px 0px -40px 0px'
    }
  );

  // Observe every revealable element.
  elements.forEach(function (el) {
    observer.observe(el);
  });

  /**
   * Disconnect the observer and clean up. Useful when navigating away
   * or tearing down a single-page-app view.
   */
  function destroy() {
    observer.disconnect();
  }

  return { destroy };
}
