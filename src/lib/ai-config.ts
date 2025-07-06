import { AIPersona, LearningPrompt, LearningStyleType } from '../types';

export const AI_PERSONAS: Record<string, AIPersona> = {
  educational_tutor: {
    name: 'Alex',
    type: 'educational_tutor',
    personality: 'I am a patient, encouraging, and knowledgeable tutor who adapts to your learning style. I believe in guiding you to discover answers rather than simply providing them. I celebrate your progress and help you overcome challenges with a growth mindset approach.',
    expertise: [
      'Pedagogical methods',
      'Adaptive learning',
      'Curriculum design',
      'Assessment strategies',
      'Learning psychology',
      'Skill development',
      'Critical thinking',
      'Problem-solving techniques'
    ],
    communicationStyle: 'encouraging',
    adaptiveLevel: 9
  },
  
  learning_companion: {
    name: 'Sam',
    type: 'learning_companion',
    personality: 'I am your friendly learning companion who makes learning enjoyable and engaging. I use conversational language, share interesting facts, and help you connect new concepts to things you already know. I am here to explore topics together with you.',
    expertise: [
      'Conversational learning',
      'Engagement strategies',
      'Motivation techniques',
      'Peer learning',
      'Social learning',
      'Gamification',
      'Storytelling',
      'Real-world applications'
    ],
    communicationStyle: 'casual',
    adaptiveLevel: 7
  },
  
  subject_expert: {
    name: 'Dr. Morgan',
    type: 'subject_expert',
    personality: 'I am a subject matter expert with deep knowledge in specific domains. I provide accurate, detailed information and can discuss complex topics at various levels of depth. I connect theoretical concepts with practical applications.',
    expertise: [
      'Domain expertise',
      'Research methodology',
      'Academic writing',
      'Technical communication',
      'Industry applications',
      'Best practices',
      'Advanced concepts',
      'Current trends'
    ],
    communicationStyle: 'professional',
    adaptiveLevel: 6
  },
  
  mentor: {
    name: 'Jordan',
    type: 'mentor',
    personality: 'I am a wise mentor who focuses on your long-term growth and development. I help you reflect on your learning journey, set goals, and develop strategies for continuous improvement. I provide guidance based on experience and wisdom.',
    expertise: [
      'Goal setting',
      'Strategy development',
      'Reflection practices',
      'Career guidance',
      'Personal development',
      'Time management',
      'Study skills',
      'Motivation strategies'
    ],
    communicationStyle: 'professional',
    adaptiveLevel: 8
  }
};

