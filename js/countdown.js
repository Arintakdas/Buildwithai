/**
 * countdown.js
 * ------------
 * ES module that creates and manages a live 3D split-flap (flip-calendar)
 * countdown timer for the event. Renders Days, Hours, Minutes, and Seconds
 * with a 3D page-flip transition whenever a value changes.
 * All DOM updates use textContent (never innerHTML).
 */

/**
 * Calculate the time remaining until the target date.
 * @param {Date} targetDate - The event start date/time.
 * @returns {{ days: number, hours: number, minutes: number, seconds: number, total: number }}
 */
export function getTimeUntil(targetDate) {
  const now = Date.now();
  const total = targetDate.getTime() - now;

  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total };
  }

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  return { days, hours, minutes, seconds, total };
}

/**
 * Determine the current status of the event relative to now.
 * "live" is defined as the first 24 hours after the target date.
 * @param {Date} targetDate - The event start date/time.
 * @returns {'upcoming'|'live'|'past'}
 */
export function getEventStatus(targetDate) {
  const now = Date.now();
  const target = targetDate.getTime();

  if (now < target) {
    return 'upcoming';
  }

  const liveDuration = 24 * 60 * 60 * 1000;
  if (now < target + liveDuration) {
    return 'live';
  }

  return 'past';
}

function padZero(value) {
  return String(value).padStart(2, '0');
}

/**
 * Create a 3D split-flap calendar unit.
 * @param {string} label
 * @param {string} accentClass - 'blue' | 'red' | 'yellow' | 'green'
 */
function createFlipUnit(label, accentClass) {
  const unit = document.createElement('div');
  unit.className = 'flip-unit flip-unit--' + accentClass;

  const card = document.createElement('div');
  card.className = 'flip-card';
  card.setAttribute('aria-label', label);

  // Static top half (shows next/current value)
  const top = document.createElement('div');
  top.className = 'flip-card__top';
  const topSpan = document.createElement('span');
  topSpan.textContent = '00';
  top.appendChild(topSpan);

  // Static bottom half (shows previous/current value)
  const bottom = document.createElement('div');
  bottom.className = 'flip-card__bottom';
  const bottomSpan = document.createElement('span');
  bottomSpan.textContent = '00';
  bottom.appendChild(bottomSpan);

  // Animated top flap (folds down from 0deg to -90deg)
  const topFlap = document.createElement('div');
  topFlap.className = 'flip-card__top-flap';
  const topFlapSpan = document.createElement('span');
  topFlapSpan.textContent = '00';
  topFlap.appendChild(topFlapSpan);

  // Animated bottom flap (unfolds from 90deg to 0deg)
  const bottomFlap = document.createElement('div');
  bottomFlap.className = 'flip-card__bottom-flap';
  const bottomFlapSpan = document.createElement('span');
  bottomFlapSpan.textContent = '00';
  bottomFlap.appendChild(bottomFlapSpan);

  // Center hinge line
  const hinge = document.createElement('div');
  hinge.className = 'flip-card__hinge';
  hinge.setAttribute('aria-hidden', 'true');

  card.appendChild(top);
  card.appendChild(bottom);
  card.appendChild(topFlap);
  card.appendChild(bottomFlap);
  card.appendChild(hinge);

  const labelEl = document.createElement('span');
  labelEl.className = 'flip-unit__label';
  labelEl.textContent = label;

  unit.appendChild(card);
  unit.appendChild(labelEl);

  let currentValue = '00';
  let animTimer = null;

  function setValue(nextValue, animate) {
    if (nextValue === currentValue) {
      return;
    }

    const prevValue = currentValue;
    currentValue = nextValue;

    if (!animate) {
      topSpan.textContent = nextValue;
      bottomSpan.textContent = nextValue;
      topFlapSpan.textContent = nextValue;
      bottomFlapSpan.textContent = nextValue;
      return;
    }

    if (animTimer) {
      clearTimeout(animTimer);
      card.classList.remove('is-flipping');
      void card.offsetWidth;
    }

    // Prepare halves for 3D split-flap transition
    topSpan.textContent = nextValue;
    bottomSpan.textContent = prevValue;
    topFlapSpan.textContent = prevValue;
    bottomFlapSpan.textContent = nextValue;

    card.classList.add('is-flipping');

    animTimer = setTimeout(() => {
      bottomSpan.textContent = nextValue;
      topFlapSpan.textContent = nextValue;
      card.classList.remove('is-flipping');
      animTimer = null;
    }, 520);
  }

  return { unit, setValue };
}

/**
 * Initialize the 3D flip-calendar countdown timer inside containerElement.
 * @param {Date} targetDate
 * @param {HTMLElement} containerElement
 * @returns {Function} dispose
 */
export function initCountdown(targetDate, containerElement) {
  if (!containerElement) {
    console.warn('[countdown] Container element not found.');
    return function dispose() {};
  }

  while (containerElement.firstChild) {
    containerElement.removeChild(containerElement.firstChild);
  }

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const initialStatus = getEventStatus(targetDate);

  if (initialStatus === 'live') {
    const liveMsg = document.createElement('div');
    liveMsg.className = 'countdown-status countdown-status--live';
    liveMsg.textContent = 'Event is live!';
    containerElement.appendChild(liveMsg);
    return function dispose() {};
  }

  if (initialStatus === 'past') {
    const pastMsg = document.createElement('div');
    pastMsg.className = 'countdown-status countdown-status--past';
    pastMsg.textContent = 'Event has concluded';
    containerElement.appendChild(pastMsg);
    return function dispose() {};
  }

  const grid = document.createElement('div');
  grid.className = 'flip-countdown';

  const daysUnit = createFlipUnit('Days', 'blue');
  const hoursUnit = createFlipUnit('Hours', 'red');
  const minutesUnit = createFlipUnit('Minutes', 'yellow');
  const secondsUnit = createFlipUnit('Seconds', 'green');

  grid.appendChild(daysUnit.unit);
  grid.appendChild(hoursUnit.unit);
  grid.appendChild(minutesUnit.unit);
  grid.appendChild(secondsUnit.unit);

  containerElement.appendChild(grid);

  let isFirstRender = true;
  let intervalId = null;

  function tick() {
    const status = getEventStatus(targetDate);

    if (status === 'live') {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      while (containerElement.firstChild) {
        containerElement.removeChild(containerElement.firstChild);
      }
      const liveMsg = document.createElement('div');
      liveMsg.className = 'countdown-status countdown-status--live';
      liveMsg.textContent = 'Event is live!';
      containerElement.appendChild(liveMsg);
      return;
    }

    if (status === 'past') {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      while (containerElement.firstChild) {
        containerElement.removeChild(containerElement.firstChild);
      }
      const pastMsg = document.createElement('div');
      pastMsg.className = 'countdown-status countdown-status--past';
      pastMsg.textContent = 'Event has concluded';
      containerElement.appendChild(pastMsg);
      return;
    }

    const { days, hours, minutes, seconds } = getTimeUntil(targetDate);
    const animate = !isFirstRender && !prefersReduced;

    daysUnit.setValue(padZero(days), animate);
    hoursUnit.setValue(padZero(hours), animate);
    minutesUnit.setValue(padZero(minutes), animate);
    secondsUnit.setValue(padZero(seconds), animate);

    isFirstRender = false;
  }

  tick();
  intervalId = setInterval(tick, 1000);

  return function dispose() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}
