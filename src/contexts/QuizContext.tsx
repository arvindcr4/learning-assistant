'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { QuizState, QuizAction, Quiz, AdaptiveAssessment, AdaptiveQuestion, QuizResults } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';

// Initial state
const initialState: QuizState = {
  currentQuiz: null,
  activeAssessment: null,
  currentQuestion: null,
  answers: {},
  score: 0,
  timeRemaining: 0,
  isSubmitting: false,
  results: null,
  error: null,
};

// Reducer function
function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'START_QUIZ':
      return {
        ...state,
        currentQuiz: action.payload,
        answers: {},
        score: 0,
        timeRemaining: action.payload.timeLimit ? action.payload.timeLimit * 60 : 0,
        results: null,
        error: null,
      };

    case 'START_ASSESSMENT':
      return {
        ...state,
        activeAssessment: action.payload,
        answers: {},
        score: 0,
        timeRemaining: 0,
        results: null,
        error: null,
      };

    case 'SET_CURRENT_QUESTION':
      return {
        ...state,
        currentQuestion: action.payload,
      };

    case 'SET_ANSWER':
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.payload.questionId]: action.payload.answer,
        },
      };

    case 'UPDATE_SCORE':
      return {
        ...state,
        score: action.payload,
      };

    case 'UPDATE_TIME':
      return {
        ...state,
        timeRemaining: Math.max(0, action.payload),
      };

    case 'SET_SUBMITTING':
      return {
        ...state,
        isSubmitting: action.payload,
      };

    case 'SET_RESULTS':
      return {
        ...state,
        results: action.payload,
        isSubmitting: false,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isSubmitting: false,
      };

    case 'RESET_QUIZ':
      return {
        ...initialState,
      };

    default:
      return state;
  }
}

// Context type
interface QuizContextType {
  state: QuizState;
  dispatch: React.Dispatch<QuizAction>;
  startQuiz: (quiz: Quiz) => void;
  startAssessment: (assessment: AdaptiveAssessment) => void;
  setCurrentQuestion: (question: AdaptiveQuestion | null) => void;
  setAnswer: (questionId: string, answer: any) => void;
  submitAnswer: (questionId: string, answer: any) => Promise<void>;
  submitQuiz: () => Promise<void>;
  resetQuiz: () => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  getQuestionByIndex: (index: number) => AdaptiveQuestion | null;
  getCurrentQuestionIndex: () => number;
  getTotalQuestions: () => number;
  getProgress: () => number;
  isLastQuestion: () => boolean;
  canSubmit: () => boolean;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

// Mock API functions (replace with actual API calls)
const mockSubmitAnswer = async (questionId: string, answer: any): Promise<{ correct: boolean; score: number; feedback?: string }> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Mock scoring logic
  const correct = Math.random() > 0.3; // 70% chance of correct answer
  const score = correct ? 10 : 0;
  
  return {
    correct,
    score,
    feedback: correct ? 'Correct!' : 'Incorrect. Try again.',
  };
};

const mockSubmitQuiz = async (quiz: Quiz, answers: Record<string, any>): Promise<QuizResults> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const totalQuestions = quiz.questions.length;
  const correctAnswers = Math.floor(totalQuestions * 0.7); // Mock 70% correct
  const score = correctAnswers * 10;
  const percentage = (correctAnswers / totalQuestions) * 100;
  
  return {
    totalQuestions,
    correctAnswers,
    score,
    percentage,
    timeSpent: 15, // Mock time spent
    feedback: percentage >= quiz.passingScore ? 'Great job! You passed the quiz.' : 'Keep studying and try again.',
    recommendations: ['Review JavaScript fundamentals', 'Practice more coding exercises'],
    passedThreshold: percentage >= quiz.passingScore,
  };
};

const mockSubmitAssessment = async (assessment: AdaptiveAssessment, answers: Record<string, any>): Promise<QuizResults> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const totalQuestions = assessment.questions.length;
  const correctAnswers = Math.floor(totalQuestions * 0.75); // Mock 75% correct
  const score = correctAnswers * 10;
  const percentage = (correctAnswers / totalQuestions) * 100;
  
  return {
    totalQuestions,
    correctAnswers,
    score,
    percentage,
    timeSpent: 20, // Mock time spent
    feedback: 'Assessment completed successfully.',
    recommendations: ['Focus on weak areas', 'Continue with adaptive learning'],
    passedThreshold: percentage >= assessment.scoringRubric.passingScore,
  };
};

