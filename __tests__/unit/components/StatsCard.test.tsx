import { render, screen } from '@testing-library/react'
import { TrendingUp, Trophy } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/StatsCard'

describe('StatsCard Component', () => {
  it('renders basic stats card correctly', () => {
    render(
      <StatsCard
        title="Total Progress"
        value="75%"
        description="Overall learning progress"
      />
    )
    
    expect(screen.getByText('Total Progress')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('Overall learning progress')).toBeInTheDocument()
  })

  it('displays icon when provided', () => {
    render(
      <StatsCard
        title="Achievements"
        value="12"
        icon={Trophy}
        data-testid="stats-card"
      />
    )
    
    const card = screen.getByTestId('stats-card')
    expect(card.querySelector('svg')).toBeInTheDocument()
  })

  it('shows change indicator with correct styling', () => {
    render(
      <StatsCard
        title="Performance"
        value="85%"
        change={{
          value: 12,
          label: 'vs last week',
          trend: 'up'
        }}
      />
    )
    
    expect(screen.getByText('+12')).toBeInTheDocument()
    expect(screen.getByText('vs last week')).toBeInTheDocument()
    
    const changeElement = screen.getByText('+12').closest('div')
    expect(changeElement).toHaveClass('text-learning-secondary')
  })

  it('handles different trend types', () => {
    const { rerender } = render(
      <StatsCard
        title="Test"
        value="100"
        change={{ value: -5, label: 'down', trend: 'down' }}
      />
    )
    
    expect(screen.getByText('-5')).toBeInTheDocument()
    let changeElement = screen.getByText('-5').closest('div')
    expect(changeElement).toHaveClass('text-destructive')
    
    rerender(
      <StatsCard
        title="Test"
        value="100"
        change={{ value: 0, label: 'neutral', trend: 'neutral' }}
      />
    )
    
    expect(screen.getByText('0')).toBeInTheDocument()
    changeElement = screen.getByText('0').closest('div')
    expect(changeElement).toHaveClass('text-muted-foreground')
  })

  it('displays progress bar correctly', () => {
    render(
      <StatsCard
        title="Course Progress"
        value="8/10"
        progress={{
          value: 8,
          max: 10,
          label: 'modules completed'
        }}
      />
    )
    
    expect(screen.getByText('8 / 10')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows badge when provided', () => {
    render(
      <StatsCard
        title="Learning Style"
        value="Visual"
        badge={{
          text: 'Primary',
          variant: 'visual'
        }}
      />
    )
    
    expect(screen.getByText('Primary')).toBeInTheDocument()
  })

  it('applies different variants correctly', () => {
    const { rerender } = render(
      <StatsCard
        title="Test"
        value="100"
        variant="gradient"
        data-testid="stats-card"
      />
    )
    
    let card = screen.getByTestId('stats-card')
    expect(card).toHaveClass('bg-gradient-to-r')
    
    rerender(
      <StatsCard
        title="Test"
        value="100"
        variant="outline"
        data-testid="stats-card"
      />
    )
    
    card = screen.getByTestId('stats-card')
    expect(card).toHaveClass('border-2')
  })

  it('applies different sizes correctly', () => {
    const { rerender } = render(
      <StatsCard
        title="Test"
        value="100"
        size="sm"
        data-testid="stats-card"
      />
    )
    
    let content = screen.getByTestId('stats-card').querySelector('.space-y-1')
    expect(content).toHaveClass('p-3')
    
    rerender(
      <StatsCard
        title="Test"
        value="100"
        size="lg"
        data-testid="stats-card"
      />
    )
    
    content = screen.getByTestId('stats-card').querySelector('.space-y-3')
    expect(content).toHaveClass('p-6')
  })

  it('handles gradient variant text colors', () => {
    render(
      <StatsCard
        title="Gradient Card"
        value="100"
        description="Test description"
        variant="gradient"
        badge={{ text: 'Badge', variant: 'default' }}
        change={{ value: 5, label: 'up', trend: 'up' }}
      />
    )
    
    const title = screen.getByText('Gradient Card')
    const value = screen.getByText('100')
    const description = screen.getByText('Test description')
    
    // These should have white text colors for gradient variant
    expect(title.closest('h3')).toHaveClass('text-white/80')
    expect(value.closest('p')).toHaveClass('text-white')
    expect(description.closest('p')).toHaveClass('text-white/70')
  })

  it('forwards ref correctly', () => {
    const ref = jest.fn()
    
    render(
      <StatsCard
        ref={ref}
        title="Test"
        value="100"
      />
    )
    
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement))
  })

  it('applies custom className', () => {
    render(
      <StatsCard
        title="Test"
        value="100"
        className="custom-class"
        data-testid="stats-card"
      />
    )
    
    const card = screen.getByTestId('stats-card')
    expect(card).toHaveClass('custom-class')
  })

  it('passes through HTML attributes', () => {
    render(
      <StatsCard
        title="Test"
        value="100"
        data-testid="custom-stats"
        aria-label="Custom stats card"
      />
    )
    
    const card = screen.getByTestId('custom-stats')
    expect(card).toHaveAttribute('aria-label', 'Custom stats card')
  })

  it('handles complex content correctly', () => {
    render(
      <StatsCard
        title="Complex Stats"
        value="85.5%"
        description="Detailed progress metrics"
        icon={TrendingUp}
        change={{
          value: 15.3,
          label: 'from last month',
          trend: 'up'
        }}
        progress={{
          value: 17,
          max: 20,
          label: 'lessons completed'
        }}
        badge={{
          text: 'Excellent',
          variant: 'success'
        }}
        variant="outline"
        size="lg"
      />
    )
    
    expect(screen.getByText('Complex Stats')).toBeInTheDocument()
    expect(screen.getByText('85.5%')).toBeInTheDocument()
    expect(screen.getByText('Detailed progress metrics')).toBeInTheDocument()
    expect(screen.getByText('+15.3')).toBeInTheDocument()
    expect(screen.getByText('from last month')).toBeInTheDocument()
    expect(screen.getByText('17 / 20')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText('Excellent')).toBeInTheDocument()
  })

  it('maintains accessibility features', () => {
    render(
      <StatsCard
        title="Accessible Card"
        value="100"
        progress={{
          value: 50,
          max: 100,
          label: 'progress'
        }}
      />
    )
    
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuemin', '0')
    expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    expect(progressBar).toHaveAttribute('aria-valuenow', '50')
  })
})