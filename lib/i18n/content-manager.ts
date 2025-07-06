export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'ar';

export interface LocalizedContent {
  id: string;
  locale: Locale;
  title: string;
  description: string;
  content: string;
  metadata: {
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    category: string;
    duration: number; // in minutes
    culturalContext?: string;
    learningStyle?: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CulturalAdaptation {
  locale: Locale;
  preferences: {
    learningPace: 'slow' | 'medium' | 'fast';
    interactionStyle: 'formal' | 'informal' | 'mixed';
    feedbackStyle: 'direct' | 'gentle' | 'encouraging';
    culturalReferences: boolean;
    localExamples: boolean;
    timeFormat: '12h' | '24h';
    dateFormat: 'mm/dd/yyyy' | 'dd/mm/yyyy' | 'yyyy-mm-dd';
    numberFormat: 'decimal' | 'comma';
  };
  educationalNorms: {
    respectForAuthority: 'high' | 'medium' | 'low';
    collaborativeLearning: 'preferred' | 'neutral' | 'avoided';
    competitiveElements: 'encouraged' | 'neutral' | 'discouraged';
    publicRecognition: 'valued' | 'neutral' | 'avoided';
  };
}

export class ContentManager {
  private static instance: ContentManager;
  private contentCache: Map<string, LocalizedContent[]> = new Map();
  private culturalAdaptations: Map<Locale, CulturalAdaptation> = new Map();

  private constructor() {
    this.initializeCulturalAdaptations();
  }

  public static getInstance(): ContentManager {
    if (!ContentManager.instance) {
      ContentManager.instance = new ContentManager();
    }
    return ContentManager.instance;
  }

  private initializeCulturalAdaptations() {
    // English (US/UK) - Direct, individual-focused
    this.culturalAdaptations.set('en', {
      locale: 'en',
      preferences: {
        learningPace: 'medium',
        interactionStyle: 'mixed',
        feedbackStyle: 'direct',
        culturalReferences: true,
        localExamples: true,
        timeFormat: '12h',
        dateFormat: 'mm/dd/yyyy',
        numberFormat: 'decimal'
      },
      educationalNorms: {
        respectForAuthority: 'medium',
        collaborativeLearning: 'preferred',
        competitiveElements: 'encouraged',
        publicRecognition: 'valued'
      }
    });

    // Spanish - Relationship-focused, collaborative
    this.culturalAdaptations.set('es', {
      locale: 'es',
      preferences: {
        learningPace: 'medium',
        interactionStyle: 'informal',
        feedbackStyle: 'encouraging',
        culturalReferences: true,
        localExamples: true,
        timeFormat: '24h',
        dateFormat: 'dd/mm/yyyy',
        numberFormat: 'comma'
      },
      educationalNorms: {
        respectForAuthority: 'high',
        collaborativeLearning: 'preferred',
        competitiveElements: 'neutral',
        publicRecognition: 'valued'
      }
    });

    // French - Formal, analytical
    this.culturalAdaptations.set('fr', {
      locale: 'fr',
      preferences: {
        learningPace: 'medium',
        interactionStyle: 'formal',
        feedbackStyle: 'direct',
        culturalReferences: true,
        localExamples: true,
        timeFormat: '24h',
        dateFormat: 'dd/mm/yyyy',
        numberFormat: 'comma'
      },
      educationalNorms: {
        respectForAuthority: 'high',
        collaborativeLearning: 'neutral',
        competitiveElements: 'encouraged',
        publicRecognition: 'valued'
      }
    });

    // German - Structured, detailed
    this.culturalAdaptations.set('de', {
      locale: 'de',
      preferences: {
        learningPace: 'slow',
        interactionStyle: 'formal',
        feedbackStyle: 'direct',
        culturalReferences: true,
        localExamples: true,
        timeFormat: '24h',
        dateFormat: 'dd.mm.yyyy',
        numberFormat: 'comma'
      },
      educationalNorms: {
        respectForAuthority: 'high',
        collaborativeLearning: 'neutral',
        competitiveElements: 'neutral',
        publicRecognition: 'neutral'
      }
    });

    // Japanese - Hierarchical, group-focused
    this.culturalAdaptations.set('ja', {
      locale: 'ja',
      preferences: {
        learningPace: 'medium',
        interactionStyle: 'formal',
        feedbackStyle: 'gentle',
        culturalReferences: true,
        localExamples: true,
        timeFormat: '24h',
        dateFormat: 'yyyy/mm/dd',
        numberFormat: 'decimal'
      },
      educationalNorms: {
        respectForAuthority: 'high',
        collaborativeLearning: 'preferred',
        competitiveElements: 'discouraged',
        publicRecognition: 'avoided'
      }
    });

    // Arabic - Respectful, community-oriented
    this.culturalAdaptations.set('ar', {
      locale: 'ar',
      preferences: {
        learningPace: 'medium',
        interactionStyle: 'formal',
        feedbackStyle: 'encouraging',
        culturalReferences: true,
        localExamples: true,
        timeFormat: '12h',
        dateFormat: 'dd/mm/yyyy',
        numberFormat: 'decimal'
      },
      educationalNorms: {
        respectForAuthority: 'high',
        collaborativeLearning: 'preferred',
        competitiveElements: 'neutral',
        publicRecognition: 'valued'
      }
    });
  }

  public getCulturalAdaptation(locale: Locale): CulturalAdaptation {
    return this.culturalAdaptations.get(locale) || this.culturalAdaptations.get('en')!;
  }

  public async getLocalizedContent(contentId: string, locale: Locale): Promise<LocalizedContent[]> {
    const cacheKey = `${contentId}-${locale}`;
    
    if (this.contentCache.has(cacheKey)) {
      return this.contentCache.get(cacheKey)!;
    }

    // In a real implementation, this would fetch from a database
    const content = await this.fetchContentFromDatabase(contentId, locale);
    this.contentCache.set(cacheKey, content);
    
    return content;
  }

  private async fetchContentFromDatabase(contentId: string, locale: Locale): Promise<LocalizedContent[]> {
    // Mock implementation - in real app, this would be a database query
    return [
      {
        id: contentId,
        locale,
        title: this.getLocalizedTitle(contentId, locale),
        description: this.getLocalizedDescription(contentId, locale),
        content: this.getLocalizedContentText(contentId, locale),
        metadata: {
          difficulty: 'intermediate',
          category: 'programming',
          duration: 30,
          culturalContext: this.getCulturalContext(locale),
          learningStyle: 'visual'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  private getLocalizedTitle(contentId: string, locale: Locale): string {
    const titles: Record<Locale, string> = {
      en: 'Introduction to Programming',
      es: 'Introducción a la Programación',
      fr: 'Introduction à la Programmation',
      de: 'Einführung in die Programmierung',
      ja: 'プログラミング入門',
      ar: 'مقدمة في البرمجة'
    };
    return titles[locale] || titles.en;
  }

  private getLocalizedDescription(contentId: string, locale: Locale): string {
    const descriptions: Record<Locale, string> = {
      en: 'Learn the fundamentals of programming with practical examples',
      es: 'Aprende los fundamentos de la programación con ejemplos prácticos',
      fr: 'Apprenez les fondamentaux de la programmation avec des exemples pratiques',
      de: 'Lernen Sie die Grundlagen der Programmierung mit praktischen Beispielen',
      ja: '実践的な例でプログラミングの基礎を学ぶ',
      ar: 'تعلم أساسيات البرمجة مع أمثلة عملية'
    };
    return descriptions[locale] || descriptions.en;
  }

  private getLocalizedContentText(contentId: string, locale: Locale): string {
    // This would contain the full lesson content adapted for the locale
    return `Localized content for ${locale}`;
  }

  private getCulturalContext(locale: Locale): string {
    const contexts: Record<Locale, string> = {
      en: 'Western individualistic approach',
      es: 'Hispanic collaborative learning',
      fr: 'French analytical methodology',
      de: 'German systematic approach',
      ja: 'Japanese group-oriented learning',
      ar: 'Arab respectful learning tradition'
    };
    return contexts[locale] || contexts.en;
  }

  public adaptContentForCulture(content: LocalizedContent, locale: Locale): LocalizedContent {
    const adaptation = this.getCulturalAdaptation(locale);
    
    // Apply cultural adaptations to content
    const adaptedContent = { ...content };
    
    // Adjust difficulty progression based on cultural learning pace
    if (adaptation.preferences.learningPace === 'slow') {
      adaptedContent.metadata.duration = Math.floor(content.metadata.duration * 1.3);
    } else if (adaptation.preferences.learningPace === 'fast') {
      adaptedContent.metadata.duration = Math.floor(content.metadata.duration * 0.8);
    }

    // Add cultural context examples
    if (adaptation.preferences.localExamples) {
      adaptedContent.content = this.addLocalExamples(content.content, locale);
    }

    return adaptedContent;
  }

  private addLocalExamples(content: string, locale: Locale): string {
    // Add locale-specific examples to the content
    const examples: Record<Locale, string> = {
      en: 'For example, like ordering coffee at Starbucks...',
      es: 'Por ejemplo, como pedir café en una cafetería local...',
      fr: 'Par exemple, comme commander un café dans un café parisien...',
      de: 'Zum Beispiel, wie das Bestellen von Kaffee in einem deutschen Café...',
      ja: '例えば、日本のコーヒーショップでコーヒーを注文するように...',
      ar: 'على سبيل المثال، مثل طلب القهوة في المقهى المحلي...'
    };
    
    return content + '\n\n' + examples[locale];
  }

  public getFormattingRules(locale: Locale) {
    const adaptation = this.getCulturalAdaptation(locale);
    return {
      timeFormat: adaptation.preferences.timeFormat,
      dateFormat: adaptation.preferences.dateFormat,
      numberFormat: adaptation.preferences.numberFormat,
      isRTL: locale === 'ar'
    };
  }
}