// Provider component
export function QuizProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const [persistedQuiz, setPersistedQuiz] = useLocalStorage('quiz', {
    answers: {},
    currentQuestionIndex: 0,
  });

  // Timer effect for countdown
  useEffect(() => {
    if (state.timeRemaining > 0) {
      const interval = setInterval(() => {
        dispatch({ type: 'UPDATE_TIME', payload: state.timeRemaining - 1 });
      }, 1000);

      return () => clearInterval(interval);
    } else if (state.timeRemaining === 0 && state.currentQuiz) {
      // Time's up - auto submit
      submitQuiz();
    }
  }, [state.timeRemaining, state.currentQuiz]);

  // Persist quiz state changes
  useEffect(() => {
    if (state.currentQuiz || state.activeAssessment) {
      setPersistedQuiz({
        answers: state.answers,
        currentQuestionIndex: getCurrentQuestionIndex(),
      });
    }
  }, [state.answers, state.currentQuestion]);

  const startQuiz = useCallback((quiz: Quiz) => {
    dispatch({ type: 'START_QUIZ', payload: quiz });
    if (quiz.questions.length > 0) {
      dispatch({ type: 'SET_CURRENT_QUESTION', payload: quiz.questions[0] });
    }
  }, []);

  const startAssessment = useCallback((assessment: AdaptiveAssessment) => {
    dispatch({ type: 'START_ASSESSMENT', payload: assessment });
    if (assessment.questions.length > 0) {
      dispatch({ type: 'SET_CURRENT_QUESTION', payload: assessment.questions[0] });
    }
  }, []);

  const setCurrentQuestion = useCallback((question: AdaptiveQuestion | null) => {
    dispatch({ type: 'SET_CURRENT_QUESTION', payload: question });
  }, []);

  const setAnswer = useCallback((questionId: string, answer: any) => {
    dispatch({ type: 'SET_ANSWER', payload: { questionId, answer } });
  }, []);

  const submitAnswer = useCallback(async (questionId: string, answer: any) => {
    try {
      const result = await mockSubmitAnswer(questionId, answer);
      dispatch({ type: 'SET_ANSWER', payload: { questionId, answer } });
      dispatch({ type: 'UPDATE_SCORE', payload: state.score + result.score });
      
      // Auto-advance to next question in adaptive assessment
      if (state.activeAssessment) {
        nextQuestion();
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to submit answer' });
    }
  }, [state.score, state.activeAssessment]);

  const submitQuiz = useCallback(async () => {
    if (!state.currentQuiz && !state.activeAssessment) return;

    dispatch({ type: 'SET_SUBMITTING', payload: true });
    try {
      let results: QuizResults;
      
      if (state.currentQuiz) {
        results = await mockSubmitQuiz(state.currentQuiz, state.answers);
      } else if (state.activeAssessment) {
        results = await mockSubmitAssessment(state.activeAssessment, state.answers);
      } else {
        throw new Error('No active quiz or assessment');
      }
      
      dispatch({ type: 'SET_RESULTS', payload: results });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to submit quiz' });
    }
  }, [state.currentQuiz, state.activeAssessment, state.answers]);

  const resetQuiz = useCallback(() => {
    dispatch({ type: 'RESET_QUIZ' });
    setPersistedQuiz({ answers: {}, currentQuestionIndex: 0 });
  }, [setPersistedQuiz]);

  const getQuestions = useCallback(() => {
    if (state.currentQuiz) return state.currentQuiz.questions;
    if (state.activeAssessment) return state.activeAssessment.questions;
    return [];
  }, [state.currentQuiz, state.activeAssessment]);

  const getCurrentQuestionIndex = useCallback(() => {
    const questions = getQuestions();
    if (!state.currentQuestion) return 0;
    return questions.findIndex(q => q.id === state.currentQuestion!.id);
  }, [state.currentQuestion, getQuestions]);

  const nextQuestion = useCallback(() => {
    const questions = getQuestions();
    const currentIndex = getCurrentQuestionIndex();
    if (currentIndex < questions.length - 1) {
      dispatch({ type: 'SET_CURRENT_QUESTION', payload: questions[currentIndex + 1] });
    }
  }, [getQuestions, getCurrentQuestionIndex]);

  const previousQuestion = useCallback(() => {
    const questions = getQuestions();
    const currentIndex = getCurrentQuestionIndex();
    if (currentIndex > 0) {
      dispatch({ type: 'SET_CURRENT_QUESTION', payload: questions[currentIndex - 1] });
    }
  }, [getQuestions, getCurrentQuestionIndex]);

  const getQuestionByIndex = useCallback((index: number) => {
    const questions = getQuestions();
    return questions[index] || null;
  }, [getQuestions]);

  const getTotalQuestions = useCallback(() => {
    return getQuestions().length;
  }, [getQuestions]);

  const getProgress = useCallback(() => {
    const total = getTotalQuestions();
    const answered = Object.keys(state.answers).length;
    return total > 0 ? (answered / total) * 100 : 0;
  }, [getTotalQuestions, state.answers]);

  const isLastQuestion = useCallback(() => {
    const currentIndex = getCurrentQuestionIndex();
    const total = getTotalQuestions();
    return currentIndex === total - 1;
  }, [getCurrentQuestionIndex, getTotalQuestions]);

  const canSubmit = useCallback(() => {
    const total = getTotalQuestions();
    const answered = Object.keys(state.answers).length;
    return answered === total && !state.isSubmitting;
  }, [getTotalQuestions, state.answers, state.isSubmitting]);

  const value: QuizContextType = {
    state,
    dispatch,
    startQuiz,
    startAssessment,
    setCurrentQuestion,
    setAnswer,
    submitAnswer,
    submitQuiz,
    resetQuiz,
    nextQuestion,
    previousQuestion,
    getQuestionByIndex,
    getCurrentQuestionIndex,
    getTotalQuestions,
    getProgress,
    isLastQuestion,
    canSubmit,
  };

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

// Hook to use the quiz context
export function useQuiz() {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error('useQuiz must be used within a QuizProvider');
  }
  return context;
}