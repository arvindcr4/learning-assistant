/**
 * Optimized Test Data Factory
 * Provides efficient test data generation and cleanup
 */

import { faker } from '@faker-js/faker';

// Cache for reusable test data
const dataCache = new Map<string, any>();

// Cleanup registry for tracking created data
const cleanupRegistry = new Set<() => void>();

// Performance tracking
const performanceMetrics = {
  dataGenerationTime: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cleanupTime: 0,
};

export interface TestUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user' | 'moderator';
  isActive: boolean;
  createdAt: Date;
  profile: {
    firstName: string;
    lastName: string;
    bio: string;
    preferences: {
      theme: 'light' | 'dark';
      language: string;
      notifications: boolean;
    };
  };
}

export interface TestCourse {
  id: string;
  title: string;
  description: string;
  instructor: TestUser;
  students: TestUser[];
  modules: TestModule[];
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in minutes
  isPublished: boolean;
  createdAt: Date;
}

export interface TestModule {
  id: string;
  title: string;
  content: string;
  order: number;
  duration: number;
  quiz?: TestQuiz;
}

export interface TestQuiz {
  id: string;
  title: string;
  questions: TestQuestion[];
  timeLimit?: number;
  passingScore: number;
}

export interface TestQuestion {
  id: string;
  text: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
}

export interface TestLearningSession {
  id: string;
  userId: string;
  courseId: string;
  progress: number; // 0-100
  currentModuleId: string;
  timeSpent: number; // in seconds
  score?: number;
  completedAt?: Date;
  startedAt: Date;
}

export class TestDataFactory {
  private static instance: TestDataFactory;
  private userPool: TestUser[] = [];
  private coursePool: TestCourse[] = [];
  
  static getInstance(): TestDataFactory {
    if (!TestDataFactory.instance) {
      TestDataFactory.instance = new TestDataFactory();
    }
    return TestDataFactory.instance;
  }

  /**
   * Generate optimized test user with caching
   */
  createUser(overrides: Partial<TestUser> = {}, useCache = true): TestUser {
    const cacheKey = `user-${JSON.stringify(overrides)}`;
    
    if (useCache && dataCache.has(cacheKey)) {
      performanceMetrics.cacheHits++;
      return { ...dataCache.get(cacheKey) };
    }

    const startTime = performance.now();
    performanceMetrics.cacheMisses++;

    const user: TestUser = {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      avatar: faker.image.avatar(),
      role: faker.helpers.arrayElement(['admin', 'user', 'moderator']),
      isActive: faker.datatype.boolean(0.8), // 80% chance of being active
      createdAt: faker.date.past({ years: 2 }),
      profile: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        bio: faker.lorem.paragraph(),
        preferences: {
          theme: faker.helpers.arrayElement(['light', 'dark']),
          language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de']),
          notifications: faker.datatype.boolean(0.7),
        },
      },
      ...overrides,
    };

    performanceMetrics.dataGenerationTime += performance.now() - startTime;

    if (useCache) {
      dataCache.set(cacheKey, user);
    }

    // Add to cleanup registry
    this.userPool.push(user);