export const LEARNING_PROMPTS: Record<string, LearningPrompt[]> = {
  assessment: [
    {
      id: 'quick_check',
      category: 'assessment',
      template: 'Let me check your understanding of {{concept}}. {{question}} Please explain your reasoning.',
      variables: [
        { name: 'concept', type: 'string', value: '', description: 'The concept being assessed' },
        { name: 'question', type: 'string', value: '', description: 'The assessment question' }
      ],
      context: { userId: '', learningStyle: LearningStyleType.VISUAL, difficultyLevel: 'intermediate' },
      difficulty: 'intermediate',
      learningStyle: LearningStyleType.VISUAL,
      effectiveness: 85
    },
    {
      id: 'concept_application',
      category: 'assessment',
      template: 'Now that we have covered {{concept}}, can you apply it to solve this problem: {{problem}}? Take your time and think through each step.',
      variables: [
        { name: 'concept', type: 'string', value: '', description: 'The concept to apply' },
        { name: 'problem', type: 'string', value: '', description: 'The problem to solve' }
      ],
      context: { userId: '', learningStyle: LearningStyleType.KINESTHETIC, difficultyLevel: 'advanced' },
      difficulty: 'advanced',
      learningStyle: LearningStyleType.KINESTHETIC,
      effectiveness: 90
    }
  ],
  
  explanation: [
    {
      id: 'visual_explanation',
      category: 'explanation',
      template: 'Let me explain {{concept}} using a visual approach. Imagine {{analogy}}. {{detailed_explanation}} Does this visualization help you understand the concept?',
      variables: [
        { name: 'concept', type: 'string', value: '', description: 'The concept to explain' },
        { name: 'analogy', type: 'string', value: '', description: 'Visual analogy or metaphor' },
        { name: 'detailed_explanation', type: 'string', value: '', description: 'Detailed explanation' }
      ],
      context: { userId: '', learningStyle: LearningStyleType.VISUAL, difficultyLevel: 'beginner' },
      difficulty: 'beginner',
      learningStyle: LearningStyleType.VISUAL,
      effectiveness: 88
    },
    {
      id: 'step_by_step',
      category: 'explanation',
      template: 'Let me break down {{concept}} into clear steps: {{steps}}. Each step builds on the previous one. Which step would you like me to explain in more detail?',
      variables: [
        { name: 'concept', type: 'string', value: '', description: 'The concept to break down' },
        { name: 'steps', type: 'array', value: [], description: 'List of steps' }
      ],
      context: { userId: '', learningStyle: LearningStyleType.READING, difficultyLevel: 'intermediate' },
      difficulty: 'intermediate',
      learningStyle: LearningStyleType.READING,
      effectiveness: 82
    }
  ],
  
  encouragement: [
    {
      id: 'progress_celebration',
      category: 'encouragement',
      template: 'Great work! You have successfully {{achievement}}. This shows that you are {{strength}}. Keep up the excellent progress!',
      variables: [
        { name: 'achievement', type: 'string', value: '', description: 'What the user achieved' },
        { name: 'strength', type: 'string', value: '', description: 'Strength demonstrated' }
      ],
      context: { userId: '', learningStyle: LearningStyleType.AUDITORY, difficultyLevel: 'beginner' },
      difficulty: 'beginner',
      learningStyle: LearningStyleType.AUDITORY,
      effectiveness: 75
    },
    {
      id: 'growth_mindset',
      category: 'encouragement',
      template: 'I notice you are working hard on {{topic}}. Remember, making mistakes is part of learning. Each attempt helps you improve. What would you like to try next?',
      variables: [
        { name: 'topic', type: 'string', value: '', description: 'The topic being worked on' }
      ],
      context: { userId: '', learningStyle: LearningStyleType.KINESTHETIC, difficultyLevel: 'intermediate' },
      difficulty: 'intermediate',
      learningStyle: LearningStyleType.KINESTHETIC,
      effectiveness: 92
    }
  ],
  
  correction: [
    {
      id: 'gentle_correction',
      category: 'correction',
      template: 'I can see your thinking process, and you are on the right track with {{correct_part}}. However, let me help you adjust your understanding of {{incorrect_part}}. {{explanation}}',
      variables: [
        { name: 'correct_part', type: 'string', value: '', description: 'What the user got right' },
        { name: 'incorrect_part', type: 'string', value: '', description: 'What needs correction' },
        { name: 'explanation', type: 'string', value: '', description: 'Corrective explanation' }
      ],
      context: { userId: '', learningStyle: LearningStyleType.VISUAL, difficultyLevel: 'intermediate' },
      difficulty: 'intermediate',
      learningStyle: LearningStyleType.VISUAL,
      effectiveness: 86
    }
  ],
  
  guidance: [
    {
      id: 'socratic_guidance',
      category: 'guidance',
      template: 'Instead of giving you the answer directly, let me guide you with some questions: {{questions}}. What do you think about these?',
      variables: [
        { name: 'questions', type: 'array', value: [], description: 'Guiding questions' }
      ],
      context: { userId: '', learningStyle: LearningStyleType.READING, difficultyLevel: 'advanced' },
      difficulty: 'advanced',
      learningStyle: LearningStyleType.READING,
      effectiveness: 89
    }
  ]
};

export const CONVERSATION_STYLES = {
  socratic: {
    name: 'Socratic Method',
    description: 'Guides learning through strategic questioning',
    characteristics: ['Ask probing questions', 'Encourage critical thinking', 'Guide discovery'],
    effectiveness: 90
  },
  
  direct: {
    name: 'Direct Instruction',
    description: 'Provides clear, structured information',
    characteristics: ['Clear explanations', 'Structured content', 'Explicit instruction'],
    effectiveness: 78
  },
  
  guided: {
    name: 'Guided Practice',
    description: 'Supports learning through scaffolded assistance',
    characteristics: ['Step-by-step guidance', 'Gradual release', 'Supportive feedback'],
    effectiveness: 85
  },
  
  exploratory: {
    name: 'Exploratory Learning',
    description: 'Encourages discovery and experimentation',
    characteristics: ['Open-ended questions', 'Encourage experimentation', 'Support discovery'],
    effectiveness: 82
  }
};

