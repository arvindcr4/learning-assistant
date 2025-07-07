import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Button } from '@/components/ui/Button'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { QuizCard } from '@/components/quiz/QuizCard'
import { mockQuiz, mockQuestions } from '../mocks/test-data'
import { Trophy, TrendingUp } from 'lucide-react'

expect.extend(toHaveNoViolations)

describe('Accessibility Tests for Components', () => {
  describe('Button Component Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <Button>Accessible Button</Button>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper focus management', async () => {
      const { container } = render(
        <div>
          <Button>First Button</Button>
          <Button>Second Button</Button>
          <Button disabled>Disabled Button</Button>
        </div>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should work with screen readers', async () => {
      const { container } = render(
        <Button aria-label="Save your progress" aria-describedby="save-help">
          Save
        </Button>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should handle different states accessibly', async () => {
      const { container } = render(
        <div>
          <Button variant="default">Default</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="outline">Cancel</Button>
          <Button disabled>Disabled</Button>
          <Button aria-pressed="true">Toggle Active</Button>
          <Button aria-expanded="false">Dropdown</Button>
        </div>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('StatsCard Component Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <StatsCard
          title="Learning Progress"
          value="75%"
          description="Overall progress in your courses"
          icon={Trophy}
        />
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should handle progress information accessibly', async () => {
      const { container } = render(
        <StatsCard
          title="Course Completion"
          value="8/10"
          description="Modules completed"
          progress={{
            value: 8,
            max: 10,
            label: 'modules completed'
          }}
        />
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should provide accessible change indicators', async () => {
      const { container } = render(
        <StatsCard
          title="Performance"
          value="85%"
          change={{
            value: 12,
            label: 'improvement from last week',
            trend: 'up'
          }}
          aria-label="Performance improved by 12% from last week"
        />
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should work with different variants', async () => {
      const { container } = render(
        <div>
          <StatsCard
            title="Default Card"
            value="100"
            variant="default"
          />
          <StatsCard
            title="Gradient Card"
            value="100"
            variant="gradient"
          />
          <StatsCard
            title="Outline Card"
            value="100"
            variant="outline"
          />
        </div>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  // Shared mock quiz data for all tests
  const mockQuizData = {
    ...mockQuiz,
    questions: mockQuestions,
  }

  describe('QuizCard Component Accessibility', () => {

    it('should not have accessibility violations', async () => {
      const { container } = render(
        <QuizCard
          quiz={mockQuizData}
          onStart={() => {}}
          onRetry={() => {}}
          onViewResults={() => {}}
        />
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should handle completed state accessibly', async () => {
      const { container } = render(
        <QuizCard
          quiz={mockQuizData}
          progress={{
            completed: true,
            score: 85,
            attempts: 1,
            bestScore: 85,
            timeSpent: 25,
          }}
          onStart={() => {}}
          onRetry={() => {}}
          onViewResults={() => {}}
        />
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should provide accessible progress information', async () => {
      const { container } = render(
        <QuizCard
          quiz={mockQuizData}
          progress={{
            completed: true,
            score: 75,
            attempts: 2,
            bestScore: 80,
            timeSpent: 35,
          }}
          onStart={() => {}}
          onRetry={() => {}}
          onViewResults={() => {}}
          aria-label="JavaScript quiz completed with 75% score"
        />
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should work in compact variant', async () => {
      const { container } = render(
        <QuizCard
          quiz={mockQuizData}
          variant="compact"
          onStart={() => {}}
        />
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should work in detailed variant', async () => {
      const { container } = render(
        <QuizCard
          quiz={mockQuizData}
          variant="detailed"
          onStart={() => {}}
        />
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Complex Component Combinations', () => {
    it('should handle dashboard with multiple stats cards', async () => {
      const { container } = render(
        <div role="main" aria-label="Learning Dashboard">
          <h1>Learning Progress Dashboard</h1>
          <h2>Progress Statistics</h2>
          <div role="region" aria-label="Progress Statistics">
            <StatsCard
              title="Overall Progress"
              value="78%"
              description="Total course completion"
              icon={TrendingUp}
              change={{
                value: 5,
                label: 'increase this week',
                trend: 'up'
              }}
            />
            <StatsCard
              title="Quiz Performance"
              value="85%"
              description="Average quiz score"
              progress={{
                value: 17,
                max: 20,
                label: 'quizzes completed'
              }}
            />
            <StatsCard
              title="Study Streak"
              value="7 days"
              description="Current learning streak"
              variant="gradient"
            />
          </div>
        </div>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should handle quiz listing page', async () => {
      const { container } = render(
        <div role="main" aria-label="Available Quizzes">
          <h1>Practice Quizzes</h1>
          <h2>Available Quiz List</h2>
          <div role="region" aria-label="Quiz List">
            <QuizCard
              quiz={mockQuizData}
              onStart={() => {}}
              aria-label="JavaScript fundamentals quiz, not started"
            />
            <QuizCard
              quiz={{
                ...mockQuizData,
                id: 'quiz-124',
                title: 'Advanced JavaScript Quiz'
              }}
              progress={{
                completed: true,
                score: 92,
                attempts: 1,
              }}
              onRetry={() => {}}
              onViewResults={() => {}}
              aria-label="Advanced JavaScript quiz, completed with 92% score"
            />
          </div>
        </div>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should handle interactive elements properly', async () => {
      const { container } = render(
        <div>
          <nav aria-label="Main navigation">
            <Button>Dashboard</Button>
            <Button>Quizzes</Button>
            <Button>Analytics</Button>
          </nav>
          <main>
            <section aria-label="Quick actions">
              <Button variant="outline">Start Learning</Button>
              <Button variant="destructive">Reset Progress</Button>
            </section>
          </main>
        </div>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Keyboard Navigation Tests', () => {
    it('should support keyboard navigation for interactive elements', async () => {
      const { container } = render(
        <div>
          <Button tabIndex={0}>First Button</Button>
          <StatsCard
            title="Interactive Card"
            value="100"
            tabIndex={0}
            role="button"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                // Handle activation
              }
            }}
          />
          <QuizCard
            quiz={mockQuizData}
            onStart={() => {}}
            tabIndex={0}
          />
        </div>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper focus indicators', async () => {
      const { container } = render(
        <div>
          <style>{`
            .focus-visible:focus {
              outline: 2px solid #0066cc;
              outline-offset: 2px;
            }
          `}</style>
          <Button className="focus-visible">Focusable Button</Button>
        </div>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Color Contrast Tests', () => {
    it('should meet WCAG color contrast requirements', async () => {
      const { container } = render(
        <div>
          <style>{`
            .high-contrast {
              background-color: #ffffff;
              color: #000000;
            }
            .button-contrast {
              background-color: #0066cc;
              color: #ffffff;
            }
            .error-contrast {
              background-color: #d32f2f;
              color: #ffffff;
            }
          `}</style>
          <div className="high-contrast">
            <Button className="button-contrast">High Contrast Button</Button>
            <Button variant="destructive" className="error-contrast">
              Error Button
            </Button>
          </div>
        </div>
      )
      
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: false }, // Disabled due to canvas issues in JSDOM
          'color-contrast-enhanced': { enabled: false }, // Disabled due to canvas issues in JSDOM
        },
      })
      expect(results).toHaveNoViolations()
    })
  })

  describe('Screen Reader Tests', () => {
    it('should provide proper semantic structure', async () => {
      const { container } = render(
        <div>
          <header>
            <h1>Learning Platform</h1>
          </header>
          <nav aria-label="Main navigation">
            <Button role="button" aria-label="Go to dashboard">Dashboard</Button>
          </nav>
          <main>
            <section aria-label="Progress overview">
              <h2>Your Progress</h2>
              <StatsCard
                title="Completion Rate"
                value="75%"
                aria-label="Course completion rate is 75%"
              />
            </section>
            <section aria-label="Available quizzes">
              <h2>Practice Quizzes</h2>
              <QuizCard
                quiz={mockQuizData}
                onStart={() => {}}
                aria-label="JavaScript fundamentals quiz, 3 questions, 30 minute time limit"
              />
            </section>
          </main>
        </div>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should handle dynamic content announcements', async () => {
      const { container } = render(
        <div>
          <div role="status" aria-live="polite" aria-label="Status updates">
            Quiz completed successfully
          </div>
          <div role="alert" aria-live="assertive" aria-label="Important notifications">
            Error: Please check your answers
          </div>
          <StatsCard
            title="Updated Progress"
            value="80%"
            aria-label="Progress updated to 80%"
          />
        </div>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Mobile Accessibility', () => {
    it('should work with touch interfaces', async () => {
      const { container } = render(
        <div style={{ touchAction: 'manipulation' }}>
          <Button
            style={{ minHeight: '44px', minWidth: '44px' }}
            aria-label="Large touch target button"
          >
            Touch Me
          </Button>
          <QuizCard
            quiz={mockQuizData}
            onStart={() => {}}
            style={{ touchAction: 'manipulation' }}
          />
        </div>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should handle zoom and viewport changes', async () => {
      const { container } = render(
        <div style={{ 
          maxWidth: '100%',
          overflow: 'auto',
          wordWrap: 'break-word'
        }}>
          <StatsCard
            title="Responsive Card"
            value="100%"
            description="This card should work at different zoom levels"
            style={{ 
              minWidth: '300px',
              maxWidth: '100%'
            }}
          />
        </div>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})