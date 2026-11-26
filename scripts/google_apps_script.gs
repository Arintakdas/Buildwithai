/**
 * Google Apps Script for Build with AI: ABC Project Submissions
 * ------------------------------------------------------------
 * 1. Create a new Google Sheet (e.g. "Build with AI ABC Submissions").
 *    (You can export it as .xlsx anytime via File > Download > Microsoft Excel.)
 * 2. Open Extensions > Apps Script, delete any starter code, and paste this file.
 * 3. Click Deploy > New deployment > Select type: Web app (or Manage deployments > New version).
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web App URL and paste it into GOOGLE_APPS_SCRIPT_URL in js/submit.js.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Add header row if the sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp',
        'Submission ID',
        'Name',
        'Department & Year',
        'Roll Number',
        'Email',
        'Category',
        'Project Title',
        'Description',
        'Git Repository',
        'Deployed Website'
      ]);
    }

    // Generate sequential Submission ID: ENT260301, ENT260302, ...
    var nextSeq = sheet.getLastRow();
    var paddedSeq = nextSeq < 10 ? '0' + nextSeq : String(nextSeq);
    var submissionId = 'ENT2603' + paddedSeq;

    sheet.appendRow([
      new Date(),
      submissionId,
      data.name || '',
      data.department || '',
      data.rollNo || '',
      data.email || '',
      data.category || '',
      data.title || '',
      data.description || '',
      data.gitUrl || '',
      data.liveUrl || ''
    ]);

    // Send confirmation email to the participant
    if (data.email) {
      var subject = '[' + submissionId + '] Submission Received: ' + (data.title || 'Build with AI: ABC');
      var body = [
        'Hello ' + (data.name || 'Participant') + ',',
        '',
        'We have received your project submission for Build with AI: ABC (GDG on Campus GCETTS x Entropy Coding Club).',
        '',
        'Submission ID: ' + submissionId,
        '',
        'Submission Details:',
        '- Name: ' + (data.name || ''),
        '- Roll Number: ' + (data.rollNo || ''),
        '- Department & Year: ' + (data.department || ''),
        '- Project Title: ' + (data.title || ''),
        '- Category: ' + (data.category || ''),
        '- Git Repository: ' + (data.gitUrl || ''),
        '- Deployed Website: ' + (data.liveUrl || 'Not provided'),
        '',
        'Please keep your Submission ID (' + submissionId + ') for future reference.',
        '',
        'Thank you for building with us!',
        'GDG on Campus GCETTS & Entropy Coding Club'
      ].join('\n');

      MailApp.sendEmail(data.email, subject, body);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', submissionId: submissionId }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
