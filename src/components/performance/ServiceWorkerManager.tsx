'use client';

import { useEffect, useState, useCallback } from 'react';

export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isActive: boolean;
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
  isOnline: boolean;
  cacheStatus: 'loading' | 'cached' | 'error';
}

interface ServiceWorkerManagerProps {
  onUpdateAvailable?: () => void;
  onRegistrationSuccess?: (registration: ServiceWorkerRegistration) => void;
  onRegistrationError?: (error: Error) => void;
  onOfflineReady?: () => void;
  enableNotifications?: boolean;
}

export const ServiceWorkerManager: React.FC<ServiceWorkerManagerProps> = ({
  onUpdateAvailable,
  onRegistrationSuccess,
  onRegistrationError,
  onOfflineReady,
  enableNotifications = true
}) => {
  const [swStatus, setSwStatus] = useState<ServiceWorkerStatus>({
    isSupported: false,
    isRegistered: false,
    isActive: false,
    registration: null,
    updateAvailable: false,
    isOnline: navigator.onLine,
    cacheStatus: 'loading'
  });

  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const updateServiceWorker = useCallback(async () => {
    if (swStatus.registration) {
      try {
        await swStatus.registration.update();
        if (swStatus.registration.waiting) {
          swStatus.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch (error) {
        console.error('Failed to update service worker:', error);
      }
    }
  }, [swStatus.registration]);

  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      setSwStatus(prev => ({ ...prev, isSupported: false }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'imports'
      });

      setSwStatus(prev => ({
        ...prev,
        isSupported: true,
        isRegistered: true,
        registration
      }));

      if (onRegistrationSuccess) {
        onRegistrationSuccess(registration);
      }

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                setSwStatus(prev => ({ ...prev, updateAvailable: true }));
                if (onUpdateAvailable) {
                  onUpdateAvailable();
                }
              } else {
                setSwStatus(prev => ({ ...prev, isActive: true }));
                if (onOfflineReady) {
                  onOfflineReady();
                }
              }
            }
          });
        }
      });

      // Handle controlled state changes
      if (registration.active) {
        setSwStatus(prev => ({ ...prev, isActive: true }));
      }

      // Check for immediate updates
      registration.update();

    } catch (error) {
      console.error('Service worker registration failed:', error);
      setSwStatus(prev => ({ ...prev, isSupported: true, isRegistered: false }));
      if (onRegistrationError) {
        onRegistrationError(error as Error);
      }
    }
  }, [onRegistrationSuccess, onRegistrationError, onUpdateAvailable, onOfflineReady]);

  const handleInstallClick = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallPrompt(false);
      }
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  useEffect(() => {
    registerServiceWorker();

    // Handle network status changes
    const handleOnline = () => {
      setSwStatus(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setSwStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Handle app install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Handle app installed
    const handleAppInstalled = () => {
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [registerServiceWorker]);

  const getStatusColor = () => {
    if (!swStatus.isOnline) return 'bg-red-500';
    if (swStatus.updateAvailable) return 'bg-yellow-500';
    if (swStatus.isActive) return 'bg-green-500';
    return 'bg-gray-500';
  };

  const getStatusText = () => {
    if (!swStatus.isSupported) return 'Not Supported';
    if (!swStatus.isOnline) return 'Offline';
    if (swStatus.updateAvailable) return 'Update Available';
    if (swStatus.isActive) return 'Active';
    if (swStatus.isRegistered) return 'Registered';
    return 'Inactive';
  };

  return (
    <div className="service-worker-manager">
      {/* Status Indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
        <span className="text-sm font-medium">Service Worker: {getStatusText()}</span>
      </div>

      {/* Update Available Notification */}
      {swStatus.updateAvailable && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Update Available</h4>
              <p className="text-sm text-yellow-700">
                A new version of the app is available. Update now for the latest features and improvements.
              </p>
            </div>
            <button
              onClick={updateServiceWorker}
              className="ml-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
            >
              Update
            </button>
          </div>
        </div>
      )}

      {/* Install App Prompt */}
      {showInstallPrompt && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-blue-800">Install App</h4>
              <p className="text-sm text-blue-700">
                Install this app on your device for a better experience and offline access.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
              >
                Later
              </button>
              <button
                onClick={handleInstallClick}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Notification */}
      {!swStatus.isOnline && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <div className="w-5 h-5 text-red-500 mr-2">
              ⚠️
            </div>
            <div>
              <h4 className="text-sm font-medium text-red-800">You're Offline</h4>
              <p className="text-sm text-red-700">
                Some features may be limited. The app will sync when you're back online.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Service Worker Details */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Service Worker Status</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Supported:</span>
            <span className={swStatus.isSupported ? 'text-green-600' : 'text-red-600'}>
              {swStatus.isSupported ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Registered:</span>
            <span className={swStatus.isRegistered ? 'text-green-600' : 'text-red-600'}>
              {swStatus.isRegistered ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Active:</span>
            <span className={swStatus.isActive ? 'text-green-600' : 'text-red-600'}>
              {swStatus.isActive ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Online:</span>
            <span className={swStatus.isOnline ? 'text-green-600' : 'text-red-600'}>
              {swStatus.isOnline ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Cache Status:</span>
            <span className={
              swStatus.cacheStatus === 'cached' ? 'text-green-600' :
              swStatus.cacheStatus === 'error' ? 'text-red-600' : 'text-yellow-600'
            }>
              {swStatus.cacheStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceWorkerManager;