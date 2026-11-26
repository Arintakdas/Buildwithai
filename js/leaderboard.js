/**
 * leaderboard.js
 * --------------
 * ES module for the leaderboard / winners section. Loads data from
 * data-loader.js, renders a podium for the top 3 and an accessible,
 * sortable, searchable, and filterable table (or cards on mobile).
 * All DOM content is created with createElement and textContent -- never
 * innerHTML.
 */

import { loadLeaderboard } from './data-loader.js';

/**
 * Mobile breakpoint (px). Below this width, entries are rendered as
 * cards instead of a table.
 */
const MOBILE_BREAKPOINT = 768;

/**
 * Column definitions for the leaderboard table.
 * @type {Array<{ key: string, label: string, sortable: boolean }>}
 */
const COLUMNS = [
  { key: 'rank',     label: 'Rank',      sortable: true },
  { key: 'name',     label: 'Name/Team', sortable: true },
  { key: 'project',  label: 'Project',   sortable: true },
  { key: 'category', label: 'Category',  sortable: true },
  { key: 'prize',    label: 'Prize',     sortable: true },
  { key: 'points',   label: 'Points',    sortable: true }
];

// -------------------------------------------------------------------------
// Helper utilities
// -------------------------------------------------------------------------

/**
 * Determine if the viewport is currently below the mobile breakpoint.
 * @returns {boolean}
 */
function isMobile() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * Create an SVG trophy icon for the podium. Styled after Material
 * Symbols Outlined (24px grid).
 * @returns {SVGElement}
 */
function createTrophyIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '32');
  svg.setAttribute('height', '32');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('podium-trophy-icon');

  const path = document.createElementNS(ns, 'path');
  path.setAttribute(
    'd',
    'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 ' +
    '4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 ' +
    '0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 ' +
    '8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z'
  );
  svg.appendChild(path);
  return svg;
}

/**
 * Create an inline SVG sort icon (up/down arrows) for sortable column
 * headers.
 * @param {'asc'|'desc'|'none'} direction
 * @returns {SVGElement}
 */
function createSortIcon(direction) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('sort-icon');

  const path = document.createElementNS(ns, 'path');
  if (direction === 'asc') {
    // Arrow upward
    path.setAttribute('d', 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.59 5.58L20 12l-8-8-8 8z');
  } else if (direction === 'desc') {
    // Arrow downward
    path.setAttribute('d', 'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.59-5.58L4 12l8 8 8-8z');
  } else {
    // Unfold more (neutral)
    path.setAttribute('d', 'M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z');
  }
  svg.appendChild(path);
  return svg;
}

// -------------------------------------------------------------------------
// Podium rendering
// -------------------------------------------------------------------------

/**
 * Render the top-3 podium inside the given container.
 * Dispatches a custom event "leaderboard:podium" that the 3D scene
 * system can listen for to trigger the podium animation.
 *
 * @param {HTMLElement} container
 * @param {Array} topThree - First three entries from the sorted data.
 */
function renderPodium(container, topThree) {
  const podium = document.createElement('div');
  podium.className = 'podium';
  podium.setAttribute('role', 'list');
  podium.setAttribute('aria-label', 'Top 3 winners');

  // Display order on the podium: 2nd, 1st, 3rd (visually, 1st is center).
  const displayOrder = [1, 0, 2];
  const placeLabels = ['1st', '2nd', '3rd'];
  const placeClasses = ['podium-first', 'podium-second', 'podium-third'];

  displayOrder.forEach(function(dataIndex) {
    if (dataIndex >= topThree.length) {
      return;
    }

    const entry = topThree[dataIndex];
    const card = document.createElement('div');
    card.className = 'podium-card ' + placeClasses[dataIndex];
    card.setAttribute('role', 'listitem');

    // Place badge
    const badge = document.createElement('span');
    badge.className = 'podium-place';
    badge.textContent = placeLabels[dataIndex];
    card.appendChild(badge);

    // Trophy icon
    card.appendChild(createTrophyIcon());

    // Name
    const nameEl = document.createElement('h3');
    nameEl.className = 'podium-name';
    nameEl.textContent = entry.name || entry.team || 'Unknown';
    card.appendChild(nameEl);

    // Project
    const projectEl = document.createElement('p');
    projectEl.className = 'podium-project';
    projectEl.textContent = entry.project || '';
    card.appendChild(projectEl);

    // Points
    const pointsEl = document.createElement('span');
    pointsEl.className = 'podium-points';
    pointsEl.textContent = (entry.points != null ? entry.points : '--') + ' pts';
    card.appendChild(pointsEl);

    podium.appendChild(card);
  });

  container.appendChild(podium);

  // Dispatch event for the 3D scene system.
  document.dispatchEvent(new CustomEvent('leaderboard:podium', {
    detail: { topThree: topThree }
  }));
}

