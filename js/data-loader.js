/**
 * data-loader.js
 * --------------
 * ES module for fetching, caching, and verifying JSON data from the server.
 * All URLs are relative (no hardcoded domain). Fetched responses are cached
 * in a module-level Map to avoid redundant network requests.
 */

/**
 * Module-level cache: Maps URL strings to their parsed JSON data.
 * @type {Map<string, any>}
 */
const cache = new Map();

/**
 * Fetch a JSON resource from the given URL, returning cached data if
 * available. Network or parse errors are caught and re-thrown with a
 * descriptive message.
 *
 * @param {string} url - Relative or absolute URL to fetch.
 * @returns {Promise<any>} The parsed JSON data.
 * @throws {Error} If the fetch fails or the response is not OK.
 */
export async function loadJSON(url) {
  // Return cached data if we already fetched this URL.
  if (cache.has(url)) {
    return cache.get(url);
  }

  let response;
  try {
    response = await fetch(url);
  } catch (networkError) {
    throw new Error(
      'Network error while fetching ' + url + ': ' + networkError.message
    );
  }

  if (!response.ok) {
    throw new Error(
      'HTTP ' + response.status + ' (' + response.statusText + ') when fetching ' + url
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new Error(
      'Failed to parse JSON from ' + url + ': ' + parseError.message
    );
  }

  // Store in cache for future calls.
  cache.set(url, data);
  return data;
}

/**
 * Load the leaderboard data from /data/leaderboard.json.
 * Returns an empty array if the fetch fails or the data is not an array.
 *
 * @returns {Promise<Array>} The leaderboard entries.
 */
export async function loadLeaderboard() {
  try {
    const data = await loadJSON('/data/leaderboard.json');
    if (!Array.isArray(data)) {
      console.warn('[data-loader] Leaderboard data is not an array.');
      return [];
    }
    return data;
  } catch (error) {
    console.error('[data-loader] Failed to load leaderboard:', error.message);
    return [];
  }
}

/**
 * Load the notices data from /data/notices.json.
 * Returns an empty array if the fetch fails or the data is not an array.
 *
 * @returns {Promise<Array>} The notice entries.
 */
export async function loadNotices() {
  try {
    const data = await loadJSON('/data/notices.json');
    if (!Array.isArray(data)) {
      console.warn('[data-loader] Notices data is not an array.');
      return [];
    }
    return data;
  } catch (error) {
    console.error('[data-loader] Failed to load notices:', error.message);
    return [];
  }
}

/**
 * Compute the SHA-256 hash of a normalized certificate ID.
 * Normalization: trim whitespace and convert to uppercase.
 *
 * @param {string} id - The raw certificate ID string.
 * @returns {Promise<string>} The lowercase hexadecimal SHA-256 hash.
 */
export async function hashCertificateId(id) {
  // Normalize: trim whitespace and convert to uppercase.
  const normalized = id.trim().toUpperCase();

  // Encode the normalized string as UTF-8 bytes.
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);

  // Compute the SHA-256 digest using the Web Crypto API.
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert the ArrayBuffer to a hexadecimal string.
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map(function(byte) {
      return byte.toString(16).padStart(2, '0');
    })
    .join('');

  return hashHex;
}

/**
 * Verify a certificate by its ID. The ID is normalized (trimmed and
 * uppercased), hashed with SHA-256, and used to look up a JSON file at
 * /data/certs/{hash}.json.
 *
 * @param {string} certId - The certificate ID to verify.
 * @returns {Promise<{ status: 'verified'|'revoked'|'not_found'|'error', data?: object, message?: string }>}
 */
export async function verifyCertificate(certId) {
  // Validate input.
  if (!certId || typeof certId !== 'string' || certId.trim().length === 0) {
    return {
      status: 'error',
      data: null,
      message: 'Certificate ID is required.'
    };
  }

  let hash;
  try {
    hash = await hashCertificateId(certId);
  } catch (hashError) {
    return {
      status: 'error',
      data: null,
      message: 'Failed to compute certificate hash: ' + hashError.message
    };
  }

  const url = '/data/certs/' + hash + '.json';

  let response;
  try {
    response = await fetch(url);
  } catch (networkError) {
    return {
      status: 'error',
      data: null,
      message: 'Network error while verifying certificate: ' + networkError.message
    };
  }

  // A 404 means the certificate was not found in our records.
  if (response.status === 404) {
    return {
      status: 'not_found',
      data: null,
      message: 'Certificate not found.'
    };
  }

  // Any other non-OK status is treated as an error.
  if (!response.ok) {
    return {
      status: 'error',
      data: null,
      message: 'Server returned HTTP ' + response.status + ' (' + response.statusText + ').'
    };
  }

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    return {
      status: 'error',
      data: null,
      message: 'Failed to parse certificate data: ' + parseError.message
    };
  }

  // The certificate JSON is expected to have a "status" field.
  // If the status is "revoked", report it as revoked.
  if (data && data.status === 'revoked') {
    return {
      status: 'revoked',
      data: data,
      message: 'This certificate has been revoked.'
    };
  }

  // Otherwise, treat it as a valid, verified certificate.
  return {
    status: 'verified',
    data: data,
    message: 'Certificate verified successfully.'
  };
}
