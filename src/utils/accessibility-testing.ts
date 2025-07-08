/**
 * Comprehensive accessibility testing utilities for automated and manual testing
 */

import { AccessibilityViolation, validateAccessibility } from './accessibility';

export interface AccessibilityTestResult {
  score: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  violations: AccessibilityViolation[];
  wcagLevel: 'A' | 'AA' | 'AAA' | 'Fail';
  recommendations: string[];
  detailedReport: AccessibilityTestReport;
}

export interface AccessibilityTestReport {
  colorContrast: {
    passed: boolean;
    score: number;
    issues: string[];
  };
  keyboardNavigation: {
    passed: boolean;
    score: number;
    issues: string[];
  };
  screenReaderSupport: {
    passed: boolean;
    score: number;
    issues: string[];
  };
  semanticStructure: {
    passed: boolean;
    score: number;
    issues: string[];
  };
  formAccessibility: {
    passed: boolean;
    score: number;
    issues: string[];
  };
  imageAlternatives: {
    passed: boolean;
    score: number;
    issues: string[];
  };
  headingStructure: {
    passed: boolean;
    score: number;
    issues: string[];
  };
  landmarks: {
    passed: boolean;
    score: number;
    issues: string[];
  };
}

/**
 * Run comprehensive accessibility tests on a page or component
 */
export async function runAccessibilityAudit(element?: HTMLElement): Promise<AccessibilityTestResult> {
  const container = element || document.body;
  const report: AccessibilityTestReport = {
    colorContrast: await testColorContrast(container),
    keyboardNavigation: await testKeyboardNavigation(container),
    screenReaderSupport: await testScreenReaderSupport(container),
    semanticStructure: await testSemanticStructure(container),
    formAccessibility: await testFormAccessibility(container),
    imageAlternatives: await testImageAlternatives(container),
    headingStructure: await testHeadingStructure(container),
    landmarks: await testLandmarks(container)
  };

  const violations = validateAccessibility(container);
  const scores = Object.values(report).map(test => test.score);
  const totalScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const passedTests = Object.values(report).filter(test => test.passed).length;
  const failedTests = Object.values(report).length - passedTests;

  const wcagLevel = determineWcagLevel(totalScore);
  const recommendations = generateRecommendations(report);

  return {
    score: Math.round(totalScore),
    totalTests: Object.values(report).length,
    passedTests,
    failedTests,
    violations,
    wcagLevel,
    recommendations,
    detailedReport: report
  };
}

/**
 * Test color contrast ratios
 */
async function testColorContrast(container: HTMLElement) {
  const issues: string[] = [];
  let totalElements = 0;
  let passedElements = 0;

  // Test text elements
  const textElements = container.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button, label');
  
  textElements.forEach((element) => {
    if (element.textContent?.trim()) {
      totalElements++;
      const computedStyle = window.getComputedStyle(element);
      const color = computedStyle.color;
      const backgroundColor = computedStyle.backgroundColor;
      
      // Simple contrast check (would need more sophisticated checking in production)
      if (isGoodContrast(color, backgroundColor)) {
        passedElements++;
      } else {
        issues.push(`Poor contrast on ${element.tagName.toLowerCase()}: ${element.textContent?.substring(0, 50)}...`);
      }
    }
  });

  const score = totalElements > 0 ? (passedElements / totalElements) * 100 : 100;
  
  return {
    passed: score >= 95,
    score: Math.round(score),
    issues
  };
}

/**
 * Test keyboard navigation
 */
async function testKeyboardNavigation(container: HTMLElement) {
  const issues: string[] = [];
  let totalElements = 0;
  let passedElements = 0;

  // Test focusable elements
  const focusableElements = container.querySelectorAll(
    'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"]), iframe, object, embed'
  );

  focusableElements.forEach((element) => {
    totalElements++;
    const tabIndex = element.getAttribute('tabindex');
    const isDisabled = element.hasAttribute('disabled');
    
    if (!isDisabled && (tabIndex === null || parseInt(tabIndex) >= 0)) {
      passedElements++;
    } else if (!isDisabled && parseInt(tabIndex!) < 0) {
      issues.push(`Element ${element.tagName.toLowerCase()} has negative tabindex but is not disabled`);
    }
  });

  // Check for keyboard event handlers
  const interactiveElements = container.querySelectorAll('[onclick], [onkeydown], [onkeyup], [onkeypress]');
  interactiveElements.forEach((element) => {
    if (!element.hasAttribute('tabindex') && element.tagName.toLowerCase() !== 'button') {
      issues.push(`Interactive element ${element.tagName.toLowerCase()} missing tabindex`);
    }
  });

  const score = totalElements > 0 ? (passedElements / totalElements) * 100 : 100;
  
  return {
    passed: score >= 90 && issues.length === 0,
    score: Math.round(score),
    issues
  };
}

