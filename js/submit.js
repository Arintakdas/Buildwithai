/**
 * submit.js
 * ---------
 * ES module for the static Project Submission section (#submit).
 * Validates all mandatory fields (individual name, department/year,
 * certificate ID, project title, category, description, Git repository URL)
 * plus the optional deployed website URL.
 *
 * Because the website is 100% static, valid submissions either:
 *   1. POST to FORM_ENDPOINT if configured (e.g. Formspree / Web3Forms), or
 *   2. Render a verified submission summary card with Copy & Email actions.
 *
 * All DOM updates use createElement and textContent (never innerHTML).
 */

/**
 * Optional static-form backend endpoint (e.g. Formspree or Web3Forms URL).
 * Leave empty to use the built-in summary + copy + email workflow.
 */
const FORM_ENDPOINT = '';

/**
 * Optional organizer email for the pre-filled mailto fallback.
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

export function initProjectSubmission() {
  const form = document.getElementById('project-submit-form');
  if (!form) {
    return;
  }

  const nameInput = document.getElementById('submit-name');
  const deptInput = document.getElementById('submit-dept');
  const certInput = document.getElementById('submit-cert-id');
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
      'Certificate ID: ' + payload.certId,
      'Project Title: ' + payload.title,
      'Category: ' + payload.category,
      'Description: ' + payload.description,
      'Git Repository: ' + payload.gitUrl,
      'Deployed Website: ' + (payload.liveUrl || 'Not provided'),
      'Submitted At: ' + new Date().toLocaleString('en-IN')
    ];
    return lines.join('\n');
  }

  function renderSuccessCard(payload, postedRemotely) {
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
      ? 'Project submitted successfully'
      : 'Submission details ready';
    card.appendChild(heading);

    const sub = document.createElement('p');
    sub.className = 'submit-success-card__subtitle';
    sub.textContent = postedRemotely
      ? 'Your project entry has been recorded.'
      : 'Copy your formatted submission summary below or send it directly via email to the organizers.';
    card.appendChild(sub);

    const list = document.createElement('dl');
    list.className = 'verify__card-details';

    const rows = [
      ['Name', payload.name],
      ['Department & Year', payload.department],
      ['Certificate ID', payload.certId],
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
      certId: (certInput ? certInput.value : '').trim().toUpperCase(),
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
    if (!payload.certId) {
      showError('Please enter your certificate / participant ID.', certInput);
      return;
    }
    if (!payload.title) {
      showError('Please enter your project title.', titleInput);
      return;
    }
    if (!payload.category) {
      showError('Please select a project category.', categoryInput);
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

    if (FORM_ENDPOINT) {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }
      try {
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        renderSuccessCard(payload, true);
      } catch (_err) {
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
