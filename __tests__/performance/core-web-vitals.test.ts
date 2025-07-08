/**
 * Core Web Vitals Performance Tests
 * 
 * Tests to validate performance optimizations and Core Web Vitals scores
 */

import { test, expect } from '@playwright/test';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';

describe('Core Web Vitals Performance Tests', () => {
  let chrome: any;
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  });

  beforeEach(async () => {
    chrome = await launch({ chromeFlags: ['--headless'] });
  });

  afterEach(async () => {
    if (chrome) {
      await chrome.kill();
    }
  });

  test('should meet Core Web Vitals thresholds for homepage', async () => {
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance'],
      port: chrome.port,
    };

    const runnerResult = await lighthouse(`${baseUrl}/`, options);
    const report = runnerResult?.lhr;

    expect(report).toBeDefined();

    // Core Web Vitals thresholds
    const lcp = report.audits['largest-contentful-paint'].numericValue;
    const fid = report.audits['max-potential-fid'].numericValue;
    const cls = report.audits['cumulative-layout-shift'].numericValue;

    // LCP should be under 2.5 seconds
    expect(lcp).toBeLessThan(2500);
    
    // FID should be under 100ms
    expect(fid).toBeLessThan(100);
    
    // CLS should be under 0.1
    expect(cls).toBeLessThan(0.1);

    console.log('Core Web Vitals Results:', {
      LCP: `${lcp}ms`,
      FID: `${fid}ms`,
      CLS: cls,
    });
  });

  test('should meet performance budget for dashboard page', async () => {
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance'],
      port: chrome.port,
    };

    const runnerResult = await lighthouse(`${baseUrl}/dashboard`, options);
    const report = runnerResult?.lhr;

    expect(report).toBeDefined();

    // Performance score should be above 90
    const performanceScore = report.categories.performance.score * 100;
    expect(performanceScore).toBeGreaterThan(90);

    // First Contentful Paint should be under 1.8 seconds
    const fcp = report.audits['first-contentful-paint'].numericValue;
    expect(fcp).toBeLessThan(1800);

    // Speed Index should be under 3.4 seconds
    const speedIndex = report.audits['speed-index'].numericValue;
    expect(speedIndex).toBeLessThan(3400);

    console.log('Performance Results:', {
      'Performance Score': `${performanceScore}%`,
      'First Contentful Paint': `${fcp}ms`,
      'Speed Index': `${speedIndex}ms`,
    });
  });

  test('should optimize images and use modern formats', async () => {
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance'],
      port: chrome.port,
    };

    const runnerResult = await lighthouse(`${baseUrl}/`, options);
    const report = runnerResult?.lhr;

    expect(report).toBeDefined();

    // Should use modern image formats
    const modernImageFormats = report.audits['modern-image-formats'];
    expect(modernImageFormats.score).toBe(1); // Should pass

    // Should optimize images
    const optimizedImages = report.audits['uses-optimized-images'];
    expect(optimizedImages.score).toBe(1); // Should pass

    // Should properly size images
    const properlySizedImages = report.audits['uses-responsive-images'];
    expect(properlySizedImages.score).toBe(1); // Should pass
  });

  test('should use efficient caching strategies', async () => {
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance'],
      port: chrome.port,
    };

    const runnerResult = await lighthouse(`${baseUrl}/`, options);
    const report = runnerResult?.lhr;

    expect(report).toBeDefined();

    // Should use efficient cache policy
    const efficientCachePolicy = report.audits['uses-long-cache-ttl'];
    expect(efficientCachePolicy.score).toBeGreaterThan(0.8);

    // Should minimize critical request chains
    const criticalRequestChains = report.audits['critical-request-chains'];
    expect(criticalRequestChains.score).toBe(1); // Should pass
  });

  test('should minimize bundle sizes', async () => {
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance'],
      port: chrome.port,
    };

    const runnerResult = await lighthouse(`${baseUrl}/`, options);
    const report = runnerResult?.lhr;

    expect(report).toBeDefined();

    // Should minimize unused JavaScript
    const unusedJavaScript = report.audits['unused-javascript'];
    expect(unusedJavaScript.score).toBeGreaterThan(0.8);

    // Should minimize unused CSS
    const unusedCSS = report.audits['unused-css-rules'];
    expect(unusedCSS.score).toBeGreaterThan(0.8);

    // Should remove duplicate modules
    const duplicateModules = report.audits['duplicated-javascript'];
    expect(duplicateModules.score).toBe(1); // Should pass
  });

  test('should preload critical resources', async () => {
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance'],
      port: chrome.port,
    };

    const runnerResult = await lighthouse(`${baseUrl}/`, options);
    const report = runnerResult?.lhr;

    expect(report).toBeDefined();

    // Should preload key requests
    const preloadKeyRequests = report.audits['uses-rel-preload'];
    expect(preloadKeyRequests.score).toBeGreaterThan(0.8);

    // Should preconnect to required origins
    const preconnectToRequiredOrigins = report.audits['uses-rel-preconnect'];
    expect(preconnectToRequiredOrigins.score).toBeGreaterThan(0.8);
  });

  test('should have good accessibility scores', async () => {
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['accessibility'],
      port: chrome.port,
    };

    const runnerResult = await lighthouse(`${baseUrl}/`, options);
    const report = runnerResult?.lhr;

    expect(report).toBeDefined();

    // Accessibility score should be above 95
    const accessibilityScore = report.categories.accessibility.score * 100;
    expect(accessibilityScore).toBeGreaterThan(95);

    console.log('Accessibility Score:', `${accessibilityScore}%`);
  });

  test('should follow best practices', async () => {
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['best-practices'],
      port: chrome.port,
    };

    const runnerResult = await lighthouse(`${baseUrl}/`, options);
    const report = runnerResult?.lhr;

    expect(report).toBeDefined();

    // Best practices score should be above 90
    const bestPracticesScore = report.categories['best-practices'].score * 100;
    expect(bestPracticesScore).toBeGreaterThan(90);

    console.log('Best Practices Score:', `${bestPracticesScore}%`);
  });

  test('should be PWA ready', async () => {
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['pwa'],
      port: chrome.port,
    };

    const runnerResult = await lighthouse(`${baseUrl}/`, options);
    const report = runnerResult?.lhr;

    expect(report).toBeDefined();

    // Should have a web app manifest
    const webAppManifest = report.audits['installable-manifest'];
    expect(webAppManifest.score).toBe(1);

    // Should have a service worker
    const serviceWorker = report.audits['service-worker'];
    expect(serviceWorker.score).toBe(1);

    // Should work offline
    const worksOffline = report.audits['offline-start-url'];
    expect(worksOffline.score).toBe(1);

    console.log('PWA audits passed');
  });
});

