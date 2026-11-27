# Build with AI: ABC -- Event Website

## Overview

This is a static website for the **Build with AI: ABC** college tech event. It provides
event information, schedules, registration links, a certificate verification portal,
a project leaderboard, and a notices board. The site is fully static and can be deployed
to GitHub Pages, Netlify, Firebase Hosting, or any static file server.

A Python-based data pipeline reads event data from an Excel workbook (`data.xlsx`) and
produces JSON files consumed by the frontend. Certificate verification uses SHA-256
hashing to prevent enumeration of participant records.

---


## Project Structure

```
google project/
|-- index.html                  Main landing page
|-- styles.css                  Global stylesheet
|-- script.js                   Frontend JavaScript
|-- data.xlsx                   Source data workbook (3 sheets)
|-- README.md                   This file
|
|-- images/                     Static image assets
|   |-- venue.jpg               Venue photograph (placeholder)
|   |-- lab.jpg                 Lab photograph (placeholder)
|   |-- hero-bg.jpg             Hero section background
|   |-- ...
|
|-- scripts/                    Data pipeline scripts
|   |-- requirements.txt        Python dependencies
|   |-- build_data.py           Reads data.xlsx, produces JSON files
|   |-- make_qr.py              Generates QR codes for certificates
|
|-- data/                       Generated JSON output (do not edit by hand)
|   |-- certs/                  Individual certificate JSON files (SHA-256 named)
|   |   |-- <sha256hex>.json
|   |   |-- ...
|   |-- leaderboard.json        Leaderboard data
|   |-- notices.json            Notices and announcements
|
|-- qr/                         Generated QR code images
    |-- <certificate_id>.png
    |-- <certificate_id>.svg
    |-- ...
```

---

## Setup and Deployment

### Prerequisites

- **Python 3.8+** with pip
- A modern web browser (Chrome, Firefox, Edge, Safari)
- Git (for version control and GitHub Pages deployment)
- (Optional) Node.js if you want to use a local development server other than Python

### Data Pipeline

The data pipeline converts the Excel workbook into static JSON files that the website
consumes at runtime. Follow these steps in order:

#### Step 1: Edit data.xlsx

Open `data.xlsx` in Excel, Google Sheets, or LibreOffice Calc. It contains three sheets:

**certificates** sheet columns:

| Column         | Description                                      | Constraints                        |
|----------------|--------------------------------------------------|------------------------------------|
| certificate_id | Unique identifier for each certificate           | Must be unique, no duplicates      |
| name           | Full name of the participant                     | Required, cannot be empty          |
| college        | College or institution name                      | --                                 |
| department     | Department or branch of study                    | --                                 |
| year           | Year of study (e.g., 2nd Year, 3rd Year)         | --                                 |
| role           | Role at the event (Participant, Organizer, etc.) | --                                 |
| event          | Specific event or track name                     | --                                 |
| issue_date     | Date the certificate was issued                  | Must be a valid parseable date     |
| status         | Certificate validity status                      | Must be "valid" or "revoked"       |

**leaderboard** sheet columns:

| Column        | Description                        |
|---------------|------------------------------------|
| rank          | Numeric rank (1, 2, 3, ...)        |
| name_or_team  | Individual or team name            |
| project_title | Title of the submitted project     |
| category      | Project category or track          |
| prize         | Prize awarded (e.g., 1st Place)    |
| points        | Numeric score or points earned     |

**notices** sheet columns:

| Column   | Description                                   | Constraints                          |
|----------|-----------------------------------------------|--------------------------------------|
| date     | Date of the notice                            | Valid date                           |
| title    | Notice headline                               | --                                   |
| body     | Full notice text                              | --                                   |
| category | Type of notice                                | Must be: Notice, Event, or Update    |
| link     | Optional URL for more information             | --                                   |
| pinned   | Whether notice stays at the top               | Must be "yes" or "no"                |

#### Step 2: Install Python dependencies

```bash
cd scripts
pip install -r requirements.txt
```

This installs pandas, openpyxl, qrcode, and Pillow.

#### Step 3: Run build_data.py

```bash
python scripts/build_data.py
```

This reads `data.xlsx` from the project root and writes output to the `data/` directory:
- Individual certificate JSON files in `data/certs/` (named by SHA-256 hash)
- `data/leaderboard.json` (sorted by rank)
- `data/notices.json` (pinned first, then sorted by date descending)

If validation errors are found (duplicate IDs, empty names, invalid dates, bad status
values), the script prints all errors and exits with code 1 without writing any files.

Optional arguments:

```bash
python scripts/build_data.py --input path/to/data.xlsx --output path/to/output/
```

#### Step 4: Run make_qr.py

```bash
python scripts/make_qr.py --domain yourdomain.com
```

This generates QR code images for each certificate in both PNG (300x300) and SVG formats.
Each QR code encodes the URL `https://yourdomain.com/verify/?id=<certificate_id>`.

Output is written to the `qr/` directory by default.

Optional arguments:

```bash
python scripts/make_qr.py --input path/to/data.xlsx --output path/to/qr/ --domain example.com
```

#### Step 5: Verify output

Check that the following files and directories exist and contain valid data:

- `data/certs/` -- One JSON file per certificate (named with SHA-256 hex strings)
- `data/leaderboard.json` -- Array of leaderboard entries
- `data/notices.json` -- Array of notice entries
- `qr/` -- PNG and SVG files for each certificate ID

