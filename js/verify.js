/**
 * verify.js
 * ---------
 * ES module for the dedicated certificate verification page (/verify/index.html).
 * Reads ?id=... from the URL query string to support direct QR code scans,
 * normalizes and hashes the certificate ID via data-loader.js, and renders
 * the verification state safely using textContent.
 */

import { verifyCertificate } from '/js/data-loader.js';
import { createVerifyBadge, checkWebGLSupport, checkReducedMotion } from '/js/three-scene.js';
import { initNav } from '/js/nav.js';
import { initScrollReveal } from '/js/scroll-reveal.js';

document.addEventListener('DOMContentLoaded', () => {
  try {
    initNav();
  } catch (err) {
    console.error('[verify.js] Nav init failed:', err);
  }

  try {
    initScrollReveal();
  } catch (err) {
    console.error('[verify.js] Scroll reveal init failed:', err);
  }

  const input = document.getElementById('cert-id-input');
  const verifyBtn = document.getElementById('verify-btn');
  const form = document.getElementById('verify-form');

  const loadingEl = document.getElementById('verify-loading');
  const successEl = document.getElementById('verify-success');
  const notFoundEl = document.getElementById('verify-not-found');
  const revokedEl = document.getElementById('verify-revoked');
  const errorEl = document.getElementById('verify-error');
  const inputErrorEl = document.getElementById('verify-input-error');

  const resultName = document.getElementById('result-name');
  const resultCollege = document.getElementById('result-college');
  const resultDepartment = document.getElementById('result-department');
  const resultYear = document.getElementById('result-year');
  const resultRole = document.getElementById('result-role');
  const resultEvent = document.getElementById('result-event');
  const resultIssueDate = document.getElementById('result-issue-date');
  const resultCertId = document.getElementById('result-cert-id');
  const resultVerifyTime = document.getElementById('result-verify-time');

  const copyLinkBtn = document.getElementById('copy-link-btn');
  const copyFeedback = document.getElementById('copy-feedback');
  const printBtn = document.getElementById('print-btn');
  const verifyAnotherBtns = document.querySelectorAll('[data-action="verify-another"]');
  const retryBtn = document.getElementById('retry-btn');

  // Initialize 3D verify badge when WebGL is supported and reduced motion is off.
  let badgeController = null;
  const badgeContainer = document.getElementById('verify-badge-container');
  const badgeFallback = document.getElementById('verify-badge-fallback');

  if (badgeContainer && checkWebGLSupport() && !checkReducedMotion()) {
    try {
      badgeController = createVerifyBadge(badgeContainer);
    } catch (err) {
      console.error('[verify.js] 3D badge failed:', err);
    }
  }

  if (!badgeController) {
    if (badgeContainer) {
      badgeContainer.setAttribute('hidden', '');
    }
    if (badgeFallback) {
      badgeFallback.removeAttribute('hidden');
    }
  }

  let lastCertId = '';

  function hideAllStates() {
    [loadingEl, successEl, notFoundEl, revokedEl, errorEl].forEach((el) => {
      if (el) {
        el.setAttribute('hidden', '');
        el.classList.remove('active');
      }
    });
    if (inputErrorEl) {
      inputErrorEl.textContent = '';
      inputErrorEl.setAttribute('hidden', '');
    }
  }

  function showState(el) {
    hideAllStates();
    if (el) {
      el.removeAttribute('hidden');
      el.classList.add('active');
    }
  }

  function formatTimestamp(date) {
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  }

  function updateQueryParam(certId) {
    try {
      const url = new URL(window.location.href);
      if (certId) {
        url.searchParams.set('id', certId);
      } else {
        url.searchParams.delete('id');
      }
      window.history.replaceState({}, '', url.toString());
    } catch (_err) {
      // Ignore history errors in restricted environments.
    }
  }

  async function runVerification(rawId) {
    const normalizedId = (rawId || '').trim().toUpperCase();
    lastCertId = normalizedId;

    if (!normalizedId) {
      hideAllStates();
      if (inputErrorEl) {
        inputErrorEl.textContent = 'Please enter a certificate number (e.g. ABC26-K7F3Q9).';
        inputErrorEl.removeAttribute('hidden');
      }
      if (input) {
        input.focus();
      }
      return;
    }

    if (input) {
      input.value = normalizedId;
    }
    updateQueryParam(normalizedId);

    showState(loadingEl);
    if (badgeController) {
      badgeController.setBadgeState('loading');
    }

    const result = await verifyCertificate(normalizedId);

    if (result.status === 'verified' && result.data) {
      const d = result.data;
      if (resultName) resultName.textContent = d.name || '-';
      if (resultCollege) resultCollege.textContent = d.college || '-';
      if (resultDepartment) resultDepartment.textContent = d.department || '-';
      if (resultYear) resultYear.textContent = d.year || '-';
      if (resultRole) resultRole.textContent = d.role || '-';
      if (resultEvent) resultEvent.textContent = d.event || 'Build with AI: ABC';
      if (resultIssueDate) resultIssueDate.textContent = d.issue_date || '-';
      if (resultCertId) resultCertId.textContent = normalizedId;
      if (resultVerifyTime) {
        resultVerifyTime.textContent = 'Verified on ' + formatTimestamp(new Date());
      }

      showState(successEl);
      if (badgeController) {
        badgeController.setBadgeState('success');
      }
    } else if (result.status === 'revoked') {
      showState(revokedEl);
      if (badgeController) {
        badgeController.setBadgeState('revoked');
      }
    } else if (result.status === 'not_found') {
      showState(notFoundEl);
      if (badgeController) {
        badgeController.setBadgeState('error');
      }
    } else {
      showState(errorEl);
      if (badgeController) {
        badgeController.setBadgeState('error');
      }
    }
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      runVerification(input ? input.value : '');
    });
  } else if (verifyBtn) {
    verifyBtn.addEventListener('click', () => {
      runVerification(input ? input.value : '');
    });
  }

  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
      const url = new URL(window.location.href);
      if (lastCertId) {
        url.searchParams.set('id', lastCertId);
      }
      try {
        await navigator.clipboard.writeText(url.toString());
        if (copyFeedback) {
          copyFeedback.textContent = 'Verification link copied to clipboard.';
          copyFeedback.removeAttribute('hidden');
          setTimeout(() => {
            copyFeedback.setAttribute('hidden', '');
          }, 3000);
        }
      } catch (_err) {
        if (copyFeedback) {
          copyFeedback.textContent = 'Copy failed. Copy the URL from your browser address bar.';
          copyFeedback.removeAttribute('hidden');
        }
      }
    });
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  verifyAnotherBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      hideAllStates();
      updateQueryParam('');
      if (badgeController) {
        badgeController.setBadgeState('loading');
      }
      if (input) {
        input.value = '';
        input.focus();
      }
    });
  });

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      runVerification(lastCertId || (input ? input.value : ''));
    });
  }

  // Auto-verify if ?id=... is present in the URL.
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get('id');
  if (queryId && queryId.trim().length > 0) {
    if (input) {
      input.value = queryId.trim();
    }
    runVerification(queryId);
  }
});