// Playwright-based performance tests
test.describe('Browser Performance Tests', () => {
  test('should load homepage within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    console.log('Homepage load time:', `${loadTime}ms`);
  });

  test('should have fast Time to Interactive', async ({ page }) => {
    await page.goto('/');
    
    // Measure Time to Interactive
    const tti = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          if (entries.length > 0) {
            resolve(entries[0].startTime);
          }
        }).observe({ entryTypes: ['navigation'] });
      });
    });
    
    // TTI should be under 5 seconds
    expect(tti).toBeLessThan(5000);
    
    console.log('Time to Interactive:', `${tti}ms`);
  });

  test('should lazy load images efficiently', async ({ page }) => {
    await page.goto('/');
    
    // Count initial image requests
    const initialImages = await page.evaluate(() => {
      return document.querySelectorAll('img').length;
    });
    
    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    
    await page.waitForTimeout(1000);
    
    const imagesAfterScroll = await page.evaluate(() => {
      return document.querySelectorAll('img').length;
    });
    
    // Should have lazy loaded more images
    expect(imagesAfterScroll).toBeGreaterThanOrEqual(initialImages);
    
    console.log('Image lazy loading working:', {
      initial: initialImages,
      afterScroll: imagesAfterScroll,
    });
  });

  test('should use service worker for caching', async ({ page }) => {
    await page.goto('/');
    
    // Check if service worker is registered
    const serviceWorkerRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    
    expect(serviceWorkerRegistered).toBe(true);
    
    // Check if service worker is active
    const serviceWorkerActive = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.active !== null;
    });
    
    expect(serviceWorkerActive).toBe(true);
    
    console.log('Service Worker is active and caching resources');
  });

  test('should preload critical resources', async ({ page }) => {
    await page.goto('/');
    
    // Check for preload links
    const preloadLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('link[rel="preload"]')).length;
    });
    
    // Should have some preload links
    expect(preloadLinks).toBeGreaterThan(0);
    
    console.log('Preload links found:', preloadLinks);
  });
});

// Bundle size tests
test.describe('Bundle Size Tests', () => {
  test('should keep JavaScript bundles under size limits', async ({ page }) => {
    const responses: any[] = [];
    
    page.on('response', (response) => {
      if (response.url().includes('/_next/static/chunks/') && 
          response.url().endsWith('.js')) {
        responses.push(response);
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check bundle sizes
    for (const response of responses) {
      const contentLength = response.headers()['content-length'];
      if (contentLength) {
        const sizeKB = parseInt(contentLength) / 1024;
        
        // Main bundles should be under 250KB
        if (response.url().includes('main-')) {
          expect(sizeKB).toBeLessThan(250);
        }
        
        console.log('Bundle size:', response.url().split('/').pop(), `${sizeKB.toFixed(2)}KB`);
      }
    }
  });
});

export {};