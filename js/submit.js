/**
 * submit.js
 * ---------
 * ES module for the static Project Submission section (#submit).
 * Validates all mandatory fields (individual name, department/year,
 * roll number, email address, project title, category, description,
 * Git repository URL) plus the optional deployed website URL.
 *
 * When GOOGLE_APPS_SCRIPT_URL is configured (using scripts/google_apps_script.gs),
 * submissions are saved directly to Google Sheets (exportable as .xlsx) and
 * trigger an automatic confirmation email to the participant.
 *
 * All DOM updates use createElement and textContent (never innerHTML).
 */

/**
 * Paste your deployed Google Apps Script Web App URL here to enable
 * automatic Google Sheets storage + participant confirmation emails.
 */
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyMeVThjckNFzThP6mat1pW0DsZJZFVhzs946ab3d9wa1w1nS1gdwtq26LVArO2ssFOBg/exec';

/**
 * Fallback organizer email for the mailto button if Apps Script is not set.
 */
const ORGANIZER_EMAIL = 'gdgoncampus.gcetts@example.com';

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch (_err) {
    return false;
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast' + (type === 'error' ? ' toast--error' : '');
  toast.setAttribute('role', 'status');

  const ns = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(ns, 'svg');
  icon.setAttribute('width', '20');
  icon.setAttribute('height', '20');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('aria-hidden', 'true');
  icon.classList.add('toast__icon');

  const path = document.createElementNS(ns, 'path');
  path.setAttribute('stroke-width', '2.2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  if (type === 'error') {
    path.setAttribute('stroke', '#EA4335');
    path.setAttribute('d', 'M12 8v5M12 16h.01M12 2a10 10 0 100 20 10 10 0 000-20z');
  } else {
    path.setAttribute('stroke', '#34A853');
    path.setAttribute('d', 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z');
  }
  icon.appendChild(path);

  const msgSpan = document.createElement('span');
  msgSpan.className = 'toast__message';
  msgSpan.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast__close';
  closeBtn.setAttribute('aria-label', 'Close notification');
  closeBtn.textContent = 'x';

  function dismiss() {
    toast.classList.remove('is-visible');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 260);
  }

  closeBtn.addEventListener('click', dismiss);

  toast.appendChild(icon);
  toast.appendChild(msgSpan);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  setTimeout(dismiss, 4500);
}

