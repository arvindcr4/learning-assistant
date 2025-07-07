# 🎓 Learning Assistant

An intelligent, adaptive learning platform that personalizes education based on individual learning styles, behavior patterns, and performance metrics.

## ✨ Features

- **🎯 Personalized Learning**: Adaptive content based on VARK learning styles
- **🧠 AI-Powered Recommendations**: Intelligent content suggestions and study paths
- **📊 Real-time Analytics**: Performance tracking and learning insights
- **💬 Interactive Chat**: AI-powered learning companion
- **🎲 Smart Quizzes**: Adaptive assessments with difficulty calibration
- **🌍 Internationalization**: Multi-language support (EN, ES, FR, DE, JA, AR)
- **♿ Accessibility**: WCAG 2.1 AA compliant
- **📱 Responsive Design**: Works on all devices

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Docker (optional, for databases)
- Git

### Automated Setup

Run the setup script for automatic configuration:

```bash
# Clone the repository
git clone <repository-url>
cd learning-assistant

# Run automated setup
./scripts/dev-setup.sh
```

### Manual Setup

1. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Setup environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start services (Docker)**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

4. **Run migrations**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server
npm run type-check      # TypeScript type checking

# Testing
npm test                # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
npm run test:accessibility # Accessibility tests
npm run test:performance # Performance tests

# Database
npm run db:migrate      # Run database migrations
npm run db:seed         # Seed database with sample data
npm run db:reset        # Reset database
npm run db:status       # Check migration status

# Code Quality
npm run lint            # ESLint
npm run lint:fix        # Fix ESLint issues
npm run format          # Prettier formatting
npm run analyze         # Bundle analysis

# Translations
npm run translations:extract  # Extract translation keys
npm run translations:validate # Validate translations
npm run translations:stats    # Translation statistics
```

### Project Structure

```
learning-assistant/
├── src/
│   ├── app/                 # Next.js App Router
│   ├── components/          # React components
│   │   ├── ui/             # Reusable UI components
│   │   ├── features/       # Feature-specific components
│   │   └── interactive/    # Interactive learning components
│   ├── lib/                # Core libraries and utilities
│   │   ├── database/       # Database configuration and models
│   │   ├── learning-engine/ # AI learning algorithms
│   │   └── auth/           # Authentication logic
│   ├── services/           # External API integrations
│   ├── hooks/              # Custom React hooks
│   ├── contexts/           # React context providers
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── __tests__/              # Test files
├── public/                 # Static assets
├── docs/                   # Documentation
├── scripts/                # Build and deployment scripts
└── config/                 # Configuration files
```

### Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Authentication**: Better Auth
- **Testing**: Jest, Playwright, Testing Library
- **AI**: OpenAI GPT integration
- **Internationalization**: next-intl
- **Deployment**: Docker, Vercel-ready

## 🔧 Configuration

### Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# Authentication
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="http://localhost:3000"

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/learning_assistant"
REDIS_URL="redis://localhost:6379"

# AI Services
OPENAI_API_KEY="your-openai-api-key"

# Email (optional)
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
```

### Docker Services

The development environment includes:

- **PostgreSQL**: Database on port 5432
- **Redis**: Cache on port 6379  
- **Mailhog**: Email testing UI on port 8025
- **Application**: Next.js app on port 3000

## 🧪 Testing

The project includes comprehensive testing:

- **Unit Tests**: Component and function testing
- **Integration Tests**: API and service testing
- **E2E Tests**: Full user journey testing
- **Accessibility Tests**: WCAG compliance testing
- **Performance Tests**: Load and speed testing

Run specific test suites:

```bash
npm run test:unit           # Fast unit tests
npm run test:integration    # API testing
npm run test:e2e           # Full browser testing
npm run test:accessibility # a11y compliance
npm run test:performance   # Performance benchmarks
```

## 📊 Features Deep Dive

### Learning Style Detection (VARK)

- Visual, Auditory, Reading/Writing, Kinesthetic assessment
- Behavioral pattern analysis
- Real-time adaptation based on user interaction

### Adaptive Learning Engine

- Content difficulty calibration
- Personalized study paths
- Performance-based recommendations
- Spaced repetition algorithms

### Analytics Dashboard

- Learning progress tracking
- Performance metrics
- Time spent analytics
- Goal achievement monitoring

### Interactive Components

- Drag-and-drop activities
- Video players with note-taking
- Interactive quizzes with feedback
- Real-time collaboration tools

## 🚢 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main

### Docker

```bash
# Build production image
docker build -t learning-assistant .

# Run with docker-compose
docker-compose up -d
```

### Self-hosted

```bash
npm run build
npm run start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Maintain test coverage above 80%
- Use semantic commit messages
- Ensure accessibility compliance
- Add translations for new text

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-repo/learning-assistant/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/learning-assistant/discussions)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing framework
- [Tailwind CSS](https://tailwindcss.com/) for utility-first styling
- [Radix UI](https://www.radix-ui.com/) for accessible components
- [OpenAI](https://openai.com/) for AI capabilities

---

Built with ❤️ for learners everywhere.