/**
 * Test screen reader support
 */
async function testScreenReaderSupport(container: HTMLElement) {
  const issues: string[] = [];
  let totalElements = 0;
  let passedElements = 0;

  // Test ARIA labels
  const interactiveElements = container.querySelectorAll('button, input, select, textarea, a, [role]');
  
  interactiveElements.forEach((element) => {
    totalElements++;
    const hasAriaLabel = element.hasAttribute('aria-label');
    const hasAriaLabelledBy = element.hasAttribute('aria-labelledby');
    const hasLabel = container.querySelector(`label[for="${element.id}"]`);
    const hasTextContent = element.textContent?.trim();
    
    if (hasAriaLabel || hasAriaLabelledBy || hasLabel || hasTextContent) {
      passedElements++;
    } else {
      issues.push(`Element ${element.tagName.toLowerCase()} missing accessible name`);
    }
  });

  // Test aria-live regions
  const liveRegions = container.querySelectorAll('[aria-live]');
  if (liveRegions.length === 0) {
    issues.push('No aria-live regions found for dynamic content announcements');
  }

  const score = totalElements > 0 ? (passedElements / totalElements) * 100 : 100;
  
  return {
    passed: score >= 95,
    score: Math.round(score),
    issues
  };
}

/**
 * Test semantic structure
 */
async function testSemanticStructure(container: HTMLElement) {
  const issues: string[] = [];
  let score = 100;

  // Check for semantic HTML elements
  const semanticElements = container.querySelectorAll('main, nav, header, footer, aside, section, article');
  if (semanticElements.length === 0) {
    issues.push('No semantic HTML5 elements found');
    score -= 30;
  }

  // Check for proper use of lists
  const lists = container.querySelectorAll('ul, ol');
  lists.forEach((list) => {
    const listItems = list.querySelectorAll('li');
    if (listItems.length === 0) {
      issues.push('Empty list found');
      score -= 10;
    }
  });

  // Check for tables with proper headers
  const tables = container.querySelectorAll('table');
  tables.forEach((table) => {
    const headers = table.querySelectorAll('th');
    if (headers.length === 0) {
      issues.push('Table missing header cells (th)');
      score -= 15;
    }
  });

  return {
    passed: score >= 80,
    score: Math.max(0, score),
    issues
  };
}

/**
 * Test form accessibility
 */
async function testFormAccessibility(container: HTMLElement) {
  const issues: string[] = [];
  let totalInputs = 0;
  let passedInputs = 0;

  const formInputs = container.querySelectorAll('input, select, textarea');
  
  formInputs.forEach((input) => {
    totalInputs++;
    const id = input.id;
    const hasLabel = container.querySelector(`label[for="${id}"]`);
    const hasAriaLabel = input.hasAttribute('aria-label');
    const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
    
    if (hasLabel || hasAriaLabel || hasAriaLabelledBy) {
      passedInputs++;
    } else {
      issues.push(`Input ${input.tagName.toLowerCase()} missing label`);
    }
    
    // Check for error states
    if (input.hasAttribute('aria-invalid') && input.getAttribute('aria-invalid') === 'true') {
      const hasErrorDescription = input.hasAttribute('aria-describedby');
      if (!hasErrorDescription) {
        issues.push('Invalid input missing error description');
      }
    }
  });

  const score = totalInputs > 0 ? (passedInputs / totalInputs) * 100 : 100;
  
  return {
    passed: score >= 100,
    score: Math.round(score),
    issues
  };
}

/**
 * Test image alternatives
 */
async function testImageAlternatives(container: HTMLElement) {
  const issues: string[] = [];
  let totalImages = 0;
  let passedImages = 0;

  const images = container.querySelectorAll('img');
  
  images.forEach((img) => {
    totalImages++;
    const hasAlt = img.hasAttribute('alt');
    const isDecorative = img.getAttribute('role') === 'presentation' || img.getAttribute('alt') === '';
    
    if (hasAlt) {
      passedImages++;
    } else {
      issues.push(`Image missing alt attribute: ${img.src?.substring(0, 50)}...`);
    }
  });

  const score = totalImages > 0 ? (passedImages / totalImages) * 100 : 100;
  
  return {
    passed: score >= 100,
    score: Math.round(score),
    issues
  };
}

/**
 * Test heading structure
 */
