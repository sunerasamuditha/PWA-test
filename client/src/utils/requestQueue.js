import { openDB } from 'idb';

const DB_NAME = 'wecare-request-queue';
const STORE_NAME = 'failed-requests';
const DB_VERSION = 1;

/**
 * Initialize IndexedDB database for request queue
 */
export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('retry_count', 'retry_count');
      }
    }
  });
}

/**
 * Sanitize request headers by removing sensitive information
 * Note: Preserves CSRF tokens as they may be required by the server
 */
function sanitizeHeaders(headers) {
  if (!headers) return {};
  
  const sanitized = { ...headers };
  // Remove authorization tokens for security (will be re-added on retry)
  delete sanitized.Authorization;
  delete sanitized.authorization;
  
  // Preserve CSRF tokens - they may be needed for server-side CSRF protection
  // If CSRF protection is enabled, the token should be retained or regenerated on retry
  // NOTE: If your server uses rotating CSRF tokens, you may need to regenerate
  // the token before retry instead of preserving the old one
  
  return sanitized;
}

/**
 * Check if a request is retryable (not a GET request and not auth-related)
 */
function isRetryableRequest(request) {
  // Don't retry GET requests (they're safe to re-fetch)
  if (request.method && request.method.toUpperCase() === 'GET') {
    return false;
  }

  // Don't retry auth requests
  if (request.url && request.url.includes('/auth')) {
    return false;
  }

  return true;
}

/**
 * Add a failed request to the queue
 */
export async function addFailedRequest(request) {
  try {
    // Only queue retryable requests
    if (!isRetryableRequest(request)) {
      console.log('Skipping non-retryable request:', request.method, request.url);
      return null;
    }

    const db = await initDB();
    const failedRequest = {
      url: request.url,
      method: request.method,
      headers: sanitizeHeaders(request.headers),
      body: request.body,
      params: request.params || {}, // Include params for query strings
      timestamp: Date.now(),
      retry_count: 0,
      error_message: request.error_message || 'Network error'
    };
    
    const key = await db.add(STORE_NAME, failedRequest);
    
    // Dispatch custom event for PWA context to listen
    window.dispatchEvent(new CustomEvent('request-queued', { 
      detail: { key, request: failedRequest } 
    }));
    
    return key;
  } catch (error) {
    console.error('Failed to add request to queue:', error);
    throw error;
  }
}

/**
 * Get all failed requests from the queue
 */
export async function getFailedRequests() {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    
    return await index.getAll();
  } catch (error) {
    console.error('Failed to get failed requests:', error);
    return [];
  }
}

/**
 * Remove a failed request from the queue
 */
export async function removeFailedRequest(key) {
  try {
    const db = await initDB();
    await db.delete(STORE_NAME, key);
    
    // Dispatch event for queue update
    window.dispatchEvent(new CustomEvent('request-removed', { 
      detail: { key } 
    }));
  } catch (error) {
    console.error('Failed to remove request from queue:', error);
    throw error;
  }
}

/**
 * Update retry count for a failed request
 */
export async function updateRetryCount(key, retryCount) {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const request = await store.get(key);
    if (request) {
      request.retry_count = retryCount;
      await store.put(request);
    }
    
    await tx.done;
  } catch (error) {
    console.error('Failed to update retry count:', error);
    throw error;
  }
}

/**
 * Clear all failed requests from the queue
 */
export async function clearAllFailedRequests() {
  try {
    const db = await initDB();
    await db.clear(STORE_NAME);
    
    window.dispatchEvent(new CustomEvent('queue-cleared'));
  } catch (error) {
    console.error('Failed to clear failed requests:', error);
    throw error;
  }
}

/**
 * Get the size of the failed request queue
 */
export async function getQueueSize() {
  try {
    const db = await initDB();
    const count = await db.count(STORE_NAME);
    return count;
  } catch (error) {
    console.error('Failed to get queue size:', error);
    return 0;
  }
}

/**
 * Retry a single failed request
 */
export async function retryFailedRequest(request, api) {
  try {
    const config = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      data: request.body,
      params: request.params || {} // Include params for query strings
    };
    
    await api.request(config);
    return true;
  } catch (error) {
    console.error('Failed to retry request:', error);
    return false;
  }
}

/**
 * Retry all failed requests with exponential backoff
 */
export async function retryAllFailedRequests(api) {
  const requests = await getFailedRequests();
  let successCount = 0;
  let failedCount = 0;
  const maxRetries = 5;
  
  for (const request of requests) {
    // Skip if max retries reached
    if (request.retry_count >= maxRetries) {
      failedCount++;
      continue;
    }
    
    // Calculate exponential backoff delay
    const delay = 1000 * Math.pow(2, request.retry_count);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Attempt retry
    const success = await retryFailedRequest(request, api);
    
    if (success) {
      // Remove from queue on success
      await removeFailedRequest(request.id);
      successCount++;
    } else {
      // Increment retry count on failure
      await updateRetryCount(request.id, request.retry_count + 1);
      failedCount++;
    }
  }
  
  return {
    success_count: successCount,
    failed_count: failedCount,
    total: requests.length
  };
}