export function initProjectSubmission() {
  const form = document.getElementById('project-submit-form');
  if (!form) {
    return;
  }

  const nameInput = document.getElementById('submit-name');
  const deptInput = document.getElementById('submit-dept');
  const rollInput = document.getElementById('submit-roll');
  const emailInput = document.getElementById('submit-email');
  const titleInput = document.getElementById('submit-title');
  const categoryInput = document.getElementById('submit-category');
  const descInput = document.getElementById('submit-description');
  const gitInput = document.getElementById('submit-git-url');
  const liveInput = document.getElementById('submit-live-url');

  const errorBox = document.getElementById('submit-error-box');
  const resultBox = document.getElementById('submit-result-box');
  const submitBtn = document.getElementById('submit-project-btn');

  function clearMessages() {
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.setAttribute('hidden', '');
    }
    if (resultBox) {
      while (resultBox.firstChild) {
        resultBox.removeChild(resultBox.firstChild);
      }
      resultBox.setAttribute('hidden', '');
    }
  }

  function showError(message, focusEl) {
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.removeAttribute('hidden');
    }
    if (focusEl && typeof focusEl.focus === 'function') {
      focusEl.focus();
    }
  }

  function buildSummaryText(payload) {
    const lines = [
      'Build with AI: ABC - Project Submission',
      '---------------------------------------',
      'Name: ' + payload.name,
      'Department & Year: ' + payload.department,
      'Roll Number: ' + payload.rollNo,
      'Email: ' + payload.email,
      'Project Title: ' + payload.title,
      'Category: ' + payload.category,
      'Description: ' + payload.description,
      'Git Repository: ' + payload.gitUrl,
      'Deployed Website: ' + (payload.liveUrl || 'Not provided'),
      'Submitted At: ' + new Date().toLocaleString('en-IN')
    ];
    return lines.join('\n');
  }

  function renderSuccessCard(payload, postedRemotely, submissionId) {
    if (!resultBox) {
      return;
    }

    while (resultBox.firstChild) {
      resultBox.removeChild(resultBox.firstChild);
    }

    const card = document.createElement('div');
    card.className = 'submit-success-card';

    const heading = document.createElement('h3');
    heading.className = 'submit-success-card__title';
    heading.textContent = postedRemotely
      ? (submissionId
          ? 'Project submitted! ID: ' + submissionId
          : 'Project submitted! Confirmation email sent.')
      : 'Submission details ready';
    card.appendChild(heading);

    const sub = document.createElement('p');
    sub.className = 'submit-success-card__subtitle';
    sub.textContent = postedRemotely
      ? 'Your project has been recorded and a confirmation email has been sent to ' + payload.email + '.'
      : 'Paste your Google Apps Script URL in js/submit.js for automatic Sheet + Email delivery, or copy/email your summary below.';
    card.appendChild(sub);

    const list = document.createElement('dl');
    list.className = 'verify__card-details';

    const rows = [
      ...(submissionId ? [['Submission ID', submissionId]] : []),
      ['Name', payload.name],
      ['Department & Year', payload.department],
      ['Roll Number', payload.rollNo],
      ['Email', payload.email],
      ['Project Title', payload.title],
      ['Category', payload.category],
      ['Git Repository', payload.gitUrl],
      ['Deployed Website', payload.liveUrl || 'Not provided']
    ];

    rows.forEach(([labelText, valueText]) => {
      const row = document.createElement('div');
      row.className = 'verify__card-row';

      const dt = document.createElement('dt');
      dt.className = 'verify__card-label';
      dt.textContent = labelText;

      const dd = document.createElement('dd');
      dd.className = 'verify__card-value';
      dd.style.margin = '0';
      dd.style.wordBreak = 'break-word';
      dd.textContent = valueText;

      row.appendChild(dt);
      row.appendChild(dd);
      list.appendChild(row);
    });

    card.appendChild(list);

    const actions = document.createElement('div');
    actions.className = 'submit-success-card__actions';

    const summaryText = buildSummaryText(payload);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-primary';
    copyBtn.textContent = 'Copy submission summary';

    const copyStatus = document.createElement('span');
    copyStatus.className = 'submit-copy-status';
    copyStatus.setAttribute('role', 'status');

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(summaryText);
        copyStatus.textContent = 'Copied to clipboard.';
      } catch (_err) {
        copyStatus.textContent = 'Copy failed. Please select and copy manually.';
      }
    });

    const mailLink = document.createElement('a');
    mailLink.className = 'btn btn-secondary';
    const subject = encodeURIComponent('Build with AI: ABC Submission - ' + payload.title);
    const body = encodeURIComponent(summaryText);
    mailLink.href = 'mailto:' + ORGANIZER_EMAIL + '?subject=' + subject + '&body=' + body;
    mailLink.textContent = 'Send via Email';

    actions.appendChild(copyBtn);
    actions.appendChild(mailLink);
    card.appendChild(actions);
    card.appendChild(copyStatus);

    resultBox.appendChild(card);
    resultBox.removeAttribute('hidden');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessages();

    const payload = {
      name: (nameInput ? nameInput.value : '').trim(),
      department: (deptInput ? deptInput.value : '').trim(),
      rollNo: (rollInput ? rollInput.value : '').trim().toUpperCase(),
      email: (emailInput ? emailInput.value : '').trim(),
      title: (titleInput ? titleInput.value : '').trim(),
      category: (categoryInput ? categoryInput.value : '').trim(),
      description: (descInput ? descInput.value : '').trim(),
      gitUrl: (gitInput ? gitInput.value : '').trim(),
      liveUrl: (liveInput ? liveInput.value : '').trim()
    };

    if (!payload.name) {
      showError('Please enter your full name.', nameInput);
      return;
    }
    if (!payload.department) {
      showError('Please enter your department and year.', deptInput);
      return;
    }
    if (!payload.rollNo) {
      showError('Please enter your college roll number.', rollInput);
      return;
    }
    if (!payload.email || !isValidEmail(payload.email)) {
      showError('Please enter a valid email address for your confirmation email.', emailInput);
      return;
    }
    if (!payload.category) {
      showError('Please select a project category.', categoryInput);
      return;
    }
    if (!payload.title) {
      showError('Please enter your project title.', titleInput);
      return;
    }
    if (!payload.description) {
      showError('Please enter a short project description.', descInput);
      return;
    }
    if (!payload.gitUrl || !isValidHttpUrl(payload.gitUrl)) {
      showError('Please enter a valid Git repository URL starting with https:// or http://.', gitInput);
      return;
    }
    if (payload.liveUrl && !isValidHttpUrl(payload.liveUrl)) {
      showError('Please enter a valid deployed website URL starting with https:// or http://, or leave it blank.', liveInput);
      return;
    }

    if (GOOGLE_APPS_SCRIPT_URL) {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }
      try {
        // Use text/plain to avoid CORS preflight with Google Apps Script
        const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        let responseData = {};
        try {
          responseData = await res.json();
        } catch (_parseErr) {
          responseData = {};
        }
        const submissionId = responseData.submissionId || '';
        renderSuccessCard(payload, true, submissionId);
        showToast(
          submissionId
            ? 'Submitted (' + submissionId + ')! Confirmation email sent to ' + payload.email + '.'
            : 'Project submitted! Confirmation email sent to ' + payload.email + '.',
          'success'
        );
        form.reset();
      } catch (_err) {
        showError('Could not reach the submission server. Please try again or use the Copy/Email option below.');
        showToast('Submission could not reach the server. Please try again.', 'error');
        renderSuccessCard(payload, false);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Project';
        }
      }
      return;
    }

    renderSuccessCard(payload, false);
  });

  form.addEventListener('reset', () => {
    clearMessages();
  });
}
