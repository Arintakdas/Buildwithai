/**
 * notices.js
 * ----------
 * ES module for the notice board, used on both the full /notices/ page
 * and as a preview section on the home page. Renders notice cards with
 * category tags, pinned-first ordering, optional filters, and a "view
 * all" link. All DOM content is built with createElement and textContent
 * -- never innerHTML.
 */

import { loadNotices } from './data-loader.js';

/**
 * Map of notice categories to their CSS modifier class (for color coding).
 * Notice = blue, Event = red, Update = green.
 * @type {Object<string, string>}
 */
const CATEGORY_COLORS = {
  'Notice': 'tag--blue',
  'Event':  'tag--red',
  'Update': 'tag--green'
};

/**
 * List of filter categories shown when filtering is enabled.
 * @type {string[]}
 */
const FILTER_CATEGORIES = ['All', 'Notice', 'Event', 'Update'];

/**
 * Create an inline SVG pin icon. Styled after Material Symbols Outlined
 * (24px grid). Used to visually mark pinned notices.
 * @returns {SVGElement}
 */
function createPinIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('pin-icon');

  const path = document.createElementNS(ns, 'path');
  path.setAttribute(
    'd',
    'M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z'
  );
  svg.appendChild(path);
  return svg;
}

/**
 * Format a date string into a human-readable locale date.
 * Falls back to the original string if parsing fails.
 * @param {string} dateStr - ISO date string or similar parseable format.
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) {
    return '';
  }

  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) {
      return dateStr;
    }
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (_err) {
    return dateStr;
  }
}

/**
 * Build a single notice card element from a notice data object.
 *
 * Expected notice shape:
 *   {
 *     title: string,
 *     body: string,
 *     category: 'Notice'|'Event'|'Update',
 *     date: string,       // ISO date
 *     pinned?: boolean,
 *     link?: string,
 *     linkText?: string
 *   }
 *
 * @param {Object} notice
 * @returns {HTMLElement}
 */
function createNoticeCard(notice) {
  const card = document.createElement('article');
  card.className = 'notice-card';
  if (notice.pinned) {
    card.classList.add('notice-card--pinned');
  }

  // ---- Header row (category tag + pin icon) ----
  const header = document.createElement('div');
  header.className = 'notice-card-header';

  // Category tag.
  const tag = document.createElement('span');
  const categoryText = notice.category || 'Notice';
  tag.className = 'notice-tag ' + (CATEGORY_COLORS[categoryText] || 'tag--blue');
  tag.textContent = categoryText;
  header.appendChild(tag);

  // Pin icon for pinned notices.
  if (notice.pinned) {
    const pinLabel = document.createElement('span');
    pinLabel.className = 'notice-pin';
    pinLabel.appendChild(createPinIcon());

    const pinText = document.createElement('span');
    pinText.className = 'notice-pin-text';
    pinText.textContent = 'Pinned';
    pinLabel.appendChild(pinText);

    header.appendChild(pinLabel);
  }

  card.appendChild(header);

  // ---- Date ----
  if (notice.date) {
    const dateEl = document.createElement('time');
    dateEl.className = 'notice-date';
    dateEl.textContent = formatDate(notice.date);
    // Set the datetime attribute for machine-readability.
    try {
      const parsed = new Date(notice.date);
      if (!Number.isNaN(parsed.getTime())) {
        dateEl.setAttribute('datetime', parsed.toISOString());
      }
    } catch (_e) {
      // Ignore parse errors.
    }
    card.appendChild(dateEl);
  }

  // ---- Title ----
  const title = document.createElement('h3');
  title.className = 'notice-title';
  title.textContent = notice.title || 'Untitled Notice';
  card.appendChild(title);

  // ---- Body ----
  if (notice.body) {
    const body = document.createElement('p');
    body.className = 'notice-body';
    body.textContent = notice.body;
    card.appendChild(body);
  }

  // ---- Optional link ----
  if (notice.link) {
    const linkEl = document.createElement('a');
    linkEl.className = 'notice-link';
    linkEl.href = notice.link;
    linkEl.textContent = notice.linkText || 'Read more';
    // Open external links in a new tab; keep internal links in-page.
    if (notice.link.startsWith('http')) {
      linkEl.target = '_blank';
      linkEl.rel = 'noopener noreferrer';
    }
    card.appendChild(linkEl);
  }

  return card;
}

/**
 * Create filter chips for the notice board.
 * @param {Function} onSelect - Callback receiving the selected category
 *   string (or 'All').
 * @returns {HTMLElement}
 */
