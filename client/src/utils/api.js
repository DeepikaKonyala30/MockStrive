/**
 * api.js
 * Centralized API helper for backend requests.
 * Uses Vite environment variables to determine the correct base URL.
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Enhanced fetch wrapper that automatically prepends the backend base URL.
 * 
 * @param {string} endpoint - The API endpoint (e.g. '/api/profile')
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export const apiFetch = (endpoint, options = {}) => {
  return fetch(`${API_BASE_URL}${endpoint}`, options);
};