// -------------------------------------------------------------------------
// Search and filter controls
// -------------------------------------------------------------------------

/**
 * Create the search input field.
 * @param {Function} onInput - Callback receiving the current query string.
 * @returns {HTMLElement} The search wrapper element.
 */
function createSearchInput(onInput) {
  const wrapper = document.createElement('div');
  wrapper.className = 'leaderboard-search';

  const label = document.createElement('label');
  label.setAttribute('for', 'lb-search');
  label.className = 'sr-only';
  label.textContent = 'Search leaderboard';
  wrapper.appendChild(label);

  const input = document.createElement('input');
  input.type = 'search';
  input.id = 'lb-search';
  input.className = 'leaderboard-search-input';
  input.placeholder = 'Search by name or project...';
  input.setAttribute('autocomplete', 'off');

  input.addEventListener('input', function() {
    onInput(input.value);
  });

  wrapper.appendChild(input);
  return wrapper;
}

/**
 * Create category filter chips.
 * @param {string[]} categories - Unique category values from the data.
 * @param {Function} onSelect - Callback receiving the selected category
 *   string (or 'all').
 * @returns {HTMLElement} The filter chip container element.
 */
function createCategoryFilters(categories, onSelect) {
  const wrapper = document.createElement('div');
  wrapper.className = 'leaderboard-filters';
  wrapper.setAttribute('role', 'tablist');
  wrapper.setAttribute('aria-label', 'Filter by category');

  var allCategories = ['All'].concat(categories);

  allCategories.forEach(function(cat) {
    var chip = document.createElement('button');
    chip.className = 'filter-chip';
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', cat === 'All' ? 'true' : 'false');
    chip.textContent = cat;

    if (cat === 'All') {
      chip.classList.add('filter-chip--active');
    }

    chip.addEventListener('click', function() {
      // Deactivate all chips.
      wrapper.querySelectorAll('.filter-chip').forEach(function(c) {
        c.classList.remove('filter-chip--active');
        c.setAttribute('aria-selected', 'false');
      });
      // Activate the clicked chip.
      chip.classList.add('filter-chip--active');
      chip.setAttribute('aria-selected', 'true');

      onSelect(cat === 'All' ? 'all' : cat);
    });

    wrapper.appendChild(chip);
  });

  return wrapper;
}

// -------------------------------------------------------------------------
// Table rendering (desktop)
// -------------------------------------------------------------------------

/**
 * Build the leaderboard table element.
 * @param {Array} data - Full leaderboard data array.
 * @returns {{ table: HTMLElement, refreshRows: Function }}
 */