function createFilterChips(onSelect) {
  const wrapper = document.createElement('div');
  wrapper.className = 'notice-filters';
  wrapper.setAttribute('role', 'tablist');
  wrapper.setAttribute('aria-label', 'Filter notices by category');

  FILTER_CATEGORIES.forEach(function(cat) {
    const chip = document.createElement('button');
    chip.className = 'filter-chip';
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', cat === 'All' ? 'true' : 'false');
    chip.textContent = cat;

    if (cat === 'All') {
      chip.classList.add('filter-chip--active');
    }

    chip.addEventListener('click', function() {
      wrapper.querySelectorAll('.filter-chip').forEach(function(c) {
        c.classList.remove('filter-chip--active');
        c.setAttribute('aria-selected', 'false');
      });
      chip.classList.add('filter-chip--active');
      chip.setAttribute('aria-selected', 'true');
      onSelect(cat);
    });

    wrapper.appendChild(chip);
  });

  return wrapper;
}

/**
 * Initialize the notice board inside the given container.
 *
 * @param {HTMLElement} containerElement - The DOM element to render into.
 * @param {Object} [options={}]
 * @param {number|null} [options.limit=null] - Maximum notices to display.
 *   If set, a "View all notices" link is appended.
 * @param {boolean} [options.showFilters=false] - Whether to show category
 *   filter chips.
 * @returns {Promise<void>}
 */
export async function initNoticeBoard(containerElement, options) {
  if (!containerElement) {
    console.warn('[notices] Container element not found.');
    return;
  }

  var opts = options || {};
  var limit = opts.limit != null ? opts.limit : null;
  var showFilters = opts.showFilters === true;

  // Show loading state.
  var loadingEl = document.createElement('p');
  loadingEl.className = 'notices-loading';
  loadingEl.textContent = 'Loading notices...';
  containerElement.appendChild(loadingEl);

  // Fetch data.
  var allNotices = await loadNotices();

  // Remove loading indicator.
  if (loadingEl.parentNode) {
    loadingEl.parentNode.removeChild(loadingEl);
  }

  // ---- Empty state ----
  if (!allNotices || allNotices.length === 0) {
    var emptyState = document.createElement('div');
    emptyState.className = 'notices-empty';

    var emptyMsg = document.createElement('p');
    emptyMsg.textContent = 'No notices yet';
    emptyState.appendChild(emptyMsg);

    containerElement.appendChild(emptyState);
    return;
  }

  // ---- Sort: pinned first, then by date descending ----
  allNotices.sort(function(a, b) {
    // Pinned notices always come first.
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    // Then sort by date, most recent first.
    var dateA = new Date(a.date || 0).getTime();
    var dateB = new Date(b.date || 0).getTime();
    return dateB - dateA;
  });

  // Active filter state.
  var activeCategory = 'All';

  // Container for the notice cards.
  var cardsContainer = document.createElement('div');
  cardsContainer.className = 'notice-list';
  cardsContainer.setAttribute('role', 'feed');
  cardsContainer.setAttribute('aria-label', 'Notices');

  /**
   * Render (or re-render) the notice cards based on the active filter
   * and limit.
   */
  function renderNotices() {
    // Clear existing cards.
    while (cardsContainer.firstChild) {
      cardsContainer.removeChild(cardsContainer.firstChild);
    }

    // Filter by category.
    var filtered = allNotices;
    if (activeCategory !== 'All') {
      filtered = allNotices.filter(function(n) {
        return n.category === activeCategory;
      });
    }

    // Apply limit.
    var displayed = limit ? filtered.slice(0, limit) : filtered;

    if (displayed.length === 0) {
      var noResults = document.createElement('p');
      noResults.className = 'notices-empty';
      noResults.textContent = 'No notices in this category.';
      cardsContainer.appendChild(noResults);
      return;
    }

    displayed.forEach(function(notice) {
      cardsContainer.appendChild(createNoticeCard(notice));
    });

    // "View all notices" link when a limit is applied and there are more.
    if (limit && filtered.length > limit) {
      var viewAllWrapper = document.createElement('div');
      viewAllWrapper.className = 'notices-view-all';

      var viewAllLink = document.createElement('a');
      viewAllLink.href = '/notices/';
      viewAllLink.className = 'notices-view-all-link';
      viewAllLink.textContent = 'View all notices';
      viewAllWrapper.appendChild(viewAllLink);

      cardsContainer.appendChild(viewAllWrapper);
    }
  }

  // ---- Filter chips (optional) ----
  if (showFilters) {
    var filters = createFilterChips(function(category) {
      activeCategory = category;
      renderNotices();
    });
    containerElement.appendChild(filters);
  }

  // Append the cards container and perform initial render.
  containerElement.appendChild(cardsContainer);
  renderNotices();
}