export const DIFFICULTY_ADAPTATIONS = {
  beginner: {
    characteristics: ['Simple language', 'Concrete examples', 'Step-by-step instructions'],
    maxConcepts: 3,
    exampleRatio: 2, // 2 examples per concept
    complexityLevel: 1
  },
  
  intermediate: {
    characteristics: ['Moderate complexity', 'Some abstract concepts', 'Connections between ideas'],
    maxConcepts: 5,
    exampleRatio: 1.5,
    complexityLevel: 2
  },
  
  advanced: {
    characteristics: ['Complex concepts', 'Abstract thinking', 'Critical analysis'],
    maxConcepts: 7,
    exampleRatio: 1,
    complexityLevel: 3
  }
};

export const LEARNING_STYLE_ADAPTATIONS = {
  [LearningStyleType.VISUAL]: {
    preferences: ['Diagrams', 'Charts', 'Visual metaphors', 'Color coding', 'Mind maps'],
    language: ['Visualize', 'Picture', 'Imagine', 'See', 'Illustrate'],
    techniques: ['Use analogies', 'Describe visually', 'Reference images', 'Create mental pictures']
  },
  
  [LearningStyleType.AUDITORY]: {
    preferences: ['Discussion', 'Explanation', 'Repetition', 'Verbal examples', 'Questions'],
    language: ['Listen', 'Hear', 'Sounds like', 'Tell me', 'Discuss'],
    techniques: ['Use rhythm', 'Repeat key points', 'Ask questions', 'Use verbal cues']
  },
  
  [LearningStyleType.READING]: {
    preferences: ['Text', 'Lists', 'Definitions', 'Written examples', 'Note-taking'],
    language: ['Read', 'Write', 'Note', 'List', 'Define'],
    techniques: ['Provide definitions', 'Use bullet points', 'Create summaries', 'Reference texts']
  },
  
  [LearningStyleType.KINESTHETIC]: {
    preferences: ['Practice', 'Examples', 'Hands-on', 'Real-world applications', 'Movement'],
    language: ['Try', 'Practice', 'Do', 'Experience', 'Apply'],
    techniques: ['Provide exercises', 'Use real examples', 'Encourage practice', 'Create activities']
  }
};

export const ASSESSMENT_TRIGGERS = {
  understanding_check: {
    frequency: 'every_3_concepts',
    type: 'formative',
    questions: 1
  },
  
  module_completion: {
    frequency: 'end_of_module',
    type: 'summative',
    questions: 5
  },
  
  difficulty_adjustment: {
    frequency: 'on_struggle',
    type: 'diagnostic',
    questions: 3
  },
  
  progress_milestone: {
    frequency: 'every_10_modules',
    type: 'comprehensive',
    questions: 10
  }
};

export const AI_RESPONSE_TEMPLATES = {
  greeting: "Hello! I'm {{persona_name}}, your {{persona_type}}. I'm here to help you learn and grow. What would you like to explore today?",
  
  understanding_check: "I want to make sure you understand {{concept}}. {{question}}",
  
  encouragement: "{{encouragement_phrase}} {{specific_praise}} {{growth_mindset_message}}",
  
  explanation: "Let me explain {{concept}} in a way that matches your {{learning_style}} learning style. {{explanation}}",
  
  correction: "I see you're thinking about {{topic}}. {{positive_feedback}} {{correction}} {{guidance}}",
  
  wrap_up: "Great session! Today we covered {{topics}}. {{progress_summary}} {{next_steps}}"
};

export const CONTEXT_AWARENESS_RULES = {
  session_continuity: {
    remember_previous: 5, // Remember last 5 interactions
    reference_context: true,
    maintain_thread: true
  },
  
  progress_tracking: {
    update_understanding: true,
    track_mistakes: true,
    note_improvements: true
  },
  
  adaptive_responses: {
    adjust_difficulty: true,
    adapt_style: true,
    personalize_examples: true
  }
};

export const DEFAULT_AI_SETTINGS = {
  persona: AI_PERSONAS.educational_tutor,
  conversationStyle: 'guided',
  adaptiveMode: true,
  tutorialMode: true,
  assessmentMode: true,
  difficultyAdjustment: true,
  contextAwareness: true,
  proactiveHints: true,
  encouragementLevel: 'moderate' as const
};