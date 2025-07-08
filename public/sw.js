/**
 * Service Worker for Progressive Enhancement and Offline Functionality
 * Provides accessibility-focused caching and offline support
 */

const CACHE_NAME = 'learning-assistant-v1';
const STATIC_CACHE = 'learning-assistant-static-v1';
const DYNAMIC_CACHE = 'learning-assistant-dynamic-v1';

// Resources that should always be cached for offline access
const ESSENTIAL_RESOURCES = [
  '/',
  '/offline',
  '/manifest.json',
  '/favicon.ico',
  // Add critical CSS and JS files here
];

// Resources that enhance accessibility
const ACCESSIBILITY_RESOURCES = [
  '/accessibility-styles.css',
  '/high-contrast-theme.css',
  '/large-text-styles.css',
  // Audio files for screen reader support
  '/audio/navigation-sound.mp3',
  '/audio/error-sound.mp3',
  '/audio/success-sound.mp3',
];

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache essential resources
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('Service Worker: Caching essential resources');
        return cache.addAll(ESSENTIAL_RESOURCES);
      }),
      // Cache accessibility resources
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('Service Worker: Caching accessibility resources');
        return cache.addAll(ACCESSIBILITY_RESOURCES.filter(resource => {
          // Only cache resources that exist
          return fetch(resource).then(response => response.ok).catch(() => false);
        }));
      })
    ]).then(() => {
      console.log('Service Worker: Installation complete');
      // Force activation
      return self.skipWaiting();
    }).catch((error) => {
      console.error('Service Worker: Installation failed', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete');
      // Take control of all pages
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached content with accessibility optimizations
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests (unless they're for accessibility resources)
  if (url.origin !== location.origin && !isAccessibilityResource(url)) {
    return;
  }
  
  event.respondWith(
    handleFetchRequest(request)
  );
});

/**
 * Handle fetch requests with accessibility-focused caching strategy
 */
async function handleFetchRequest(request) {
  const url = new URL(request.url);
  
  try {
    // For navigation requests (HTML pages)
    if (request.mode === 'navigate') {
      return await handleNavigationRequest(request);
    }
    
    // For static assets (CSS, JS, images)
    if (isStaticAsset(url)) {
      return await handleStaticAssetRequest(request);
    }
    
    // For API requests
    if (isApiRequest(url)) {
      return await handleApiRequest(request);
    }
    
    // For accessibility resources
    if (isAccessibilityResource(url)) {
      return await handleAccessibilityRequest(request);
    }
    
    // Default: network first, cache fallback
    return await networkFirstStrategy(request);
    
  } catch (error) {
    console.error('Service Worker: Fetch error', error);
    return await handleOfflineFallback(request);
  }
}

/**
 * Handle navigation requests (HTML pages)
 */
async function handleNavigationRequest(request) {
  try {
    // Try network first for fresh content
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the response for offline access
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
    
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Ultimate fallback to offline page
    return await caches.match('/offline') || new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Handle static asset requests (cache first)
 */
async function handleStaticAssetRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    return new Response('Asset not available offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Handle API requests (network first with limited cache)
 */
async function handleApiRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache selected API responses for offline functionality
      if (shouldCacheApiResponse(request)) {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone());
      }
    }
    
    return networkResponse;
    
  } catch (error) {
    // Return cached API response if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Add header to indicate this is cached data
      const response = cachedResponse.clone();
      response.headers.set('X-Served-From', 'cache');
      return response;
    }
    
    // Return offline indicator for API requests
    return new Response(JSON.stringify({
      error: 'Offline',
      message: 'This feature requires an internet connection'
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

/**
 * Handle accessibility-specific resources
 */
async function handleAccessibilityRequest(request) {
  // Always prioritize accessibility resources
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Try to update cache in background
    fetch(request).then(async (networkResponse) => {
      if (networkResponse.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, networkResponse);
      }
    }).catch(() => {
      // Ignore network errors for background updates
    });
    
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    return new Response('Accessibility resource not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Network first strategy
 */
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Not available offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Handle offline fallbacks
 */
async function handleOfflineFallback(request) {
  const url = new URL(request.url);
  
  // Try to find a cached version
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Return appropriate offline page based on request type
  if (request.mode === 'navigate') {
    return await caches.match('/offline') || new Response(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Offline - Learning Assistant</title>
        <style>
          body {
            font-family: system-ui, sans-serif;
            max-width: 600px;
            margin: 2rem auto;
            padding: 1rem;
            text-align: center;
          }
          .offline-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          .retry-button {
            background: #0066cc;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 0.375rem;
            font-size: 1rem;
            cursor: pointer;
            margin-top: 1rem;
          }
          .retry-button:hover {
            background: #0056b3;
          }
          .retry-button:focus {
            outline: 2px solid #0066cc;
            outline-offset: 2px;
          }
        </style>
      </head>
      <body>
        <div class="offline-icon" role="img" aria-label="Offline">📴</div>
        <h1>You're Offline</h1>
        <p>This page isn't available right now. Check your internet connection and try again.</p>
        <button class="retry-button" onclick="window.location.reload()" aria-label="Retry loading page">
          Try Again
        </button>
        <p><small>Some features may still be available offline.</small></p>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  return new Response('Not available offline', {
    status: 503,
    statusText: 'Service Unavailable'
  });
}

/**
 * Utility functions
 */
function isStaticAsset(url) {
  return /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(url.pathname);
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isAccessibilityResource(url) {
  return ACCESSIBILITY_RESOURCES.some(resource => url.pathname.includes(resource)) ||
         url.pathname.includes('accessibility') ||
         url.pathname.includes('contrast') ||
         url.pathname.includes('large-text');
}

function shouldCacheApiResponse(request) {
  const url = new URL(request.url);
  
  // Cache specific API endpoints that are useful offline
  const cacheableEndpoints = [
    '/api/learning/profile',
    '/api/learning/progress',
    '/api/user/preferences'
  ];
  
  return cacheableEndpoints.some(endpoint => url.pathname.startsWith(endpoint));
}

// Background sync for accessibility preferences
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-accessibility-preferences') {
    event.waitUntil(syncAccessibilityPreferences());
  }
});

async function syncAccessibilityPreferences() {
  try {
    // Get stored preferences from IndexedDB
    const preferences = await getStoredPreferences();
    
    if (preferences) {
      // Sync with server when back online
      const response = await fetch('/api/user/accessibility-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });
      
      if (response.ok) {
        console.log('Accessibility preferences synced successfully');
        // Clear stored preferences after successful sync
        await clearStoredPreferences();
      }
    }
  } catch (error) {
    console.error('Failed to sync accessibility preferences:', error);
  }
}

async function getStoredPreferences() {
  // Implementation would use IndexedDB to get stored preferences
  return null;
}

async function clearStoredPreferences() {
  // Implementation would clear stored preferences from IndexedDB
}

// Push notifications for accessibility updates
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    // Handle accessibility-related notifications
    if (data.type === 'accessibility-update') {
      event.waitUntil(
        self.registration.showNotification(data.title, {
          body: data.body,
          icon: '/icons/accessibility-192.png',
          badge: '/icons/accessibility-badge.png',
          vibrate: [200, 100, 200], // Accessibility-friendly vibration pattern
          requireInteraction: true, // Keep notification until user interacts
          actions: [
            {
              action: 'view',
              title: 'View Settings'
            },
            {
              action: 'dismiss',
              title: 'Dismiss'
            }
          ]
        })
      );
    }
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    // Open accessibility settings
    event.waitUntil(
      clients.openWindow('/settings/accessibility')
    );
  }
});

console.log('Service Worker: Loaded with accessibility optimizations');