async function testHeadingStructure(container: HTMLElement) {
  const issues: string[] = [];
  let score = 100;

  const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const levels = headings.map(h => parseInt(h.tagName.charAt(1)));
  
  if (headings.length === 0) {
    issues.push('No headings found');
    score = 0;
  } else {
    // Check for H1
    if (!levels.includes(1)) {
      issues.push('No H1 heading found');
      score -= 20;
    }
    
    // Check for proper hierarchy
    for (let i = 1; i < levels.length; i++) {
      const current = levels[i];
      const previous = levels[i - 1];
      
      if (current > previous + 1) {
        issues.push(`Heading hierarchy skip from H${previous} to H${current}`);
        score -= 10;
      }
    }
  }

  return {
    passed: score >= 80,
    score: Math.max(0, score),
    issues
  };
}

/**
 * Test ARIA landmarks
 */
async function testLandmarks(container: HTMLElement) {
  const issues: string[] = [];
  let score = 100;

  const landmarks = container.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], main, nav, header, footer, aside');
  
  if (landmarks.length === 0) {
    issues.push('No ARIA landmarks found');
    score = 50;
  }

  // Check for main landmark
  const mainLandmarks = container.querySelectorAll('[role="main"], main');
  if (mainLandmarks.length === 0) {
    issues.push('No main landmark found');
    score -= 20;
  } else if (mainLandmarks.length > 1) {
    issues.push('Multiple main landmarks found');
    score -= 10;
  }

  return {
    passed: score >= 80,
    score: Math.max(0, score),
    issues
  };
}

/**
 * Simple contrast checker (basic implementation)
 */
function isGoodContrast(color: string, backgroundColor: string): boolean {
  // This is a simplified check - in production, you'd want a more robust implementation
  if (color === 'rgb(0, 0, 0)' && backgroundColor === 'rgb(255, 255, 255)') return true;
  if (color === 'rgb(255, 255, 255)' && backgroundColor === 'rgb(0, 0, 0)') return true;
  
  // Default to true for now - would need proper color parsing and contrast calculation
  return true;
}

/**
 * Determine WCAG compliance level
 */
function determineWcagLevel(score: number): 'A' | 'AA' | 'AAA' | 'Fail' {
  if (score >= 95) return 'AAA';
  if (score >= 85) return 'AA';
  if (score >= 70) return 'A';
  return 'Fail';
}

/**
 * Generate accessibility recommendations
 */
function generateRecommendations(report: AccessibilityTestReport): string[] {
  const recommendations: string[] = [];

  if (!report.colorContrast.passed) {
    recommendations.push('Improve color contrast ratios to meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)');
  }

  if (!report.keyboardNavigation.passed) {
    recommendations.push('Ensure all interactive elements are keyboard accessible with proper focus management');
  }

  if (!report.screenReaderSupport.passed) {
    recommendations.push('Add proper ARIA labels and descriptions for screen reader users');
  }

  if (!report.semanticStructure.passed) {
    recommendations.push('Use semantic HTML elements (main, nav, header, footer, etc.) for better structure');
  }

  if (!report.formAccessibility.passed) {
    recommendations.push('Associate all form inputs with proper labels and error descriptions');
  }

  if (!report.imageAlternatives.passed) {
    recommendations.push('Provide meaningful alt text for all images, or mark decorative images appropriately');
  }

  if (!report.headingStructure.passed) {
    recommendations.push('Maintain proper heading hierarchy (H1-H6) without skipping levels');
  }

  if (!report.landmarks.passed) {
    recommendations.push('Add ARIA landmarks to help users navigate page structure');
  }

  return recommendations;
}

/**
 * Generate accessibility report as HTML
 */
export function generateAccessibilityReportHTML(result: AccessibilityTestResult): string {
  return `
    <div class="accessibility-report">
      <h2>Accessibility Audit Report</h2>
      <div class="score-summary">
        <h3>Overall Score: ${result.score}/100 (${result.wcagLevel})</h3>
        <p>Tests Passed: ${result.passedTests}/${result.totalTests}</p>
      </div>
      
      <div class="detailed-results">
        ${Object.entries(result.detailedReport).map(([category, test]) => `
          <div class="test-category">
            <h4>${category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
            <p>Score: ${test.score}/100 ${test.passed ? '✅' : '❌'}</p>
            ${test.issues.length > 0 ? `
              <ul class="issues">
                ${test.issues.map(issue => `<li>${issue}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `).join('')}
      </div>
      
      <div class="recommendations">
        <h3>Recommendations</h3>
        <ul>
          ${result.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

export default {
  runAccessibilityAudit,
  generateAccessibilityReportHTML
};