/**
 * nav.js
 * ------
 * ES module for navigation behavior: sticky header, hamburger menu,
 * smooth scrolling, active link highlighting, and skip-to-content.
 * Handles keyboard, mouse, and touch interactions. Uses event delegation
 * where practical to minimize the number of listeners.
 */

/**
 * Scroll offset threshold (in pixels) before the nav receives the
 * "scrolled" class (used for shadow / background change via CSS).
 */
const SCROLL_THRESHOLD = 50;

/**
 * Initialize all navigation behaviors.
 * Call this once after the DOM is ready.
 *
 * Expected HTML structure:
 *   <a href="#main" class="skip-link">Skip to content</a>
 *   <nav class="nav" id="main-nav">
 *     <button class="nav-toggle" aria-expanded="false" aria-label="Menu">
 *       ...hamburger icon...
 *     </button>
 *     <ul class="nav-links">
 *       <li><a href="#about">About</a></li>
 *       ...
 *     </ul>
 *   </nav>
 *   <section id="about">...</section>
 *
 * @returns {{ destroy: Function }} An object with a destroy method to
 *   remove all listeners and observers.
 */
export function initNav() {
  const nav = document.querySelector('.navbar') || document.querySelector('.nav');
  const navToggle = nav ? (nav.querySelector('.navbar__hamburger') || nav.querySelector('.nav-toggle')) : null;
  const mobileMenu = nav ? (nav.querySelector('.navbar__mobile-menu') || nav.querySelector('.nav-links')) : null;
  const navLinks = nav ? (nav.querySelector('.navbar__links') || nav.querySelector('.nav-links')) : null;
  const skipLink = document.querySelector('.skip-to-content') || document.querySelector('.skip-link');

  // Collect teardown callbacks so we can clean up everything in destroy().
  const teardowns = [];

  // -----------------------------------------------------------------------
  // 1. Sticky nav -- add "scrolled" class when page is scrolled past
  //    the threshold.
  // -----------------------------------------------------------------------
  if (nav) {
    /**
     * Cached scroll state to avoid redundant class toggles.
     * @type {boolean}
     */
    let isScrolled = false;

    function onScroll() {
      const scrollY = window.scrollY || window.pageYOffset;
      const shouldBeScrolled = scrollY > SCROLL_THRESHOLD;

      if (shouldBeScrolled !== isScrolled) {
        isScrolled = shouldBeScrolled;
        nav.classList.toggle('scrolled', isScrolled);
      }
    }

    // Use passive listener for scroll performance.
    window.addEventListener('scroll', onScroll, { passive: true });
    teardowns.push(function() {
      window.removeEventListener('scroll', onScroll);
    });

    // Run once on init in case the page is already scrolled (e.g. refresh).
    onScroll();
  }

  // -----------------------------------------------------------------------
  // 2. Hamburger menu toggle
  // -----------------------------------------------------------------------
  if (nav && navToggle) {
    /**
     * Open or close the mobile navigation menu.
     * @param {boolean} open - Whether the menu should be open.
     */
    function setMenuOpen(open) {
      nav.classList.toggle('nav-open', open);
      if (mobileMenu) {
        mobileMenu.classList.toggle('open', open);
      }
      navToggle.setAttribute('aria-expanded', String(open));

      if (open) {
        const focusTarget = mobileMenu || navLinks;
        const firstLink = focusTarget ? focusTarget.querySelector('a') : null;
        if (firstLink) {
          firstLink.focus();
        }
      }
    }

    function toggleMenu() {
      const isOpen = mobileMenu ? mobileMenu.classList.contains('open') : nav.classList.contains('nav-open');
      setMenuOpen(!isOpen);
    }

    navToggle.addEventListener('click', toggleMenu);
    teardowns.push(function() {
      navToggle.removeEventListener('click', toggleMenu);
    });

    // -----------------------------------------------------------------
    // 2a. Close mobile menu when a nav link is clicked.
    // Uses event delegation on the mobile menu / nav-links container.
    // -----------------------------------------------------------------
    const menuLinksContainer = mobileMenu || navLinks;
    if (menuLinksContainer) {
      function onNavLinkClick(event) {
        const link = event.target.closest('a');
        if (link) {
          setMenuOpen(false);
        }
      }

      menuLinksContainer.addEventListener('click', onNavLinkClick);
      teardowns.push(function() {
        menuLinksContainer.removeEventListener('click', onNavLinkClick);
      });
    }

    // -----------------------------------------------------------------
    // 2b. Close mobile menu on Escape key.
    // -----------------------------------------------------------------
    function onKeyDown(event) {
      if (event.key === 'Escape' && nav.classList.contains('nav-open')) {
        setMenuOpen(false);
        navToggle.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    teardowns.push(function() {
      document.removeEventListener('keydown', onKeyDown);
    });

    // -----------------------------------------------------------------
    // 2c. Close mobile menu when clicking outside the nav.
    // -----------------------------------------------------------------
    function onDocumentClick(event) {
      if (
        nav.classList.contains('nav-open') &&
        !nav.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('click', onDocumentClick);
    teardowns.push(function() {
      document.removeEventListener('click', onDocumentClick);
    });
  }

  // -----------------------------------------------------------------------
  // 3. Smooth scroll to section for in-page anchor links
  //    Uses event delegation on the document to catch all anchor clicks.
  // -----------------------------------------------------------------------
  function onAnchorClick(event) {
    const link = event.target.closest('a[href^="#"]');
    if (!link) {
      return;
    }

    const targetId = link.getAttribute('href');
    // Ignore bare "#" links.
    if (!targetId || targetId === '#') {
      return;
    }

    const targetSection = document.querySelector(targetId);
    if (!targetSection) {
      return;
    }

    event.preventDefault();

    targetSection.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    // Update the URL hash without jumping (for bookmarking / history).
    if (history.pushState) {
      history.pushState(null, '', targetId);
    }

    // Move focus to the target for keyboard users.
    targetSection.setAttribute('tabindex', '-1');
    targetSection.focus({ preventScroll: true });
  }

  document.addEventListener('click', onAnchorClick);
  teardowns.push(function() {
    document.removeEventListener('click', onAnchorClick);
  });

  // -----------------------------------------------------------------------
  // 4. Active nav link highlighting using IntersectionObserver
  //    Observes each section that corresponds to a nav link and toggles
  //    the "active" class on the matching link.
  // -----------------------------------------------------------------------
  let sectionObserver = null;

  if (nav) {
    const links = nav.querySelectorAll('a[href^="#"]');
    const sectionMap = new Map(); // Map<sectionId, linkElement>

    links.forEach(function(link) {
      const href = link.getAttribute('href');
      if (href && href.length > 1) {
        const sectionId = href.substring(1);
        sectionMap.set(sectionId, link);
      }
    });

    if (sectionMap.size > 0) {
      // Track which sections are currently visible.
      const visibleSections = new Set();

      sectionObserver = new IntersectionObserver(
        function(entries) {
          entries.forEach(function(entry) {
            const id = entry.target.id;
            if (entry.isIntersecting) {
              visibleSections.add(id);
            } else {
              visibleSections.delete(id);
            }
          });

          // Determine the topmost visible section.
          // We iterate through the sectionMap in document order.
          let activeFound = false;
          sectionMap.forEach(function(link, sectionId) {
            if (visibleSections.has(sectionId) && !activeFound) {
              link.classList.add('active');
              activeFound = true;
            } else {
              link.classList.remove('active');
            }
          });
        },
        {
          // Fire when any part of the section is visible, with a generous
          // top margin so the link activates before the section header
          // reaches the viewport edge.
          threshold: 0,
          rootMargin: '-80px 0px -40% 0px'
        }
      );

      sectionMap.forEach(function(_link, sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
          sectionObserver.observe(section);
        }
      });
    }
  }

  // -----------------------------------------------------------------------
  // 5. Skip-to-content link
  //    When activated, focus moves to the main content area.
  // -----------------------------------------------------------------------
  if (skipLink) {
    function onSkipClick(event) {
      const href = skipLink.getAttribute('href');
      if (!href || !href.startsWith('#')) {
        return;
      }

      const target = document.querySelector(href);
      if (!target) {
        return;
      }

      event.preventDefault();
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    skipLink.addEventListener('click', onSkipClick);
    teardowns.push(function() {
      skipLink.removeEventListener('click', onSkipClick);
    });
  }

  // -----------------------------------------------------------------------
  // Destroy / cleanup
  // -----------------------------------------------------------------------
  function destroy() {
    teardowns.forEach(function(fn) {
      fn();
    });
    teardowns.length = 0;

    if (sectionObserver) {
      sectionObserver.disconnect();
      sectionObserver = null;
    }
  }

  return { destroy };
}