---

### Local Development

#### Using Python's built-in HTTP server

From the project root directory:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser. This serves all files in the
current directory. Note that Python's server does not support live reload.

#### Using VS Code Live Server

1. Install the **Live Server** extension by Ritwick Dey from the VS Code marketplace.
2. Open the project folder in VS Code.
3. Right-click `index.html` and select **Open with Live Server**.
4. The site opens in your default browser with automatic reload on file changes.

---

### Deploying to GitHub Pages

1. **Create a GitHub repository** and push your project:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```

2. **Enable GitHub Pages** in your repository settings:
   - Go to Settings > Pages.
   - Under "Source", select the `main` branch and `/ (root)` folder.
   - Click Save.

3. **Access your site** at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

4. **Custom domain** (optional):
   - In Settings > Pages, enter your custom domain.
   - Add a `CNAME` file to the repository root containing your domain name.
   - Configure DNS records with your domain registrar (CNAME or A records).

5. **Updating the site**: Push changes to the `main` branch. GitHub Pages rebuilds
   automatically within a few minutes.

---

### Deploying to Netlify

1. **Sign up** at [netlify.com](https://www.netlify.com/) and connect your GitHub account.

2. **Create a new site**:
   - Click "Add new site" > "Import an existing project".
   - Select your GitHub repository.
   - Set the build settings:
     - **Build command**: Leave blank (static site, no build step needed).
     - **Publish directory**: `.` (the repository root).
   - Click "Deploy site".

3. **Custom domain**:
   - Go to Site settings > Domain management > Add custom domain.
   - Follow Netlify's instructions to configure DNS.

4. **Continuous deployment**: Every push to your connected branch triggers a
   new deployment automatically.

5. **Manual deploy** (drag and drop):
   - Alternatively, go to the Netlify dashboard and drag your project folder
     onto the deploy area.

---

### Deploying to Firebase Hosting

1. **Install the Firebase CLI**:

   ```bash
   npm install -g firebase-tools
   ```

2. **Log in to Firebase**:

   ```bash
   firebase login
   ```

3. **Initialize Firebase Hosting** in your project directory:

   ```bash
   firebase init hosting
   ```

   When prompted:
   - Select your Firebase project (or create a new one).
   - Set the public directory to `.` (the project root).
   - Configure as a single-page app: **No** (unless you have client-side routing).
   - Do not overwrite `index.html` if prompted.

4. **Deploy**:

   ```bash
   firebase deploy --only hosting
   ```

5. **Access your site** at the URL shown in the terminal output (typically
   `https://YOUR-PROJECT-ID.web.app`).

6. **Custom domain**:
   - Go to the Firebase Console > Hosting > Add custom domain.
   - Follow the verification and DNS configuration steps.

7. **Preview channels** (optional):

   ```bash
   firebase hosting:channel:deploy preview-name
   ```

   This creates a temporary preview URL for testing before going live.

---

## Placeholders to Replace

Before deploying your site to production, search for and replace the following
placeholders throughout the project files:

- [ ] `[PASTE GOOGLE FORM LINK]` -- Registration Google Form URL
- [ ] `[YOUR-DOMAIN]` -- Your actual domain (e.g., `buildwithai-abc.web.app`)
- [ ] `[COLLEGE NAME]` -- Your college name
- [ ] Google Maps embed URL in the venue section of `index.html`
- [ ] `[Instagram]` -- Instagram profile URL
- [ ] `[LinkedIn]` -- LinkedIn profile URL
- [ ] `[GitHub]` -- GitHub profile URL
- [ ] `[contact email]` -- Contact email address
- [ ] `images/venue.jpg` -- Replace with your actual venue photograph
- [ ] `images/lab.jpg` -- Replace with your actual lab photograph

---

## Sample Data

The included `data.xlsx` file contains sample data for testing the pipeline. Each of
the three sheets has 5 dummy rows:

- **certificates**: Five sample certificates with fictional names, departments, and
  certificate IDs. These demonstrate the full validation and hashing pipeline.

- **leaderboard**: Five sample project entries ranked 1 through 5 with placeholder
  team names, project titles, categories, prizes, and point values.

- **notices**: Five sample notices demonstrating each category type (Notice, Event,
  Update), with a mix of pinned and unpinned entries and various dates to show the
  sorting behavior.

After running `build_data.py`, you can verify the output by inspecting the generated
JSON files in the `data/` directory. Replace the sample data with your real event data
before deploying.

---

## Security

This project follows several security practices for a static site:

- **Certificate hashing**: Individual certificate records are stored as separate JSON
  files named by the SHA-256 hash of the certificate ID. This means an attacker cannot
  enumerate all certificates by listing a directory or guessing sequential IDs. A valid
  certificate ID is required to locate the corresponding record.

- **Minimal PII exposure**: Certificate JSON files contain only name, college,
  department, year, role, event, issue date, and status. No email addresses, phone
  numbers, or other sensitive personally identifiable information is included in the
  public data files.

- **Safe DOM rendering**: All user-visible data is rendered using `textContent` rather
  than `innerHTML`. This prevents Cross-Site Scripting (XSS) attacks through malicious
  data in the Excel source file.

- **Content Security Policy**: A CSP meta tag in the HTML restricts script sources and
  limits the attack surface for injected scripts.

---

## License

MIT License

Copyright (c) 2026 [GCETTS]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
