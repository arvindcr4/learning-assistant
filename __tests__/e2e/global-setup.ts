import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0]?.use || {}
  
  // Launch browser for setup
  const browser = await chromium.launch()
  const page = await browser.newPage()
  
  try {
    // Wait for the application to be ready
    await page.goto(baseURL!)
    await page.waitForLoadState('networkidle')
    
    // Set up test data or authentication if needed
    console.log('Setting up E2E test environment...')
    
    // Create test user data in localStorage for consistent testing
    await page.evaluate(() => {
      localStorage.setItem('test-user-id', 'test-user-123')
      localStorage.setItem('test-session-id', 'test-session-123')
      
      // Mock learning profile data
      const mockProfile = {
        id: 'profile-123',
        userId: 'test-user-123',
        styles: [
          { type: 'visual', score: 85, confidence: 0.9 },
          { type: 'auditory', score: 60, confidence: 0.7 },
          { type: 'reading', score: 70, confidence: 0.8 },
          { type: 'kinesthetic', score: 45, confidence: 0.6 },
        ],
        dominantStyle: 'visual',
        isMultimodal: true,
        adaptationLevel: 78,
      }
      
      localStorage.setItem('learning-profile', JSON.stringify(mockProfile))
    })
    
    console.log('E2E test environment setup complete')
  } catch (error) {
    console.error('Failed to set up E2E test environment:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup