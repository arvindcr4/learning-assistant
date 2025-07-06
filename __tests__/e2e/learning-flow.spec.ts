import { test, expect } from '@playwright/test'

test.describe('Learning Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the learning dashboard
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should complete a full learning session workflow', async ({ page }) => {
    // 1. Start with dashboard view
    await expect(page.locator('h1')).toContainText('Learning Dashboard')
    
    // 2. Check learning progress stats
    const progressCard = page.locator('[data-testid="progress-card"]').first()
    await expect(progressCard).toBeVisible()
    
    // 3. Navigate to learning content
    await page.click('text=Start Learning')
    await page.waitForLoadState('networkidle')
    
    // 4. Verify learning content is displayed
    await expect(page.locator('h2')).toContainText('Learning Content')
    
    // 5. Start a learning module
    const moduleCard = page.locator('[data-testid="module-card"]').first()
    await moduleCard.click()
    
    // 6. Verify module content loads
    await expect(page.locator('[data-testid="module-content"]')).toBeVisible()
    
    // 7. Interact with content (simulate reading/watching)
    await page.waitForTimeout(2000) // Simulate engagement time
    
    // 8. Complete module
    await page.click('button:has-text("Mark Complete")')
    
    // 9. Verify completion feedback
    await expect(page.locator('.success-message')).toBeVisible()
    
    // 10. Navigate back to dashboard
    await page.click('text=Dashboard')
    
    // 11. Verify updated progress
    const updatedProgress = page.locator('[data-testid="completion-rate"]')
    await expect(updatedProgress).toBeVisible()
  })

  test('should adapt content based on learning style', async ({ page }) => {
    // 1. Navigate to learning style assessment
    await page.goto('/assessment/vark')
    
    // 2. Complete VARK questionnaire
    const questions = page.locator('[data-testid="vark-question"]')
    const questionCount = await questions.count()
    
    for (let i = 0; i < questionCount; i++) {
      const question = questions.nth(i)
      const firstOption = question.locator('input[type="radio"]').first()
      await firstOption.check()
    }
    
    // 3. Submit assessment
    await page.click('button:has-text("Submit Assessment")')
    
    // 4. Verify results page
    await expect(page.locator('h2')).toContainText('Your Learning Style')
    
    // 5. Navigate to content
    await page.goto('/learning/content')
    
    // 6. Verify adapted content is shown
    const contentVariant = page.locator('[data-testid="content-variant"]')
    await expect(contentVariant).toBeVisible()
    
    // 7. Check that visual content is prioritized (based on test data)
    const visualContent = page.locator('[data-testid="visual-content"]')
    await expect(visualContent).toBeVisible()
  })

  test('should take and complete a quiz', async ({ page }) => {
    // 1. Navigate to quiz section
    await page.goto('/quiz')
    
    // 2. Select a quiz
    const quizCard = page.locator('[data-testid="quiz-card"]').first()
    await quizCard.click()
    
    // 3. Start quiz
    await page.click('button:has-text("Start Quiz")')
    
    // 4. Verify quiz interface
    await expect(page.locator('[data-testid="quiz-question"]')).toBeVisible()
    await expect(page.locator('[data-testid="quiz-timer"]')).toBeVisible()
    
    // 5. Answer questions
    const questions = page.locator('[data-testid="quiz-question"]')
    const questionCount = await questions.count()
    
    for (let i = 0; i < questionCount; i++) {
      // Select first option for each question
      const firstOption = page.locator('input[type="radio"]').first()
      await firstOption.check()
      
      // Move to next question
      if (i < questionCount - 1) {
        await page.click('button:has-text("Next")')
      }
    }
    
    // 6. Submit quiz
    await page.click('button:has-text("Submit Quiz")')
    
    // 7. Verify results page
    await expect(page.locator('h2')).toContainText('Quiz Results')
    await expect(page.locator('[data-testid="quiz-score"]')).toBeVisible()
    await expect(page.locator('[data-testid="quiz-feedback"]')).toBeVisible()
    
    // 8. Check if passed/failed status is shown
    const passStatus = page.locator('[data-testid="pass-status"]')
    await expect(passStatus).toBeVisible()
  })

  test('should track and display analytics', async ({ page }) => {
    // 1. Navigate to analytics page
    await page.goto('/analytics')
    
    // 2. Verify analytics dashboard loads
    await expect(page.locator('h1')).toContainText('Learning Analytics')
    
    // 3. Check progress metrics
    const overallProgress = page.locator('[data-testid="overall-progress"]')
    await expect(overallProgress).toBeVisible()
    
    // 4. Verify style effectiveness chart
    const styleChart = page.locator('[data-testid="style-effectiveness-chart"]')
    await expect(styleChart).toBeVisible()
    
    // 5. Check pace analysis
    const paceAnalysis = page.locator('[data-testid="pace-analysis"]')
    await expect(paceAnalysis).toBeVisible()
    
    // 6. Verify recommendations section
    const recommendations = page.locator('[data-testid="recommendations"]')
    await expect(recommendations).toBeVisible()
    
    // 7. Check that recommendations are personalized
    const personalizedRec = recommendations.locator('.recommendation-item').first()
    await expect(personalizedRec).toBeVisible()
    
    // 8. Test time range filter
    await page.selectOption('[data-testid="time-range-select"]', '7')
    await page.waitForLoadState('networkidle')
    
    // 9. Verify charts update
    await expect(overallProgress).toBeVisible()
  })

  test('should provide real-time adaptive recommendations', async ({ page }) => {
    // 1. Start a learning session
    await page.goto('/learning/session')
    
    // 2. Simulate poor performance to trigger adaptive changes
    await page.evaluate(() => {
      // Mock session data indicating low accuracy
      const sessionData = {
        correctAnswers: 3,
        totalQuestions: 10,
        engagementLevel: 40,
        timeSpent: 15
      }
      
      // Trigger adaptive algorithm
      window.dispatchEvent(new CustomEvent('session-update', { 
        detail: sessionData 
      }))
    })
    
    // 3. Wait for adaptive recommendations
    await page.waitForSelector('[data-testid="adaptive-recommendation"]')
    
    // 4. Verify recommendation appears
    const recommendation = page.locator('[data-testid="adaptive-recommendation"]')
    await expect(recommendation).toBeVisible()
    await expect(recommendation).toContainText('pace')
    
    // 5. Accept recommendation
    await page.click('[data-testid="accept-recommendation"]')
    
    // 6. Verify UI updates to reflect changes
    const updatedPace = page.locator('[data-testid="current-pace"]')
    await expect(updatedPace).toBeVisible()
  })

  test('should handle offline scenarios gracefully', async ({ page, context }) => {
    // 1. Navigate to learning content
    await page.goto('/learning/content')
    
    // 2. Go offline
    await context.setOffline(true)
    
    // 3. Try to navigate to new content
    await page.click('[data-testid="next-module"]')
    
    // 4. Verify offline message appears
    const offlineMessage = page.locator('[data-testid="offline-message"]')
    await expect(offlineMessage).toBeVisible()
    
    // 5. Verify cached content still works
    const cachedContent = page.locator('[data-testid="cached-content"]')
    await expect(cachedContent).toBeVisible()
    
    // 6. Go back online
    await context.setOffline(false)
    
    // 7. Verify sync message appears
    const syncMessage = page.locator('[data-testid="sync-message"]')
    await expect(syncMessage).toBeVisible()
    
    // 8. Verify content loads normally
    await page.reload()
    await expect(page.locator('[data-testid="learning-content"]')).toBeVisible()
  })

  test('should support keyboard navigation', async ({ page }) => {
    // 1. Navigate to main interface
    await page.goto('/')
    
    // 2. Test tab navigation
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toBeVisible()
    
    // 3. Navigate through main menu
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    
    // 4. Verify navigation worked
    await expect(page.locator('h2')).toBeVisible()
    
    // 5. Test quiz navigation with keyboard
    await page.goto('/quiz')
    const firstQuiz = page.locator('[data-testid="quiz-card"]').first()
    await firstQuiz.focus()
    await page.keyboard.press('Enter')
    
    // 6. Verify quiz opens
    await expect(page.locator('[data-testid="quiz-interface"]')).toBeVisible()
    
    // 7. Test answering questions with keyboard
    await page.keyboard.press('1') // Select first option
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter') // Next question
    
    // 8. Verify keyboard interaction works
    const nextQuestion = page.locator('[data-testid="quiz-question"]')
    await expect(nextQuestion).toBeVisible()
  })

  test('should persist user progress across sessions', async ({ page, context }) => {
    // 1. Complete some content
    await page.goto('/learning/content')
    const module = page.locator('[data-testid="module-card"]').first()
    await module.click()
    
    // 2. Mark as complete
    await page.click('button:has-text("Mark Complete")')
    
    // 3. Navigate away
    await page.goto('/analytics')
    
    // 4. Create new session (simulate browser restart)
    await context.clearCookies()
    await page.reload()
    
    // 5. Navigate back to content
    await page.goto('/learning/content')
    
    // 6. Verify progress is maintained
    const completedModule = page.locator('[data-testid="completed-module"]')
    await expect(completedModule).toBeVisible()
    
    // 7. Check analytics show correct progress
    await page.goto('/analytics')
    const progressMetric = page.locator('[data-testid="completion-rate"]')
    await expect(progressMetric).toContainText('completed')
  })

  test('should handle different screen sizes', async ({ page }) => {
    // 1. Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    
    // 2. Verify desktop layout
    const sidebar = page.locator('[data-testid="sidebar"]')
    await expect(sidebar).toBeVisible()
    
    // 3. Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    
    // 4. Verify responsive layout
    const mobileMenu = page.locator('[data-testid="mobile-menu"]')
    await expect(mobileMenu).toBeVisible()
    
    // 5. Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    
    // 6. Verify mobile optimizations
    const compactNav = page.locator('[data-testid="compact-nav"]')
    await expect(compactNav).toBeVisible()
    
    // 7. Test quiz on mobile
    await page.goto('/quiz')
    const quizCard = page.locator('[data-testid="quiz-card"]').first()
    await expect(quizCard).toBeVisible()
    
    // 8. Verify touch interactions work
    await quizCard.tap()
    await expect(page.locator('[data-testid="quiz-interface"]')).toBeVisible()
  })
})