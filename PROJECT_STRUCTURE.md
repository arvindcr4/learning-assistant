# Personal Learning Assistant - Project Structure

## Overview
This is a Next.js 14+ application with TypeScript and Tailwind CSS for building a Personal Learning Assistant.

## Directory Structure

```
learning-assistant/
├── app/                          # Next.js 14+ App Router
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── src/
│   ├── components/               # React components
│   │   ├── ui/                   # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   └── Card.tsx
│   │   ├── layout/               # Layout components
│   │   │   └── Layout.tsx
│   │   ├── features/             # Feature-specific components
│   │   │   ├── dashboard/        # Dashboard components
│   │   │   ├── learning/         # Learning path components
│   │   │   ├── quiz/             # Quiz components
│   │   │   ├── progress/         # Progress tracking components
│   │   │   └── chat/             # Chat/AI assistant components
│   │   └── index.ts              # Component exports
│   ├── lib/                      # Library configurations
│   │   └── config.ts             # App configuration
│   ├── types/                    # TypeScript type definitions
│   │   └── index.ts              # Core types
│   ├── utils/                    # Utility functions
│   │   └── index.ts              # Common utilities
│   ├── hooks/                    # Custom React hooks
│   │   └── useLocalStorage.ts    # Local storage hook
│   ├── contexts/                 # React contexts
│   │   └── AppContext.tsx        # Main app context
│   ├── stores/                   # State management (empty for now)
│   ├── services/                 # API and external services
│   │   └── api.ts                # API service
│   ├── constants/                # Application constants
│   │   └── index.ts              # App constants
│   └── styles/                   # Additional styles (empty for now)
├── public/                       # Static assets
├── .env.local.example            # Environment variables example
├── next.config.ts                # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.ts            # Tailwind CSS configuration
└── package.json                  # Project dependencies
```

## Key Features Planned

### Core Features
- **Learning Paths**: Structured learning modules with progress tracking
- **Interactive Quizzes**: Assessments with various question types
- **Progress Dashboard**: Visual tracking of learning progress
- **AI Chat Assistant**: Personalized learning support
- **User Profiles**: Customizable learning preferences

### Technical Features
- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Utility-first styling
- **React Context**: Global state management
- **Local Storage**: Client-side data persistence
- **API Service**: Centralized API communication
- **Responsive Design**: Mobile-first approach

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.local.example .env.local
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Development Guidelines

### Component Organization
- **UI Components**: Reusable, generic components in `src/components/ui/`
- **Feature Components**: Specific to business logic in `src/components/features/`
- **Layout Components**: Page structure components in `src/components/layout/`

### State Management
- Use React Context for global state
- Use local state for component-specific data
- Consider adding Redux Toolkit for complex state management

### Styling
- Use Tailwind CSS utility classes
- Follow mobile-first responsive design
- Consistent color scheme and typography

### Type Safety
- Define interfaces for all data structures
- Use strict TypeScript configuration
- Export types from centralized location

## Next Steps

1. Add database integration (PostgreSQL recommended)
2. Implement authentication system
3. Add AI/ML integration for personalized recommendations
4. Implement real-time features
5. Add comprehensive testing setup
6. Set up CI/CD pipeline