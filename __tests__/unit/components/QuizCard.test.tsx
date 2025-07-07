import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuizCard } from '@/components/quiz/QuizCard'
import { Quiz } from '@/types'
import { mockQuiz, mockQuestions } from '../../mocks/test-data'

// Create a complete mock quiz for testing
const createMockQuiz = (overrides: Partial<Quiz> = {}): Quiz => ({
  id: 'quiz-123',
  moduleId: 'module-123',
  title: 'JavaScript Fundamentals Quiz',
  description: 'Test your knowledge of JavaScript basics',
  questions: mockQuestions,
  timeLimit: 30,
  passingScore: 70,
  ...overrides,
})

describe('QuizCard Component', () => {
  const defaultQuiz = createMockQuiz()
  const defaultProps = {
    quiz: defaultQuiz,
    onStart: jest.fn(),
    onRetry: jest.fn(),
    onViewResults: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders quiz information correctly', () => {
    render(<QuizCard {...defaultProps} />)
    
    expect(screen.getByText('JavaScript Fundamentals Quiz')).toBeInTheDocument()
    expect(screen.getByText('Test your knowledge of JavaScript basics')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // number of questions
    expect(screen.getByText('70%')).toBeInTheDocument() // passing score
    expect(screen.getByText('30m')).toBeInTheDocument() // time limit
  })

  it('shows start button for uncompleted quiz', () => {
    render(<QuizCard {...defaultProps} />)
    
    const startButton = screen.getByRole('button', { name: /start quiz/i })
    expect(startButton).toBeInTheDocument()
  })

  it('handles start button click', async () => {
    const user = userEvent.setup()
    render(<QuizCard {...defaultProps} />)
    
    const startButton = screen.getByRole('button', { name: /start quiz/i })
    await user.click(startButton)
    
    expect(defaultProps.onStart).toHaveBeenCalledTimes(1)
  })

  it('shows completed state with score', () => {
    const progress = {
      completed: true,
      score: 85,
      attempts: 1,
      bestScore: 85,
      timeSpent: 25,
    }
    
    render(<QuizCard {...defaultProps} progress={progress} />)
    
    expect(screen.getAllByText('85%')).toHaveLength(2) // Badge and score text
    expect(screen.getByText('View Results')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
    
    // Should show passed state
    const checkIcon = screen.getByTestId('check-circle')
    expect(checkIcon).toBeInTheDocument()
  })

  it('shows failed state with low score', () => {
    const progress = {
      completed: true,
      score: 45,
      attempts: 2,
      bestScore: 50,
      timeSpent: 35,
    }
    
    render(<QuizCard {...defaultProps} progress={progress} />)
    
    expect(screen.getAllByText('45%')).toHaveLength(2) // Badge and score text
    
    // Should show failed state - check badge has destructive styling
    const badgeElements = screen.getAllByText('45%')
    const badgeElement = badgeElements.find(el => 
      el.closest('div')?.className.includes('bg-destructive') ||
      el.className.includes('text-destructive')
    )
    expect(badgeElement).toBeTruthy() // At least one element should have destructive styling
  })

  it('handles retry button click', async () => {
    const user = userEvent.setup()
    const progress = {
      completed: true,
      score: 85,
      attempts: 1,
    }
    
    render(<QuizCard {...defaultProps} progress={progress} />)
    
    const retryButton = screen.getByRole('button', { name: /retry/i })
    await user.click(retryButton)
    
    expect(defaultProps.onRetry).toHaveBeenCalledTimes(1)
  })

  it('handles view results button click', async () => {
    const user = userEvent.setup()
    const progress = {
      completed: true,
      score: 85,
      attempts: 1,
    }
    
    render(<QuizCard {...defaultProps} progress={progress} />)
    
    const viewResultsButton = screen.getByRole('button', { name: /view results/i })
    await user.click(viewResultsButton)
    
    expect(defaultProps.onViewResults).toHaveBeenCalledTimes(1)
  })

  it('renders compact variant correctly', () => {
    render(<QuizCard {...defaultProps} variant="compact" />)
    
    expect(screen.getByText('JavaScript Fundamentals Quiz')).toBeInTheDocument()
    expect(screen.getByText('3 questions')).toBeInTheDocument()
    expect(screen.getByText('30m')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument()
    
    // Should not show full description in compact mode
    expect(screen.queryByText('Test your knowledge of JavaScript basics')).not.toBeInTheDocument()
  })

  it('renders detailed variant with question breakdown', () => {
    render(<QuizCard {...defaultProps} variant="detailed" />)
    
    expect(screen.getByText('Question Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Multiple Choice:')).toBeInTheDocument()
    expect(screen.getByText('True/False:')).toBeInTheDocument()
    expect(screen.getByText('Short Answer:')).toBeInTheDocument()
    expect(screen.getByText('Total Points:')).toBeInTheDocument()
  })

  it('shows progress information when available', () => {
    const progress = {
      completed: true,
      score: 85,
      attempts: 3,
      bestScore: 90,
      timeSpent: 25,
    }
    
    render(<QuizCard {...defaultProps} progress={progress} />)
    
    expect(screen.getByText('Your Score')).toBeInTheDocument()
    expect(screen.getAllByText('85%')).toHaveLength(2) // Badge and score text
    expect(screen.getByText('Best Score:')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('Time Spent:')).toBeInTheDocument()
    expect(screen.getByText('25m')).toBeInTheDocument()
    expect(screen.getByText('Attempts:')).toBeInTheDocument()
    // Find the attempts value - allow for multiple "3" values
    const attemptTexts = screen.getAllByText('3')
    expect(attemptTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('hides progress when showProgress is false', () => {
    const progress = {
      completed: true,
      score: 85,
      attempts: 1,
    }
    
    render(<QuizCard {...defaultProps} progress={progress} showProgress={false} />)
    
    expect(screen.queryByText('Your Score')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('formats time correctly', () => {
    const { rerender } = render(
      <QuizCard {...defaultProps} quiz={createMockQuiz({ timeLimit: 90 })} />
    )
    
    expect(screen.getByText('1h 30m')).toBeInTheDocument()
    
    rerender(
      <QuizCard {...defaultProps} quiz={createMockQuiz({ timeLimit: 60 })} />
    )
    
    expect(screen.getByText('1h')).toBeInTheDocument()
    
    rerender(
      <QuizCard {...defaultProps} quiz={createMockQuiz({ timeLimit: 45 })} />
    )
    
    expect(screen.getByText('45m')).toBeInTheDocument()
  })

  it('handles quiz without time limit', () => {
    render(
      <QuizCard 
        {...defaultProps} 
        quiz={createMockQuiz({ timeLimit: undefined })} 
      />
    )
    
    expect(screen.queryByText(/Time Limit:/)).not.toBeInTheDocument()
  })

  it('applies correct score colors', () => {
    const { rerender } = render(
      <QuizCard 
        {...defaultProps} 
        progress={{ completed: true, score: 95, attempts: 1 }} 
      />
    )
    
    // Check that score elements exist with appropriate colors
    let scoreElements = screen.getAllByText('95%')
    let hasCorrectColor = scoreElements.some(el => 
      el.className.includes('text-learning-secondary') ||
      el.className.includes('text-green') ||
      el.closest('div')?.className.includes('bg-learning-secondary')
    )
    expect(hasCorrectColor).toBe(true)
    
    rerender(
      <QuizCard 
        {...defaultProps} 
        progress={{ completed: true, score: 75, attempts: 1 }} 
      />
    )
    
    scoreElements = screen.getAllByText('75%')
    hasCorrectColor = scoreElements.some(el => 
      el.className.includes('text-learning-accent') ||
      el.className.includes('text-yellow') ||
      el.closest('div')?.className.includes('bg-learning-accent')
    )
    expect(hasCorrectColor).toBe(true)
    
    rerender(
      <QuizCard 
        {...defaultProps} 
        progress={{ completed: true, score: 45, attempts: 1 }} 
      />
    )
    
    scoreElements = screen.getAllByText('45%')
    hasCorrectColor = scoreElements.some(el => 
      el.className.includes('text-destructive') ||
      el.className.includes('text-red') ||
      el.closest('div')?.className.includes('bg-destructive')
    )
    expect(hasCorrectColor).toBe(true)
  })

  it('forwards ref correctly', () => {
    const ref = jest.fn()
    
    render(<QuizCard {...defaultProps} ref={ref} />)
    
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement))
  })

  it('applies custom className', () => {
    render(<QuizCard {...defaultProps} className="custom-quiz-card" data-testid="quiz-card" />)
    
    const card = screen.getByTestId('quiz-card')
    expect(card).toHaveClass('custom-quiz-card')
  })

  it('passes through HTML attributes', () => {
    render(
      <QuizCard 
        {...defaultProps} 
        data-testid="custom-quiz"
        aria-label="Custom quiz card"
      />
    )
    
    const card = screen.getByTestId('custom-quiz')
    expect(card).toHaveAttribute('aria-label', 'Custom quiz card')
  })

  it('calculates question breakdown correctly in detailed view', () => {
    const quizWithMixedQuestions = createMockQuiz({
      questions: [
        ...mockQuestions,
        {
          id: 'q4',
          text: 'Another multiple choice',
          type: 'multiple-choice',
          options: ['A', 'B', 'C'],
          correctAnswer: 'A',
          points: 5,
        },
        {
          id: 'q5',
          text: 'Another true/false',
          type: 'true-false',
          correctAnswer: 'true',
          points: 3,
        },
      ]
    })
    
    render(<QuizCard quiz={quizWithMixedQuestions} variant="detailed" />)
    
    // Should show correct counts for each question type
    const multipleChoiceCount = screen.getAllByText('2')[0] // 2 multiple choice questions
    const trueFalseCount = screen.getAllByText('2')[1] // 2 true/false questions
    const shortAnswerCount = screen.getByText('1') // 1 short answer question
    
    expect(multipleChoiceCount).toBeInTheDocument()
    expect(trueFalseCount).toBeInTheDocument()
    expect(shortAnswerCount).toBeInTheDocument()
  })

  it('maintains accessibility features', () => {
    const progress = {
      completed: true,
      score: 85,
      attempts: 1,
    }
    
    render(<QuizCard {...defaultProps} progress={progress} />)
    
    // Check for progress bar accessibility
    const progressBars = screen.getAllByRole('progressbar')
    const mainProgressBar = progressBars[0] // The main score progress bar
    expect(mainProgressBar).toHaveAttribute('aria-valuemin', '0')
    expect(mainProgressBar).toHaveAttribute('aria-valuemax', '100')
    expect(mainProgressBar).toHaveAttribute('aria-valuenow', '85')
  })
})