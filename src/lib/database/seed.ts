import { query, transaction } from './connection';
import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Seed data for development and testing
export class DatabaseSeeder {
  
  /**
   * Run all seed operations
   */
  static async seedAll(): Promise<void> {
    console.log('🌱 Starting database seeding...');
    
    try {
      await this.seedUsers();
      await this.seedContent();
      await this.seedAssessments();
      await this.seedSampleSessions();
      await this.seedRecommendations();
      
      console.log('✅ Database seeding completed successfully!');
    } catch (error) {
      console.error('❌ Database seeding failed:', error);
      throw error;
    }
  }
  
  /**
   * Seed test users with various learning profiles
   */
  static async seedUsers(): Promise<void> {
    console.log('👥 Seeding users...');
    
    const users = [
      {
        id: uuidv4(),
        email: 'alice@example.com',
        name: 'Alice Johnson',
        dominantStyle: 'visual',
        isMultimodal: false,
        adaptationLevel: 75,
        currentPace: 4.5,
        optimalPace: 5.0,
        comprehensionRate: 85,
        retentionRate: 80,
        difficultyLevel: 'intermediate',
        dailyGoalMinutes: 45,
        daysPerWeek: 5,
      },
      {
        id: uuidv4(),
        email: 'bob@example.com',
        name: 'Bob Smith',
        dominantStyle: 'auditory',
        isMultimodal: true,
        adaptationLevel: 60,
        currentPace: 3.2,
        optimalPace: 4.0,
        comprehensionRate: 78,
        retentionRate: 82,
        difficultyLevel: 'beginner',
        dailyGoalMinutes: 30,
        daysPerWeek: 4,
      },
      {
        id: uuidv4(),
        email: 'charlie@example.com',
        name: 'Charlie Brown',
        dominantStyle: 'reading',
        isMultimodal: false,
        adaptationLevel: 90,
        currentPace: 5.8,
        optimalPace: 6.0,
        comprehensionRate: 92,
        retentionRate: 88,
        difficultyLevel: 'advanced',
        dailyGoalMinutes: 60,
        daysPerWeek: 6,
      },
      {
        id: uuidv4(),
        email: 'diana@example.com',
        name: 'Diana Prince',
        dominantStyle: 'kinesthetic',
        isMultimodal: true,
        adaptationLevel: 45,
        currentPace: 2.8,
        optimalPace: 3.5,
        comprehensionRate: 75,
        retentionRate: 77,
        difficultyLevel: 'intermediate',
        dailyGoalMinutes: 40,
        daysPerWeek: 5,
      },
    ];
    
    await transaction(async (client: PoolClient) => {
      for (const user of users) {
        // Create user
        await client.query(
          `INSERT INTO users (id, email, name, avatar_url) VALUES ($1, $2, $3, $4)`,
          [user.id, user.email, user.name, `https://avatar.iran.liara.run/public/boy?username=${user.name.split(' ')[0]}`]
        );
        
        // Create user preferences
        await client.query(
          `INSERT INTO user_preferences 
           (user_id, learning_goals, preferred_topics, difficulty_level, daily_goal_minutes, 
            preferred_times, days_per_week, email_notifications, push_notifications, reminder_notifications)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            user.id,
            ['Master new skills', 'Improve comprehension', 'Build confidence'],
            ['Mathematics', 'Science', 'Technology', 'Language Arts'],
            user.difficultyLevel,
            user.dailyGoalMinutes,
            ['09:00', '14:00', '19:00'],
            user.daysPerWeek,
            true,
            true,
            true,
          ]
        );
        
        // Create learning profile
        const profileId = uuidv4();
        await client.query(
          `INSERT INTO learning_profiles 
           (id, user_id, dominant_style, is_multimodal, adaptation_level, confidence_score)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [profileId, user.id, user.dominantStyle, user.isMultimodal, user.adaptationLevel, 0.8]
        );
        
        // Create individual learning style scores
        const styleScores = {
          visual: user.dominantStyle === 'visual' ? 85 : Math.random() * 40 + 20,
          auditory: user.dominantStyle === 'auditory' ? 85 : Math.random() * 40 + 20,
          reading: user.dominantStyle === 'reading' ? 85 : Math.random() * 40 + 20,
          kinesthetic: user.dominantStyle === 'kinesthetic' ? 85 : Math.random() * 40 + 20,
        };
        
        for (const [styleType, score] of Object.entries(styleScores)) {
          await client.query(
            `INSERT INTO learning_styles (profile_id, style_type, score, confidence)
             VALUES ($1, $2, $3, $4)`,
            [profileId, styleType, Math.round(score), 0.8]
          );
        }
        
        // Create style assessment
        await client.query(
          `INSERT INTO style_assessments 
           (profile_id, assessment_type, visual_score, auditory_score, reading_score, kinesthetic_score, confidence, data_points)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            profileId,
            'hybrid',
            styleScores.visual / 100,
            styleScores.auditory / 100,
            styleScores.reading / 100,
            styleScores.kinesthetic / 100,
            0.8,
            25,
          ]
        );
        
        // Create pace profile
        await client.query(
          `INSERT INTO pace_profiles 
           (user_id, current_pace, optimal_pace, comprehension_rate, retention_rate, difficulty_adjustment, fatigue_level)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            user.id,
            user.currentPace,
            user.optimalPace,
            user.comprehensionRate,
            user.retentionRate,
            1.0,
            Math.random() * 30,
          ]
        );
        
        // Add some behavioral indicators
        for (let i = 0; i < 10; i++) {
          await client.query(
            `INSERT INTO behavioral_indicators 
             (profile_id, action, content_type, engagement_level, completion_rate, time_spent, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              profileId,
              ['click', 'scroll', 'pause', 'replay', 'bookmark'][Math.floor(Math.random() * 5)],
              user.dominantStyle,
              Math.random() * 40 + 60, // 60-100 engagement
              Math.random() * 30 + 70, // 70-100 completion
              Math.random() * 60 + 15, // 15-75 minutes
              new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
            ]
          );
        }
      }
    });
    
    console.log(`✅ Created ${users.length} users with profiles`);
  }
  
  /**
   * Seed adaptive content with variants
   */
  static async seedContent(): Promise<void> {
    console.log('📚 Seeding content...');
    
    const contentItems = [
      {
        id: uuidv4(),
        title: 'Introduction to JavaScript Fundamentals',
        concept: 'JavaScript Basics',
        difficulty: 3,
        estimatedDuration: 45,
        learningObjectives: ['Understand variables', 'Learn data types', 'Practice basic syntax'],
        tags: ['javascript', 'programming', 'web-development', 'fundamentals'],
        bloomsTaxonomyLevel: 'understand',
        cognitiveLoad: 4,
        estimatedEngagement: 7,
        successRate: 85,
      },
      {
        id: uuidv4(),
        title: 'Advanced React Patterns',
        concept: 'React Development',
        difficulty: 7,
        estimatedDuration: 90,
        learningObjectives: ['Master hooks', 'Implement context API', 'Build custom hooks'],
        tags: ['react', 'javascript', 'web-development', 'advanced'],
        bloomsTaxonomyLevel: 'apply',
        cognitiveLoad: 8,
        estimatedEngagement: 6,
        successRate: 72,
      },
      {
        id: uuidv4(),
        title: 'Database Design Principles',
        concept: 'Database Architecture',
        difficulty: 5,
        estimatedDuration: 60,
        learningObjectives: ['Understand normalization', 'Design schemas', 'Optimize queries'],
        tags: ['database', 'sql', 'design', 'architecture'],
        bloomsTaxonomyLevel: 'analyze',
        cognitiveLoad: 6,
        estimatedEngagement: 8,
        successRate: 78,
      },
      {
        id: uuidv4(),
        title: 'Machine Learning Basics',
        concept: 'Artificial Intelligence',
        difficulty: 6,
        estimatedDuration: 75,
        learningObjectives: ['Understand algorithms', 'Implement models', 'Evaluate performance'],
        tags: ['machine-learning', 'ai', 'python', 'data-science'],
        bloomsTaxonomyLevel: 'apply',
        cognitiveLoad: 7,
        estimatedEngagement: 9,
        successRate: 69,
      },
      {
        id: uuidv4(),
        title: 'UI/UX Design Fundamentals',
        concept: 'User Experience Design',
        difficulty: 4,
        estimatedDuration: 50,
        learningObjectives: ['Learn design principles', 'Create wireframes', 'Conduct user research'],
        tags: ['design', 'ux', 'ui', 'user-experience'],
        bloomsTaxonomyLevel: 'create',
        cognitiveLoad: 5,
        estimatedEngagement: 8,
        successRate: 82,
      },
    ];
    
    await transaction(async (client: PoolClient) => {
      for (const content of contentItems) {
        // Create content
        await client.query(
          `INSERT INTO adaptive_content 
           (id, title, description, concept, learning_objectives, difficulty, estimated_duration, 
            prerequisites, tags, language, blooms_taxonomy_level, cognitive_load, estimated_engagement, success_rate)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            content.id,
            content.title,
            `Learn ${content.concept.toLowerCase()} with this comprehensive course.`,
            content.concept,
            content.learningObjectives,
            content.difficulty,
            content.estimatedDuration,
            [],
            content.tags,
            'en',
            content.bloomsTaxonomyLevel,
            content.cognitiveLoad,
            content.estimatedEngagement,
            content.successRate,
          ]
        );
        
        // Create content variants for each learning style
        const styles = ['visual', 'auditory', 'reading', 'kinesthetic'];
        for (const style of styles) {
          const variantId = uuidv4();
          
          let format = 'text';
          let contentData = `<p>This is ${style} content for ${content.title}</p>`;
          let interactivityLevel = 'medium';
          
          switch (style) {
            case 'visual':
              format = Math.random() > 0.5 ? 'video' : 'infographic';
              contentData = JSON.stringify({
                type: format,
                content: `Visual learning content with diagrams and charts for ${content.title}`,
                media: [`/media/${format}/${content.id}.${format === 'video' ? 'mp4' : 'png'}`],
              });
              interactivityLevel = 'high';
              break;
            case 'auditory':
              format = Math.random() > 0.5 ? 'audio' : 'video';
              contentData = JSON.stringify({
                type: format,
                content: `Audio-based learning content with narration for ${content.title}`,
                media: [`/media/${format}/${content.id}.${format === 'audio' ? 'mp3' : 'mp4'}`],
              });
              interactivityLevel = 'medium';
              break;
            case 'reading':
              format = 'text';
              contentData = `<div class="reading-content">
                <h2>${content.title}</h2>
                <p>Comprehensive text-based learning material covering ${content.concept}.</p>
                <ul>
                  ${content.learningObjectives.map(obj => `<li>${obj}</li>`).join('')}
                </ul>
              </div>`;
              interactivityLevel = 'low';
              break;
            case 'kinesthetic':
              format = Math.random() > 0.5 ? 'interactive' : 'simulation';
              contentData = JSON.stringify({
                type: format,
                content: `Interactive ${format} for hands-on learning of ${content.title}`,
                interactions: ['drag-drop', 'click-to-reveal', 'step-by-step'],
              });
              interactivityLevel = 'high';
              break;
          }
          
          await client.query(
            `INSERT INTO content_variants 
             (id, content_id, style_type, format, content_data, interactivity_level, 
              screen_reader_support, high_contrast, large_fonts, keyboard_navigation, audio_description)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              variantId,
              content.id,
              style,
              format,
              contentData,
              interactivityLevel,
              style === 'reading',
              true,
              style === 'reading',
              true,
              style === 'visual',
            ]
          );
          
          // Add media content for video/audio variants
          if (format === 'video' || format === 'audio') {
            await client.query(
              `INSERT INTO media_content 
               (variant_id, media_type, url, duration, transcript, captions, file_size, mime_type)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                variantId,
                format,
                `/media/${format}/${content.id}.${format === 'video' ? 'mp4' : 'mp3'}`,
                content.estimatedDuration * 60, // Convert to seconds
                `Transcript for ${content.title}...`,
                format === 'video' ? `Captions for ${content.title}...` : null,
                Math.random() * 100000000 + 10000000, // Random file size
                format === 'video' ? 'video/mp4' : 'audio/mpeg',
              ]
            );
          }
        }
      }
    });
    
    console.log(`✅ Created ${contentItems.length} content items with variants`);
  }
  
  /**
   * Seed assessments with questions
   */
  static async seedAssessments(): Promise<void> {
    console.log('📝 Seeding assessments...');
    
    // Get content IDs
    const contentResult = await query('SELECT id FROM adaptive_content LIMIT 5');
    const contentIds = contentResult.rows.map(row => row.id);
    
    const assessmentTypes = ['formative', 'summative', 'diagnostic'] as const;
    
    await transaction(async (client: PoolClient) => {
      for (const contentId of contentIds) {
        const assessmentType = assessmentTypes[Math.floor(Math.random() * assessmentTypes.length)];
        const assessmentId = uuidv4();
        
        await client.query(
          `INSERT INTO adaptive_assessments 
           (id, content_id, assessment_type, title, description, minimum_questions, maximum_questions, 
            target_accuracy, confidence_threshold, time_limit, total_points, passing_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            assessmentId,
            contentId,
            assessmentType,
            `Assessment for Content ${contentId.slice(0, 8)}`,
            `${assessmentType} assessment to evaluate understanding`,
            5,
            15,
            75,
            0.8,
            30,
            100,
            70,
          ]
        );
        
        // Create questions for each assessment
        const questionCount = Math.floor(Math.random() * 8) + 5; // 5-12 questions
        for (let i = 0; i < questionCount; i++) {
          const questionId = uuidv4();
          const questionType = ['multiple-choice', 'true-false', 'short-answer'][Math.floor(Math.random() * 3)];
          const difficulty = Math.floor(Math.random() * 5) + 3; // 3-7 difficulty
          
          await client.query(
            `INSERT INTO adaptive_questions 
             (id, assessment_id, question_text, question_type, difficulty, learning_objective, 
              correct_answer, explanation, hints, points, time_limit)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              questionId,
              assessmentId,
              `Question ${i + 1}: What is the main concept covered in this lesson?`,
              questionType,
              difficulty,
              `Understand key concepts from lesson ${i + 1}`,
              questionType === 'true-false' ? 'true' : 'Option A',
              `This question tests understanding of the fundamental concepts covered in the lesson.`,
              ['Think about the main topic', 'Review the learning objectives', 'Consider the examples given'],
              questionType === 'multiple-choice' ? 4 : 2,
              120, // 2 minutes
            ]
          );
          
          // Add options for multiple-choice questions
          if (questionType === 'multiple-choice') {
            const options = [
              { text: 'This is the correct answer', isCorrect: true },
              { text: 'This is an incorrect option', isCorrect: false },
              { text: 'This is another incorrect option', isCorrect: false },
              { text: 'This is also incorrect', isCorrect: false },
            ];
            
            for (let j = 0; j < options.length; j++) {
              await client.query(
                `INSERT INTO question_options 
                 (question_id, option_text, is_correct, feedback, order_index)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                  questionId,
                  options[j].text,
                  options[j].isCorrect,
                  options[j].isCorrect ? 'Correct! Well done.' : 'Incorrect. Try again.',
                  j,
                ]
              );
            }
          }
        }
      }
    });
    
    console.log(`✅ Created assessments with questions for ${contentIds.length} content items`);
  }
  
  /**
   * Seed sample learning sessions
   */
  static async seedSampleSessions(): Promise<void> {
    console.log('🎯 Seeding sample sessions...');
    
    const userResult = await query('SELECT id FROM users');
    const contentResult = await query('SELECT id FROM adaptive_content');
    const assessmentResult = await query('SELECT id FROM adaptive_assessments');
    
    const userIds = userResult.rows.map(row => row.id);
    const contentIds = contentResult.rows.map(row => row.id);
    const assessmentIds = assessmentResult.rows.map(row => row.id);
    
    await transaction(async (client: PoolClient) => {
      // Create learning sessions for each user
      for (const userId of userIds) {
        const sessionCount = Math.floor(Math.random() * 10) + 5; // 5-14 sessions
        
        for (let i = 0; i < sessionCount; i++) {
          const sessionId = uuidv4();
          const contentId = contentIds[Math.floor(Math.random() * contentIds.length)];
          const startTime = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
          const duration = Math.floor(Math.random() * 90) + 15; // 15-105 minutes
          const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
          
          const itemsCompleted = Math.floor(Math.random() * 10) + 1;
          const totalQuestions = Math.floor(Math.random() * 15) + 5;
          const correctAnswers = Math.floor(totalQuestions * (Math.random() * 0.4 + 0.5)); // 50-90% correct
          
          await client.query(
            `INSERT INTO learning_sessions 
             (id, user_id, content_id, start_time, end_time, duration, items_completed, 
              correct_answers, total_questions, completed, focus_time, distraction_events, 
              interaction_rate, scroll_depth, video_watch_time, pause_frequency)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [
              sessionId,
              userId,
              contentId,
              startTime,
              endTime,
              duration,
              itemsCompleted,
              correctAnswers,
              totalQuestions,
              Math.random() > 0.2, // 80% completion rate
              Math.floor(duration * (Math.random() * 0.3 + 0.7)), // 70-100% focus time
              Math.floor(Math.random() * 5), // 0-4 distractions
              Math.random() * 2 + 1, // 1-3 interactions per minute
              Math.floor(Math.random() * 40) + 60, // 60-100% scroll depth
              Math.floor(duration * 0.8), // Video watch time
              Math.floor(Math.random() * 3), // 0-2 pauses per hour
            ]
          );
          
          // Add some adaptive changes
          if (Math.random() > 0.5) {
            await client.query(
              `INSERT INTO adaptive_changes 
               (session_id, timestamp, change_type, previous_value, new_value, reason, user_response)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                sessionId,
                new Date(startTime.getTime() + Math.random() * duration * 60 * 1000),
                ['pace', 'difficulty', 'content_type'][Math.floor(Math.random() * 3)],
                '5',
                '4',
                'Performance below threshold',
                ['accepted', 'declined', 'ignored'][Math.floor(Math.random() * 3)],
              ]
            );
          }
        }
        
        // Create assessment attempts
        const attemptCount = Math.floor(Math.random() * 3) + 1; // 1-3 attempts
        for (let i = 0; i < attemptCount; i++) {
          const attemptId = uuidv4();
          const assessmentId = assessmentIds[Math.floor(Math.random() * assessmentIds.length)];
          const startedAt = new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000);
          const timeSpent = Math.floor(Math.random() * 45) + 15; // 15-60 minutes
          const completedAt = new Date(startedAt.getTime() + timeSpent * 60 * 1000);
          
          const questionsAnswered = Math.floor(Math.random() * 10) + 5;
          const correctAnswers = Math.floor(questionsAnswered * (Math.random() * 0.4 + 0.5));
          const score = Math.floor((correctAnswers / questionsAnswered) * 100);
          const passed = score >= 70;
          
          await client.query(
            `INSERT INTO assessment_attempts 
             (id, user_id, assessment_id, started_at, completed_at, score, passed, 
              time_spent, questions_answered, correct_answers)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              attemptId,
              userId,
              assessmentId,
              startedAt,
              completedAt,
              score,
              passed,
              timeSpent,
              questionsAnswered,
              correctAnswers,
            ]
          );
        }
      }
    });
    
    console.log(`✅ Created sample sessions and assessments for ${userIds.length} users`);
  }
  
  /**
   * Seed recommendations for users
   */
  static async seedRecommendations(): Promise<void> {
    console.log('💡 Seeding recommendations...');
    
    const userResult = await query('SELECT id FROM users');
    const userIds = userResult.rows.map(row => row.id);
    
    const recommendationTemplates = [
      {
        type: 'content',
        title: 'Try Visual Learning Materials',
        description: 'Based on your learning style, visual content might improve your comprehension.',
        reasoning: 'Your behavioral patterns show high engagement with visual elements.',
        confidence: 85,
        priority: 'high',
        estimatedImpact: 75,
      },
      {
        type: 'pace',
        title: 'Slow Down for Better Retention',
        description: 'Consider reducing your learning pace to improve retention.',
        reasoning: 'Your current pace is faster than optimal for your comprehension rate.',
        confidence: 78,
        priority: 'medium',
        estimatedImpact: 60,
      },
      {
        type: 'schedule',
        title: 'Morning Learning Sessions',
        description: 'Your peak performance time appears to be in the morning.',
        reasoning: 'Analytics show 23% better performance in morning sessions.',
        confidence: 92,
        priority: 'medium',
        estimatedImpact: 45,
      },
      {
        type: 'goal',
        title: 'Set Weekly Learning Goals',
        description: 'Setting specific weekly goals can improve your motivation.',
        reasoning: 'Users with defined goals show 34% higher completion rates.',
        confidence: 88,
        priority: 'low',
        estimatedImpact: 55,
      },
    ];
    
    await transaction(async (client: PoolClient) => {
      for (const userId of userIds) {
        // Create 2-4 recommendations per user
        const recCount = Math.floor(Math.random() * 3) + 2;
        const shuffled = [...recommendationTemplates].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < recCount; i++) {
          const template = shuffled[i];
          const recommendationId = uuidv4();
          
          await client.query(
            `INSERT INTO recommendations 
             (id, user_id, recommendation_type, title, description, reasoning, confidence, 
              priority, action_required, estimated_impact, status, created_at, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              recommendationId,
              userId,
              template.type,
              template.title,
              template.description,
              template.reasoning,
              template.confidence,
              template.priority,
              Math.random() > 0.7, // 30% require action
              template.estimatedImpact,
              'active',
              new Date(),
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
            ]
          );
        }
      }
    });
    
    console.log(`✅ Created recommendations for ${userIds.length} users`);
  }
  
  /**
   * Clear all seed data
   */
  static async clearSeedData(): Promise<void> {
    console.log('🧹 Clearing seed data...');
    
    const tables = [
      'question_responses',
      'assessment_attempts',
      'question_options',
      'adaptive_questions',
      'adaptive_assessments',
      'media_content',
      'content_variants',
      'adaptive_content',
      'adaptive_changes',
      'learning_sessions',
      'pace_adjustments',
      'pace_profiles',
      'behavioral_indicators',
      'style_assessments',
      'learning_styles',
      'learning_profiles',
      'user_preferences',
      'recommendations',
      'learning_predictions',
      'performance_trends',
      'content_engagement',
      'style_effectiveness',
      'learning_analytics',
      'users',
    ];
    
    await transaction(async (client: PoolClient) => {
      for (const table of tables) {
        await client.query(`DELETE FROM ${table} WHERE 1=1`);
      }
    });
    
    console.log('✅ Cleared all seed data');
  }
}

// Export convenience functions
export const seedAll = () => DatabaseSeeder.seedAll();
export const seedUsers = () => DatabaseSeeder.seedUsers();
export const seedContent = () => DatabaseSeeder.seedContent();
export const seedAssessments = () => DatabaseSeeder.seedAssessments();
export const seedSampleSessions = () => DatabaseSeeder.seedSampleSessions();
export const seedRecommendations = () => DatabaseSeeder.seedRecommendations();
export const clearSeedData = () => DatabaseSeeder.clearSeedData();