function buildTable(data) {
  const table = document.createElement('table');
  table.className = 'leaderboard-table';
  table.setAttribute('role', 'table');

  // Caption for accessibility.
  const caption = document.createElement('caption');
  caption.className = 'sr-only';
  caption.textContent = 'Leaderboard results';
  table.appendChild(caption);

  // ---- Thead ----
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  // Sort state: { key, direction }
  let sortState = { key: null, direction: 'none' };

  COLUMNS.forEach(function(col) {
    const th = document.createElement('th');
    th.setAttribute('scope', 'col');
    th.dataset.key = col.key;

    if (col.sortable) {
      th.classList.add('sortable');
      th.setAttribute('aria-sort', 'none');
      th.setAttribute('role', 'columnheader');
      th.tabIndex = 0;

      const label = document.createElement('span');
      label.textContent = col.label;
      th.appendChild(label);
      th.appendChild(createSortIcon('none'));

      // Click handler for sorting.
      function handleSort() {
        let direction = 'asc';
        if (sortState.key === col.key) {
          direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        }
        sortState = { key: col.key, direction: direction };

        // Update all header aria-sort and icons.
        headerRow.querySelectorAll('th.sortable').forEach(function(otherTh) {
          const otherKey = otherTh.dataset.key;
          const otherDir = otherKey === col.key ? direction : 'none';
          otherTh.setAttribute('aria-sort', otherDir);

          // Replace icon.
          const oldIcon = otherTh.querySelector('.sort-icon');
          if (oldIcon) {
            otherTh.replaceChild(createSortIcon(otherDir), oldIcon);
          }
        });

        // Sort the data.
        currentData.sort(function(a, b) {
          let valA = a[col.key];
          let valB = b[col.key];

          // Numeric sort for rank and points.
          if (col.key === 'rank' || col.key === 'points') {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
            return direction === 'asc' ? valA - valB : valB - valA;
          }

          // String sort for everything else.
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
          if (valA < valB) return direction === 'asc' ? -1 : 1;
          if (valA > valB) return direction === 'asc' ? 1 : -1;
          return 0;
        });

        refreshRows(currentData);
      }

      th.addEventListener('click', handleSort);
      th.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleSort();
        }
      });
    } else {
      th.textContent = col.label;
    }

    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ---- Tbody ----
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  // Tracks the current filtered/sorted view.
  let currentData = data.slice();

  /**
   * Rebuild the table body rows from the given data array.
   * @param {Array} rows
   */
  function refreshRows(rows) {
    currentData = rows;

    // Clear existing rows.
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild);
    }

    if (rows.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.setAttribute('colspan', String(COLUMNS.length));
      emptyCell.className = 'leaderboard-empty-row';
      emptyCell.textContent = 'No matching results found.';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    rows.forEach(function(entry) {
      const tr = document.createElement('tr');

      COLUMNS.forEach(function(col) {
        const td = document.createElement('td');
        td.dataset.label = col.label;
        td.textContent = entry[col.key] != null ? String(entry[col.key]) : '--';
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // Initial render.
  refreshRows(data);

  return { table: table, refreshRows: refreshRows };
}

// -------------------------------------------------------------------------
// Card rendering (mobile)
// -------------------------------------------------------------------------

/**
 * Render leaderboard entries as cards for mobile viewports.
 * @param {HTMLElement} container
 * @param {Array} data
 */
function renderCards(container, data) {
  // Clear previous cards.
  var existing = container.querySelector('.leaderboard-cards');
  if (existing) {
    container.removeChild(existing);
  }

  var cards = document.createElement('div');
  cards.className = 'leaderboard-cards';
  cards.setAttribute('role', 'list');

  if (data.length === 0) {
    var emptyMsg = document.createElement('p');
    emptyMsg.className = 'leaderboard-empty';
    emptyMsg.textContent = 'No matching results found.';
    cards.appendChild(emptyMsg);
    container.appendChild(cards);
    return;
  }

  data.forEach(function(entry) {
    var card = document.createElement('div');
    card.className = 'leaderboard-card';
    card.setAttribute('role', 'listitem');

    // Rank badge
    var rankBadge = document.createElement('span');
    rankBadge.className = 'card-rank';
    rankBadge.textContent = '#' + (entry.rank != null ? entry.rank : '--');
    card.appendChild(rankBadge);

    // Name
    var nameEl = document.createElement('h3');
    nameEl.className = 'card-name';
    nameEl.textContent = entry.name || entry.team || 'Unknown';
    card.appendChild(nameEl);

    // Details list
    var details = [
      { label: 'Project',  value: entry.project },
      { label: 'Category', value: entry.category },
      { label: 'Prize',    value: entry.prize },
      { label: 'Points',   value: entry.points }
    ];

    details.forEach(function(d) {
      var row = document.createElement('div');
      row.className = 'card-detail';

      var labelEl = document.createElement('span');
      labelEl.className = 'card-detail-label';
      labelEl.textContent = d.label + ':';
      row.appendChild(labelEl);

      var valueEl = document.createElement('span');
      valueEl.className = 'card-detail-value';
      valueEl.textContent = d.value != null ? String(d.value) : '--';
      row.appendChild(valueEl);

      card.appendChild(row);
    });

    cards.appendChild(card);
  });

  container.appendChild(cards);
}

// -------------------------------------------------------------------------
// Main initialization
// -------------------------------------------------------------------------

/**
 * Initialize the leaderboard inside the given container element.
 * Loads data, renders podium and table/cards, and sets up search,
 * filters, and sorting.
 *
 * @param {HTMLElement} containerElement - The DOM element to render into.
 * @returns {Promise<void>}
 */
export async function initLeaderboard(containerElement) {
  if (!containerElement) {
    console.warn('[leaderboard] Container element not found.');
    return;
  }

  // Show a loading state.
  var loadingEl = document.createElement('p');
  loadingEl.className = 'leaderboard-loading';
  loadingEl.textContent = 'Loading results...';
  containerElement.appendChild(loadingEl);

  // Fetch the data.
  var data = await loadLeaderboard();

  // Remove loading indicator.
  if (loadingEl.parentNode) {
    loadingEl.parentNode.removeChild(loadingEl);
  }

  // ---- Empty state ----
  if (!data || data.length === 0) {
    var emptyState = document.createElement('div');
    emptyState.className = 'leaderboard-empty-state';

    var emptyMessage = document.createElement('p');
    emptyMessage.textContent = 'Results will be announced soon';
    emptyState.appendChild(emptyMessage);

    containerElement.appendChild(emptyState);

    // Trigger accent 3D scene for the empty / "coming soon" state.
    document.dispatchEvent(new CustomEvent('leaderboard:empty'));
    return;
  }

  // Sort by rank ascending (default).
  data.sort(function(a, b) {
    return (Number(a.rank) || 0) - (Number(b.rank) || 0);
  });

  // ---- Podium for top 3 ----
  var topThree = data.slice(0, 3);
  renderPodium(containerElement, topThree);

  // ---- Controls wrapper (search + filters) ----
  var controlsWrapper = document.createElement('div');
  controlsWrapper.className = 'leaderboard-controls';

  // Extract unique categories.
  var categorySet = new Set();
  data.forEach(function(entry) {
    if (entry.category) {
      categorySet.add(entry.category);
    }
  });
  var uniqueCategories = Array.from(categorySet).sort();

  // Active filter / search state.
  var activeCategory = 'all';
  var searchQuery = '';

  /**
   * Apply both the search query and category filter, then re-render.
   */
  function applyFilters() {
    var filtered = data.filter(function(entry) {
      // Category filter.
      if (activeCategory !== 'all' && entry.category !== activeCategory) {
        return false;
      }

      // Search filter (case-insensitive match on name/team and project).
      if (searchQuery.length > 0) {
        var query = searchQuery.toLowerCase();
        var name = (entry.name || entry.team || '').toLowerCase();
        var project = (entry.project || '').toLowerCase();
        if (name.indexOf(query) === -1 && project.indexOf(query) === -1) {
          return false;
        }
      }

      return true;
    });

    // Re-render the appropriate view.
    if (isMobile()) {
      renderCards(resultsContainer, filtered);
    } else {
      tableRef.refreshRows(filtered);
    }
  }

  // Search input.
  var searchEl = createSearchInput(function(query) {
    searchQuery = query.trim();
    applyFilters();
  });
  controlsWrapper.appendChild(searchEl);

  // Category filter chips.
  if (uniqueCategories.length > 1) {
    var filterChips = createCategoryFilters(uniqueCategories, function(cat) {
      activeCategory = cat;
      applyFilters();
    });
    controlsWrapper.appendChild(filterChips);
  }

  containerElement.appendChild(controlsWrapper);

  // ---- Results container (holds table or cards) ----
  var resultsContainer = document.createElement('div');
  resultsContainer.className = 'leaderboard-results';
  containerElement.appendChild(resultsContainer);

  // Build the table (always, so it is ready for desktop).
  var tableRef = buildTable(data);

  /**
   * Render the correct layout (table vs. cards) based on viewport.
   */
  function renderLayout() {
    // Clear results container.
    while (resultsContainer.firstChild) {
      resultsContainer.removeChild(resultsContainer.firstChild);
    }

    if (isMobile()) {
      // Filter current data and render cards.
      var filtered = data.filter(function(entry) {
        if (activeCategory !== 'all' && entry.category !== activeCategory) {
          return false;
        }
        if (searchQuery.length > 0) {
          var query = searchQuery.toLowerCase();
          var name = (entry.name || entry.team || '').toLowerCase();
          var project = (entry.project || '').toLowerCase();
          if (name.indexOf(query) === -1 && project.indexOf(query) === -1) {
            return false;
          }
        }
        return true;
      });
      renderCards(resultsContainer, filtered);
    } else {
      resultsContainer.appendChild(tableRef.table);
      // Re-apply filters to make sure the table rows match current state.
      applyFilters();
    }
  }

  // Initial render.
  renderLayout();

  // Re-render on resize to swap between table and cards.
  var resizeTimer = null;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderLayout, 150);
  });
}
