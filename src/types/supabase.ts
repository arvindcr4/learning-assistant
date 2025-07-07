export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          learning_goals: string[] | null
          preferred_topics: string[] | null
          difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null
          daily_goal_minutes: number | null
          preferred_times: string[] | null
          days_per_week: number | null
          email_notifications: boolean | null
          push_notifications: boolean | null
          reminder_notifications: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          learning_goals?: string[] | null
          preferred_topics?: string[] | null
          difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | null
          daily_goal_minutes?: number | null
          preferred_times?: string[] | null
          days_per_week?: number | null
          email_notifications?: boolean | null
          push_notifications?: boolean | null
          reminder_notifications?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          learning_goals?: string[] | null
          preferred_topics?: string[] | null
          difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | null
          daily_goal_minutes?: number | null
          preferred_times?: string[] | null
          days_per_week?: number | null
          email_notifications?: boolean | null
          push_notifications?: boolean | null
          reminder_notifications?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      learning_profiles: {
        Row: {
          id: string
          user_id: string
          dominant_style: 'visual' | 'auditory' | 'reading' | 'kinesthetic'
          is_multimodal: boolean | null
          adaptation_level: number | null
          confidence_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          dominant_style: 'visual' | 'auditory' | 'reading' | 'kinesthetic'
          is_multimodal?: boolean | null
          adaptation_level?: number | null
          confidence_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          dominant_style?: 'visual' | 'auditory' | 'reading' | 'kinesthetic'
          is_multimodal?: boolean | null
          adaptation_level?: number | null
          confidence_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      learning_sessions: {
        Row: {
          id: string
          user_id: string
          content_id: string
          start_time: string
          end_time: string | null
          duration: number
          items_completed: number | null
          correct_answers: number | null
          total_questions: number | null
          completed: boolean | null
          focus_time: number | null
          distraction_events: number | null
          interaction_rate: number | null
          scroll_depth: number | null
          video_watch_time: number | null
          pause_frequency: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content_id: string
          start_time?: string
          end_time?: string | null
          duration: number
          items_completed?: number | null
          correct_answers?: number | null
          total_questions?: number | null
          completed?: boolean | null
          focus_time?: number | null
          distraction_events?: number | null
          interaction_rate?: number | null
          scroll_depth?: number | null
          video_watch_time?: number | null
          pause_frequency?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content_id?: string
          start_time?: string
          end_time?: string | null
          duration?: number
          items_completed?: number | null
          correct_answers?: number | null
          total_questions?: number | null
          completed?: boolean | null
          focus_time?: number | null
          distraction_events?: number | null
          interaction_rate?: number | null
          scroll_depth?: number | null
          video_watch_time?: number | null
          pause_frequency?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      adaptive_content: {
        Row: {
          id: string
          title: string
          description: string | null
          concept: string
          learning_objectives: string[] | null
          difficulty: number
          estimated_duration: number
          prerequisites: string[] | null
          tags: string[] | null
          language: string | null
          blooms_taxonomy_level: string | null
          cognitive_load: number | null
          estimated_engagement: number | null
          success_rate: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          concept: string
          learning_objectives?: string[] | null
          difficulty?: number
          estimated_duration?: number
          prerequisites?: string[] | null
          tags?: string[] | null
          language?: string | null
          blooms_taxonomy_level?: string | null
          cognitive_load?: number | null
          estimated_engagement?: number | null
          success_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          concept?: string
          learning_objectives?: string[] | null
          difficulty?: number
          estimated_duration?: number
          prerequisites?: string[] | null
          tags?: string[] | null
          language?: string | null
          blooms_taxonomy_level?: string | null
          cognitive_load?: number | null
          estimated_engagement?: number | null
          success_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_variants: {
        Row: {
          id: string
          content_id: string
          style_type: 'visual' | 'auditory' | 'reading' | 'kinesthetic'
          format: 'text' | 'video' | 'audio' | 'interactive' | 'infographic' | 'simulation' | 'diagram' | 'quiz'
          content_data: string
          interactivity_level: 'passive' | 'low' | 'medium' | 'high'
          screen_reader_support: boolean | null
          high_contrast: boolean | null
          large_fonts: boolean | null
          keyboard_navigation: boolean | null
          audio_description: boolean | null
          sign_language: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          content_id: string
          style_type: 'visual' | 'auditory' | 'reading' | 'kinesthetic'
          format: 'text' | 'video' | 'audio' | 'interactive' | 'infographic' | 'simulation' | 'diagram' | 'quiz'
          content_data: string
          interactivity_level: 'passive' | 'low' | 'medium' | 'high'
          screen_reader_support?: boolean | null
          high_contrast?: boolean | null
          large_fonts?: boolean | null
          keyboard_navigation?: boolean | null
          audio_description?: boolean | null
          sign_language?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          content_id?: string
          style_type?: 'visual' | 'auditory' | 'reading' | 'kinesthetic'
          format?: 'text' | 'video' | 'audio' | 'interactive' | 'infographic' | 'simulation' | 'diagram' | 'quiz'
          content_data?: string
          interactivity_level?: 'passive' | 'low' | 'medium' | 'high'
          screen_reader_support?: boolean | null
          high_contrast?: boolean | null
          large_fonts?: boolean | null
          keyboard_navigation?: boolean | null
          audio_description?: boolean | null
          sign_language?: boolean | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_variants_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "adaptive_content"
            referencedColumns: ["id"]
          }
        ]
      }
      adaptive_assessments: {
        Row: {
          id: string
          content_id: string
          assessment_type: 'formative' | 'summative' | 'diagnostic'
          title: string
          description: string | null
          minimum_questions: number | null
          maximum_questions: number | null
          target_accuracy: number | null
          confidence_threshold: number | null
          time_limit: number | null
          total_points: number | null
          passing_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          content_id: string
          assessment_type: 'formative' | 'summative' | 'diagnostic'
          title: string
          description?: string | null
          minimum_questions?: number | null
          maximum_questions?: number | null
          target_accuracy?: number | null
          confidence_threshold?: number | null
          time_limit?: number | null
          total_points?: number | null
          passing_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          content_id?: string
          assessment_type?: 'formative' | 'summative' | 'diagnostic'
          title?: string
          description?: string | null
          minimum_questions?: number | null
          maximum_questions?: number | null
          target_accuracy?: number | null
          confidence_threshold?: number | null
          time_limit?: number | null
          total_points?: number | null
          passing_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_assessments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "adaptive_content"
            referencedColumns: ["id"]
          }
        ]
      }
      recommendations: {
        Row: {
          id: string
          user_id: string
          recommendation_type: 'content' | 'pace' | 'style' | 'schedule' | 'goal'
          title: string
          description: string
          reasoning: string
          confidence: number
          priority: 'low' | 'medium' | 'high'
          action_required: boolean | null
          estimated_impact: number
          status: 'active' | 'accepted' | 'declined' | 'expired' | null
          user_feedback: string | null
          feedback_rating: number | null
          created_at: string
          expires_at: string | null
          responded_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          recommendation_type: 'content' | 'pace' | 'style' | 'schedule' | 'goal'
          title: string
          description: string
          reasoning: string
          confidence: number
          priority: 'low' | 'medium' | 'high'
          action_required?: boolean | null
          estimated_impact: number
          status?: 'active' | 'accepted' | 'declined' | 'expired' | null
          user_feedback?: string | null
          feedback_rating?: number | null
          created_at?: string
          expires_at?: string | null
          responded_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          recommendation_type?: 'content' | 'pace' | 'style' | 'schedule' | 'goal'
          title?: string
          description?: string
          reasoning?: string
          confidence?: number
          priority?: 'low' | 'medium' | 'high'
          action_required?: boolean | null
          estimated_impact?: number
          status?: 'active' | 'accepted' | 'declined' | 'expired' | null
          user_feedback?: string | null
          feedback_rating?: number | null
          created_at?: string
          expires_at?: string | null
          responded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      user_learning_overview: {
        Row: {
          user_id: string | null
          name: string | null
          email: string | null
          dominant_style: 'visual' | 'auditory' | 'reading' | 'kinesthetic' | null
          is_multimodal: boolean | null
          adaptation_level: number | null
          current_pace: number | null
          optimal_pace: number | null
          comprehension_rate: number | null
          total_sessions: number | null
          total_time_spent: number | null
          average_score: number | null
        }
        Relationships: []
      }
      content_effectiveness: {
        Row: {
          content_id: string | null
          title: string | null
          concept: string | null
          difficulty: number | null
          total_sessions: number | null
          average_score: number | null
          average_duration: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      recent_user_activity: {
        Row: {
          user_id: string | null
          name: string | null
          last_session: string | null
          active_days_last_30: number | null
          sessions_last_30: number | null
          total_time_last_30: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Additional types for the application
export type User = Database['public']['Tables']['users']['Row']
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row']
export type LearningProfile = Database['public']['Tables']['learning_profiles']['Row']
export type LearningSession = Database['public']['Tables']['learning_sessions']['Row']
export type AdaptiveContent = Database['public']['Tables']['adaptive_content']['Row']
export type ContentVariant = Database['public']['Tables']['content_variants']['Row']
export type AdaptiveAssessment = Database['public']['Tables']['adaptive_assessments']['Row']
export type Recommendation = Database['public']['Tables']['recommendations']['Row']

// Insert types
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserPreferencesInsert = Database['public']['Tables']['user_preferences']['Insert']
export type LearningProfileInsert = Database['public']['Tables']['learning_profiles']['Insert']
export type LearningSessionInsert = Database['public']['Tables']['learning_sessions']['Insert']
export type AdaptiveContentInsert = Database['public']['Tables']['adaptive_content']['Insert']
export type ContentVariantInsert = Database['public']['Tables']['content_variants']['Insert']
export type AdaptiveAssessmentInsert = Database['public']['Tables']['adaptive_assessments']['Insert']
export type RecommendationInsert = Database['public']['Tables']['recommendations']['Insert']

// Update types
export type UserUpdate = Database['public']['Tables']['users']['Update']
export type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update']
export type LearningProfileUpdate = Database['public']['Tables']['learning_profiles']['Update']
export type LearningSessionUpdate = Database['public']['Tables']['learning_sessions']['Update']
export type AdaptiveContentUpdate = Database['public']['Tables']['adaptive_content']['Update']
export type ContentVariantUpdate = Database['public']['Tables']['content_variants']['Update']
export type AdaptiveAssessmentUpdate = Database['public']['Tables']['adaptive_assessments']['Update']
export type RecommendationUpdate = Database['public']['Tables']['recommendations']['Update']

// View types
export type UserLearningOverview = Database['public']['Views']['user_learning_overview']['Row']
export type ContentEffectiveness = Database['public']['Views']['content_effectiveness']['Row']
export type RecentUserActivity = Database['public']['Views']['recent_user_activity']['Row']