    return user;
  }

  /**
   * Generate multiple users efficiently
   */
  createUsers(count: number, overrides: Partial<TestUser> = {}): TestUser[] {
    const users: TestUser[] = [];
    
    // Batch generation for better performance
    for (let i = 0; i < count; i++) {
      users.push(this.createUser({
        ...overrides,
        id: overrides.id ? `${overrides.id}-${i}` : undefined,
      }, false)); // Don't cache individual users in batch
    }

    return users;
  }

  /**
   * Create a complete course with modules and quizzes
   */
  createCourse(overrides: Partial<TestCourse> = {}): TestCourse {
    const cacheKey = `course-${JSON.stringify(overrides)}`;
    
    if (dataCache.has(cacheKey)) {
      performanceMetrics.cacheHits++;
      return { ...dataCache.get(cacheKey) };
    }

    const startTime = performance.now();
    performanceMetrics.cacheMisses++;

    const instructor = this.createUser({ role: 'admin' }, false);
    const students = this.createUsers(faker.number.int({ min: 5, max: 20 }));
    const modules = this.createModules(faker.number.int({ min: 3, max: 8 }));

    const course: TestCourse = {
      id: faker.string.uuid(),
      title: faker.lorem.words(3),
      description: faker.lorem.paragraph(),
      instructor,
      students,
      modules,
      tags: faker.helpers.arrayElements([
        'programming', 'design', 'marketing', 'business', 'science', 'math'
      ], { min: 1, max: 4 }),
      difficulty: faker.helpers.arrayElement(['beginner', 'intermediate', 'advanced']),
      duration: modules.reduce((sum, module) => sum + module.duration, 0),
      isPublished: faker.datatype.boolean(0.8),
      createdAt: faker.date.past({ years: 1 }),
      ...overrides,
    };

    performanceMetrics.dataGenerationTime += performance.now() - startTime;
    dataCache.set(cacheKey, course);
    this.coursePool.push(course);

    return course;
  }

  /**
   * Create course modules
   */
  createModules(count: number): TestModule[] {
    const modules: TestModule[] = [];
    
    for (let i = 0; i < count; i++) {
      const hasQuiz = faker.datatype.boolean(0.6); // 60% chance of having a quiz
      
      modules.push({
        id: faker.string.uuid(),
        title: faker.lorem.words(2),
        content: faker.lorem.paragraphs(3),
        order: i + 1,
        duration: faker.number.int({ min: 15, max: 60 }),
        quiz: hasQuiz ? this.createQuiz() : undefined,
      });
    }

    return modules;
  }

  /**
   * Create a quiz with questions
   */
  createQuiz(overrides: Partial<TestQuiz> = {}): TestQuiz {
    const questionCount = faker.number.int({ min: 5, max: 15 });
    const questions = this.createQuestions(questionCount);

    return {
      id: faker.string.uuid(),
      title: faker.lorem.words(3),
      questions,
      timeLimit: faker.number.int({ min: 300, max: 3600 }), // 5-60 minutes
      passingScore: faker.number.int({ min: 60, max: 80 }),
      ...overrides,
    };
  }

  /**
   * Create quiz questions
   */
  createQuestions(count: number): TestQuestion[] {
    const questions: TestQuestion[] = [];
    
    for (let i = 0; i < count; i++) {
      const type = faker.helpers.arrayElement(['multiple-choice', 'true-false', 'short-answer']);
      
      let options: string[] | undefined;
      let correctAnswer: string | string[];

      switch (type) {
        case 'multiple-choice':
          options = [
            faker.lorem.sentence(),
            faker.lorem.sentence(),
            faker.lorem.sentence(),
            faker.lorem.sentence(),
          ];
          correctAnswer = options[0]; // First option is correct
          break;
        case 'true-false':
          options = ['True', 'False'];
          correctAnswer = faker.helpers.arrayElement(options);
          break;
        case 'short-answer':
          correctAnswer = faker.lorem.words(3);
          break;
      }

      questions.push({
        id: faker.string.uuid(),
        text: faker.lorem.sentence() + '?',
        type,
        options,
        correctAnswer: correctAnswer!,
        explanation: faker.lorem.sentence(),
        points: faker.number.int({ min: 1, max: 5 }),
      });
    }

    return questions;
  }

  /**
   * Create learning session data
   */
  createLearningSession(overrides: Partial<TestLearningSession> = {}): TestLearningSession {
    const user = overrides.userId ? { id: overrides.userId } : this.createUser({}, false);
    const course = overrides.courseId ? { id: overrides.courseId } : this.createCourse();
    
    const startedAt = faker.date.past({ years: 1 });
    const progress = faker.number.int({ min: 0, max: 100 });
    const isCompleted = progress === 100;

    return {
      id: faker.string.uuid(),
      userId: user.id,
      courseId: course.id,
      progress,
      currentModuleId: course.modules?.[0]?.id || faker.string.uuid(),
      timeSpent: faker.number.int({ min: 300, max: 7200 }), // 5 minutes to 2 hours
      score: isCompleted ? faker.number.int({ min: 60, max: 100 }) : undefined,
      completedAt: isCompleted ? faker.date.between({ from: startedAt, to: new Date() }) : undefined,
      startedAt,
      ...overrides,
    };
  }

  /**
   * Create realistic test scenarios
   */
  createLearningScenario(): {
    instructor: TestUser;
    course: TestCourse;
    students: TestUser[];
    sessions: TestLearningSession[];
  } {
    const instructor = this.createUser({ role: 'admin' });
    const course = this.createCourse({ instructor });
    const students = course.students;
    
    // Create learning sessions for each student
    const sessions = students.map(student => 
      this.createLearningSession({
        userId: student.id,
        courseId: course.id,
      })
    );

    return {
      instructor,
      course,
      students,
      sessions,
    };
  }

  /**
   * Bulk data generation for performance testing
   */
  createBulkData(config: {
    users?: number;
    courses?: number;
    sessions?: number;
  }): {
    users: TestUser[];
    courses: TestCourse[];
    sessions: TestLearningSession[];
  } {
    const startTime = performance.now();
    
    console.log(`🏭 Generating bulk test data: ${config.users || 0} users, ${config.courses || 0} courses, ${config.sessions || 0} sessions`);

    const users = config.users ? this.createUsers(config.users) : [];
    const courses = config.courses ? Array.from({ length: config.courses }, () => this.createCourse()) : [];
    const sessions = config.sessions ? Array.from({ length: config.sessions }, () => this.createLearningSession()) : [];

    const duration = performance.now() - startTime;
    console.log(`✅ Bulk data generation completed in ${duration.toFixed(2)}ms`);

    return { users, courses, sessions };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): typeof performanceMetrics {
    return { ...performanceMetrics };
  }

  /**
   * Clear cache and reset metrics
   */
  clearCache(): void {
    dataCache.clear();
    performanceMetrics.cacheHits = 0;
    performanceMetrics.cacheMisses = 0;
    performanceMetrics.dataGenerationTime = 0;
    performanceMetrics.cleanupTime = 0;
  }

  /**
   * Cleanup all generated data
   */
  cleanup(): void {
    const startTime = performance.now();
    
    // Clear pools
    this.userPool.length = 0;
    this.coursePool.length = 0;
    
    // Run cleanup callbacks
    cleanupRegistry.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Cleanup function failed:', error);
      }
    });
    cleanupRegistry.clear();
    
    // Clear cache
    this.clearCache();
    
    performanceMetrics.cleanupTime = performance.now() - startTime;
    console.log(`🧹 Test data cleanup completed in ${performanceMetrics.cleanupTime.toFixed(2)}ms`);
  }

  /**
   * Register cleanup callback
   */
  registerCleanup(callback: () => void): void {
    cleanupRegistry.add(callback);
  }
}

// Export singleton instance
export const testDataFactory = TestDataFactory.getInstance();

// Export helper functions
export const createTestUser = (overrides?: Partial<TestUser>) => 
  testDataFactory.createUser(overrides);

export const createTestUsers = (count: number, overrides?: Partial<TestUser>) => 
  testDataFactory.createUsers(count, overrides);

export const createTestCourse = (overrides?: Partial<TestCourse>) => 
  testDataFactory.createCourse(overrides);

export const createTestLearningSession = (overrides?: Partial<TestLearningSession>) => 
  testDataFactory.createLearningSession(overrides);

export const createLearningScenario = () => 
  testDataFactory.createLearningScenario();

export const createBulkTestData = (config: Parameters<typeof testDataFactory.createBulkData>[0]) => 
  testDataFactory.createBulkData(config);

// Global cleanup for test environment
if (typeof global !== 'undefined') {
  global.testCleanup = () => testDataFactory.cleanup();
}