import { cacheManager, CacheOptions } from './cache';
import { executeRedisCommand } from './redis-client';
import { env } from './env-validation';
import type { AdaptiveContent, ContentVariant, LearningProfile, LearningSession } from '@/types';

// ====================
// TYPES AND INTERFACES
// ====================

export interface ContentCacheEntry {
  contentId: string;
  content: AdaptiveContent;
  variants: Map<string, ContentVariant>;
  adaptations: Map<string, UserContentAdaptation>;
  metadata: ContentCacheMetadata;
  versioning: ContentVersion;
  dependencies: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
  lastAccessed: number;
  accessCount: number;
}

export interface UserContentAdaptation {
  userId: string;
  contentId: string;
  selectedVariant: ContentVariant;
  adaptedDifficulty: number;
  personalizedContent: any;
  adaptationReason: string;
  confidence: number;
  performance: number[];
  engagement: number[];
  completionRate: number;
  timeSpent: number;
  lastInteraction: number;
  adaptationHistory: AdaptationRecord[];
}

export interface AdaptationRecord {
  timestamp: number;
  type: 'difficulty' | 'style' | 'pace' | 'content';
  from: any;
  to: any;
  reason: string;
  confidence: number;
  effectiveness?: number;
}

export interface ContentCacheMetadata {
  difficulty: number;
  estimatedDuration: number;
  popularity: number;
  effectiveness: number;
  averageRating: number;
  completionRate: number;
  prerequisitesMet: boolean;
  lastModified: number;
  authorId: string;
  subjectArea: string;
  bloomsLevel: string;
  cognitiveLoad: number;
}

export interface ContentVersion {
  version: string;
  hash: string;
  changelog: string[];
  migrationsNeeded: string[];
  compatibilityInfo: {
    minVersion: string;
    maxVersion: string;
    deprecated: boolean;
    replacementId?: string;
  };
}

export interface ContentInvalidationRule {
  pattern: string;
  triggers: InvalidationTrigger[];
  strategy: 'immediate' | 'lazy' | 'scheduled';
  dependencies: string[];
  cascade: boolean;
  priority: number;
}

export interface InvalidationTrigger {
  type: 'time' | 'usage' | 'performance' | 'content_change' | 'user_action';
  condition: any;
  threshold?: number;
  action: 'invalidate' | 'refresh' | 'update';
}

export interface ContentCacheStats {
  totalContent: number;
  cachedContent: number;
  adaptations: number;
  hitRate: number;
  avgAdaptationTime: number;
  popularContent: { contentId: string; accessCount: number; }[];
  ineffectiveContent: { contentId: string; effectiveness: number; }[];
  cacheSize: number;
  compressionRatio: number;
  invalidationCount: number;
  refreshCount: number;
}

export interface ContentQueryOptions {
  includeVariants?: boolean;
  includeAdaptations?: boolean;
  userId?: string;
  tags?: string[];
  difficulty?: { min: number; max: number };
  subject?: string;
  sortBy?: 'popularity' | 'effectiveness' | 'lastAccessed' | 'difficulty';
  limit?: number;
  offset?: number;
}

// ====================
// CONTENT CACHE MANAGER
// ====================

export class ContentCacheManager {
  private static instance: ContentCacheManager;
  private namespace = 'content';
  private adaptationNamespace = 'adaptations';
  private indexNamespace = 'content_index';
  private invalidationRules: Map<string, ContentInvalidationRule> = new Map();
  private defaultTTL: number;
  private longTTL: number;
  private adaptationTTL: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private invalidationInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.defaultTTL = env.CACHE_TTL_LONG; // 2 hours for content
    this.longTTL = env.CACHE_TTL_LONG * 4; // 8 hours for stable content
    this.adaptationTTL = env.CACHE_TTL_MEDIUM; // 30 minutes for adaptations
    
    this.initializeInvalidationRules();
    this.startInvalidationJobs();
    this.startStatsCollection();
  }

  public static getInstance(): ContentCacheManager {
    if (!ContentCacheManager.instance) {
      ContentCacheManager.instance = new ContentCacheManager();
    }
    return ContentCacheManager.instance;
  }

  private initializeInvalidationRules(): void {
    // Rule for content that changes frequently
    this.invalidationRules.set('dynamic_content', {
      pattern: 'content:dynamic:*',
      triggers: [
        { type: 'time', condition: 'hourly', action: 'refresh' },
        { type: 'usage', condition: { threshold: 100 }, action: 'update' }
      ],
      strategy: 'immediate',
      dependencies: [],
      cascade: true,
      priority: 1,
    });

    // Rule for user adaptations
    this.invalidationRules.set('user_adaptations', {
      pattern: 'adaptations:*',
      triggers: [
        { type: 'performance', condition: { significant_change: 0.2 }, action: 'invalidate' },
        { type: 'time', condition: 'daily', action: 'refresh' }
      ],
      strategy: 'lazy',
      dependencies: ['content', 'user_profile'],
      cascade: false,
      priority: 2,
    });

    // Rule for static content
    this.invalidationRules.set('static_content', {
      pattern: 'content:static:*',
      triggers: [
        { type: 'content_change', condition: 'version_update', action: 'invalidate' }
      ],
      strategy: 'immediate',
      dependencies: [],
      cascade: true,
      priority: 3,
    });

    // Rule for assessment content
    this.invalidationRules.set('assessment_content', {
      pattern: 'content:assessment:*',
      triggers: [
        { type: 'usage', condition: { max_views: 5 }, action: 'invalidate' },
        { type: 'time', condition: 'session_end', action: 'refresh' }
      ],
      strategy: 'immediate',
      dependencies: ['user_session'],
      cascade: false,
      priority: 1,
    });
  }

  /**
   * Store content in cache
   */
  public async setContent(
    content: AdaptiveContent,
    options: { 
      ttl?: number; 
      tags?: string[]; 
      metadata?: Partial<ContentCacheMetadata>;
      version?: string;
    } = {}
  ): Promise<boolean> {
    try {
      const now = Date.now();
      const contentTTL = options.ttl || this.getTTLForContent(content);
      
      const cacheEntry: ContentCacheEntry = {
        contentId: content.id,
        content,
        variants: new Map(),
        adaptations: new Map(),
        metadata: {
          difficulty: content.difficulty,
          estimatedDuration: content.estimatedDuration,
          popularity: 0,
          effectiveness: 0.5,
          averageRating: 0,
          completionRate: 0,
          prerequisitesMet: true,
          lastModified: now,
          authorId: 'system',
          subjectArea: 'general',
          bloomsLevel: content.metadata?.bloomsTaxonomyLevel || 'remember',
          cognitiveLoad: content.metadata?.cognitiveLoad || 5,
          ...options.metadata,
        },
        versioning: {
          version: options.version || '1.0',
          hash: this.generateContentHash(content),
          changelog: [],
          migrationsNeeded: [],
          compatibilityInfo: {
            minVersion: '1.0',
            maxVersion: '999.0',
            deprecated: false,
          },
        },
        dependencies: content.prerequisites || [],
        tags: [
          ...(options.tags || []),
          `difficulty:${content.difficulty}`,
          `subject:${content.metadata?.tags?.[0] || 'general'}`,
          `type:${content.contentVariants[0]?.type || 'text'}`,
        ],
        createdAt: now,
        updatedAt: now,
        lastAccessed: now,
        accessCount: 0,
      };

      // Store content variants
      if (content.contentVariants) {
        for (const variant of content.contentVariants) {
          cacheEntry.variants.set(variant.id, variant);
        }
      }

      const cacheOptions: CacheOptions = {
        namespace: this.namespace,
        ttl: contentTTL,
        tags: cacheEntry.tags,
        version: cacheEntry.versioning.version,
      };

      const success = await cacheManager.set(content.id, cacheEntry, cacheOptions);
      
      if (success) {
        await this.updateContentIndex(content.id, cacheEntry);
        console.log(`✅ Cached content ${content.id} with TTL ${contentTTL}s`);
      }
      
      return success;
    } catch (error) {
      console.error('❌ Failed to cache content:', error);
      return false;
    }
  }

  /**
   * Get content from cache
   */
  public async getContent(
    contentId: string,
    options: ContentQueryOptions = {}
  ): Promise<ContentCacheEntry | null> {
    try {
      const cacheOptions: CacheOptions = { namespace: this.namespace };
      const entry = await cacheManager.get<ContentCacheEntry>(contentId, cacheOptions);
      
      if (!entry) {
        return null;
      }

      // Update access statistics
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      
      // Update cache with new stats (fire and forget)
      this.updateContentStats(entry);

      return entry;
    } catch (error) {
      console.error('❌ Failed to get content from cache:', error);
      return null;
    }
  }

  /**
   * Get or create user-specific content adaptation
   */
  public async getOrCreateAdaptation(
    contentId: string,
    userId: string,
    learningProfile: LearningProfile,
    recentSessions: LearningSession[]
  ): Promise<UserContentAdaptation | null> {
    try {
      const adaptationKey = `${contentId}:${userId}`;
      const cacheOptions: CacheOptions = { namespace: this.adaptationNamespace };
      
      // Try to get existing adaptation
      let adaptation = await cacheManager.get<UserContentAdaptation>(adaptationKey, cacheOptions);
      
      if (adaptation) {
        // Check if adaptation needs refresh
        const shouldRefresh = this.shouldRefreshAdaptation(adaptation, learningProfile, recentSessions);
        if (!shouldRefresh) {
          adaptation.lastInteraction = Date.now();
          return adaptation;
        }
      }

      // Get content for adaptation
      const contentEntry = await this.getContent(contentId);
      if (!contentEntry) {
        return null;
      }

      // Create new adaptation
      adaptation = await this.createContentAdaptation(
        contentEntry,
        userId,
        learningProfile,
        recentSessions,
        adaptation
      );

      // Cache the adaptation
      await cacheManager.set(adaptationKey, adaptation, {
        ...cacheOptions,
        ttl: this.adaptationTTL,
        tags: ['adaptation', `user:${userId}`, `content:${contentId}`],
      });

      return adaptation;
    } catch (error) {
      console.error('❌ Failed to get/create adaptation:', error);
      return null;
    }
  }

  /**
   * Update user adaptation based on performance
   */
  public async updateAdaptation(
    contentId: string,
    userId: string,
    performanceData: {
      score: number;
      timeSpent: number;
      engagement: number;
      completed: boolean;
      interactions: any[];
    }
  ): Promise<boolean> {
    try {
      const adaptationKey = `${contentId}:${userId}`;
      const cacheOptions: CacheOptions = { namespace: this.adaptationNamespace };
      
      const adaptation = await cacheManager.get<UserContentAdaptation>(adaptationKey, cacheOptions);
      if (!adaptation) {
        return false;
      }

      // Update performance metrics
      adaptation.performance.push(performanceData.score);
      adaptation.engagement.push(performanceData.engagement);
      adaptation.timeSpent += performanceData.timeSpent;
      adaptation.lastInteraction = Date.now();

      // Keep only last 10 performance records
      if (adaptation.performance.length > 10) {
        adaptation.performance = adaptation.performance.slice(-10);
        adaptation.engagement = adaptation.engagement.slice(-10);
      }

      // Update completion rate
      if (performanceData.completed) {
        adaptation.completionRate = Math.min(1, adaptation.completionRate + 0.1);
      }

      // Check if adaptation needs adjustment
      const needsAdjustment = this.needsAdaptationAdjustment(adaptation, performanceData);
      if (needsAdjustment) {
        await this.adjustAdaptation(adaptation, performanceData);
      }

      // Save updated adaptation
      await cacheManager.set(adaptationKey, adaptation, {
        ...cacheOptions,
        ttl: this.adaptationTTL,
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to update adaptation:', error);
      return false;
    }
  }

  /**
   * Invalidate content by ID
   */
  public async invalidateContent(contentId: string, cascade: boolean = true): Promise<boolean> {
    try {
      const options: CacheOptions = { namespace: this.namespace };
      
      // Get content entry to find dependencies
      const entry = await cacheManager.get<ContentCacheEntry>(contentId, options);
      
      // Delete main content
      const deleted = await cacheManager.delete(contentId, options);
      
      if (cascade && entry) {
        // Invalidate dependent content
        for (const depId of entry.dependencies) {
          await this.invalidateContent(depId, false);
        }
        
        // Invalidate all user adaptations for this content
        await this.invalidateContentAdaptations(contentId);
      }
      
      // Remove from index
      await this.removeFromContentIndex(contentId);
      
      console.log(`✅ Invalidated content ${contentId}${cascade ? ' (with cascade)' : ''}`);
      return deleted;
    } catch (error) {
      console.error('❌ Failed to invalidate content:', error);
      return false;
    }
  }

  /**
   * Invalidate content by tags
   */
  public async invalidateByTags(tags: string[]): Promise<number> {
    try {
      return await cacheManager.deleteByTags(tags, { namespace: this.namespace });
    } catch (error) {
      console.error('❌ Failed to invalidate by tags:', error);
      return 0;
    }
  }

  /**
   * Invalidate content by pattern
   */
  public async invalidateByPattern(pattern: string): Promise<number> {
    try {
      return await cacheManager.deleteByPattern(pattern, { namespace: this.namespace });
    } catch (error) {
      console.error('❌ Failed to invalidate by pattern:', error);
      return 0;
    }
  }

  /**
   * Refresh content from source
   */
  public async refreshContent(contentId: string, newContent: AdaptiveContent): Promise<boolean> {
    try {
      // Get existing entry
      const existing = await this.getContent(contentId);
      
      if (existing) {
        // Check if content has actually changed
        const newHash = this.generateContentHash(newContent);
        if (existing.versioning.hash === newHash) {
          // Content unchanged, just update access time
          return true;
        }
        
        // Create version info
        const version = this.incrementVersion(existing.versioning.version);
        const changelog = this.generateChangelog(existing.content, newContent);
        
        // Update content with new version
        return await this.setContent(newContent, {
          ttl: this.getTTLForContent(newContent),
          tags: existing.tags,
          metadata: existing.metadata,
          version,
        });
      } else {
        // New content
        return await this.setContent(newContent);
      }
    } catch (error) {
      console.error('❌ Failed to refresh content:', error);
      return false;
    }
  }

  /**
   * Get content statistics
   */
  public async getContentStats(): Promise<ContentCacheStats> {
    try {
      // This would typically aggregate data from the cache
      const totalContent = await this.getTotalContentCount();
      const cachedContent = await this.getCachedContentCount();
      const adaptations = await this.getAdaptationCount();
      
      return {
        totalContent,
        cachedContent,
        adaptations,
        hitRate: cachedContent > 0 ? (cachedContent / totalContent) * 100 : 0,
        avgAdaptationTime: 0, // Would calculate from metrics
        popularContent: await this.getPopularContent(),
        ineffectiveContent: await this.getIneffectiveContent(),
        cacheSize: 0, // Would calculate actual size
        compressionRatio: 0.3, // Estimated compression ratio
        invalidationCount: 0, // Would track invalidations
        refreshCount: 0, // Would track refreshes
      };
    } catch (error) {
      console.error('❌ Failed to get content stats:', error);
      return {
        totalContent: 0,
        cachedContent: 0,
        adaptations: 0,
        hitRate: 0,
        avgAdaptationTime: 0,
        popularContent: [],
        ineffectiveContent: [],
        cacheSize: 0,
        compressionRatio: 0,
        invalidationCount: 0,
        refreshCount: 0,
      };
    }
  }

  /**
   * Search cached content
   */
  public async searchContent(query: string, options: ContentQueryOptions = {}): Promise<ContentCacheEntry[]> {
    try {
      // This is a simplified implementation
      // In production, you'd want proper search indexing
      const pattern = `${this.namespace}:*`;
      const keys = await executeRedisCommand<string[]>('keys', [pattern]);
      
      if (!keys || keys.length === 0) {
        return [];
      }
      
      const results: ContentCacheEntry[] = [];
      
      for (const key of keys) {
        const contentId = key.replace(`${this.namespace}:`, '');
        const entry = await this.getContent(contentId, options);
        
        if (entry && this.matchesQuery(entry, query, options)) {
          results.push(entry);
        }
      }
      
      // Sort results
      return this.sortSearchResults(results, options);
    } catch (error) {
      console.error('❌ Content search failed:', error);
      return [];
    }
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private getTTLForContent(content: AdaptiveContent): number {
    // Dynamic TTL based on content characteristics
    const baseTTL = this.defaultTTL;
    
    // Static content gets longer TTL
    if (content.metadata?.tags?.includes('static')) {
      return this.longTTL;
    }
    
    // Assessment content gets shorter TTL
    if (content.metadata?.tags?.includes('assessment')) {
      return this.adaptationTTL;
    }
    
    // Content with low difficulty gets longer TTL
    if (content.difficulty <= 3) {
      return baseTTL * 1.5;
    }
    
    return baseTTL;
  }

  private generateContentHash(content: AdaptiveContent): string {
    // Simple hash generation - in production, use a proper hash function
    const contentString = JSON.stringify({
      title: content.title,
      description: content.description,
      difficulty: content.difficulty,
      variants: content.contentVariants?.length || 0,
    });
    
    return Buffer.from(contentString).toString('base64').slice(0, 16);
  }

  private async createContentAdaptation(
    contentEntry: ContentCacheEntry,
    userId: string,
    learningProfile: LearningProfile,
    recentSessions: LearningSession[],
    existingAdaptation?: UserContentAdaptation
  ): Promise<UserContentAdaptation> {
    // Select best variant based on learning profile
    const selectedVariant = this.selectOptimalVariant(contentEntry, learningProfile);
    
    // Adapt difficulty based on recent performance
    const adaptedDifficulty = this.calculateAdaptedDifficulty(
      contentEntry.content.difficulty,
      recentSessions,
      existingAdaptation
    );
    
    // Generate personalized content
    const personalizedContent = this.personalizeContent(
      contentEntry.content,
      selectedVariant,
      learningProfile
    );
    
    const adaptation: UserContentAdaptation = {
      userId,
      contentId: contentEntry.contentId,
      selectedVariant,
      adaptedDifficulty,
      personalizedContent,
      adaptationReason: this.generateAdaptationReason(learningProfile, selectedVariant),
      confidence: 0.8,
      performance: existingAdaptation?.performance || [],
      engagement: existingAdaptation?.engagement || [],
      completionRate: existingAdaptation?.completionRate || 0,
      timeSpent: existingAdaptation?.timeSpent || 0,
      lastInteraction: Date.now(),
      adaptationHistory: existingAdaptation?.adaptationHistory || [],
    };
    
    // Record adaptation history if this is an update
    if (existingAdaptation) {
      adaptation.adaptationHistory.push({
        timestamp: Date.now(),
        type: 'difficulty',
        from: existingAdaptation.adaptedDifficulty,
        to: adaptedDifficulty,
        reason: 'Performance-based adjustment',
        confidence: 0.8,
      });
    }
    
    return adaptation;
  }

  private selectOptimalVariant(
    contentEntry: ContentCacheEntry,
    learningProfile: LearningProfile
  ): ContentVariant {
    const variants = Array.from(contentEntry.variants.values());
    
    if (variants.length === 0) {
      throw new Error('No content variants available');
    }
    
    // Find variant that matches dominant learning style
    const dominantStyle = learningProfile.dominantStyle;
    const matchingVariant = variants.find(v => v.styleType === dominantStyle);
    
    return matchingVariant || variants[0];
  }

  private calculateAdaptedDifficulty(
    baseDifficulty: number,
    recentSessions: LearningSession[],
    existingAdaptation?: UserContentAdaptation
  ): number {
    if (recentSessions.length === 0) {
      return baseDifficulty;
    }
    
    // Calculate average performance from recent sessions
    const recentPerformance = recentSessions
      .slice(-5) // Last 5 sessions
      .reduce((sum, session) => sum + (session.correctAnswers / session.totalQuestions), 0) / 
      Math.min(recentSessions.length, 5);
    
    let adjustment = 0;
    
    if (recentPerformance > 0.8) {
      adjustment = 1; // Increase difficulty
    } else if (recentPerformance < 0.6) {
      adjustment = -1; // Decrease difficulty
    }
    
    const adaptedDifficulty = Math.max(1, Math.min(10, baseDifficulty + adjustment));
    return adaptedDifficulty;
  }

  private personalizeContent(
    content: AdaptiveContent,
    variant: ContentVariant,
    learningProfile: LearningProfile
  ): any {
    // This would implement content personalization logic
    return {
      ...content,
      selectedVariant: variant,
      personalizedTitle: this.personalizeTitle(content.title, learningProfile),
      adaptedExamples: this.adaptExamples(variant.content, learningProfile),
    };
  }

  private personalizeTitle(title: string, profile: LearningProfile): string {
    // Simple personalization - could be much more sophisticated
    return `${title} (${profile.dominantStyle} approach)`;
  }

  private adaptExamples(content: any, profile: LearningProfile): any[] {
    // Adapt examples based on learning style
    return content.examples || [];
  }

  private generateAdaptationReason(profile: LearningProfile, variant: ContentVariant): string {
    return `Selected ${variant.styleType} variant based on your ${profile.dominantStyle} learning preference`;
  }

  private shouldRefreshAdaptation(
    adaptation: UserContentAdaptation,
    learningProfile: LearningProfile,
    recentSessions: LearningSession[]
  ): boolean {
    const timeSinceLastInteraction = Date.now() - adaptation.lastInteraction;
    const oneHour = 60 * 60 * 1000;
    
    // Refresh if it's been more than an hour
    if (timeSinceLastInteraction > oneHour) {
      return true;
    }
    
    // Refresh if performance has significantly changed
    if (adaptation.performance.length >= 3) {
      const recentAvg = adaptation.performance.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const overallAvg = adaptation.performance.reduce((a, b) => a + b, 0) / adaptation.performance.length;
      
      if (Math.abs(recentAvg - overallAvg) > 0.2) {
        return true;
      }
    }
    
    return false;
  }

  private needsAdaptationAdjustment(
    adaptation: UserContentAdaptation,
    performanceData: any
  ): boolean {
    // Check if recent performance suggests need for adjustment
    if (adaptation.performance.length < 3) {
      return false;
    }
    
    const recentAvg = adaptation.performance.slice(-3).reduce((a, b) => a + b, 0) / 3;
    
    // If consistently performing well, increase difficulty
    if (recentAvg > 0.85 && adaptation.adaptedDifficulty < 10) {
      return true;
    }
    
    // If consistently struggling, decrease difficulty
    if (recentAvg < 0.6 && adaptation.adaptedDifficulty > 1) {
      return true;
    }
    
    return false;
  }

  private async adjustAdaptation(
    adaptation: UserContentAdaptation,
    performanceData: any
  ): Promise<void> {
    const recentAvg = adaptation.performance.slice(-3).reduce((a, b) => a + b, 0) / 3;
    
    if (recentAvg > 0.85 && adaptation.adaptedDifficulty < 10) {
      adaptation.adaptedDifficulty = Math.min(10, adaptation.adaptedDifficulty + 1);
      adaptation.adaptationHistory.push({
        timestamp: Date.now(),
        type: 'difficulty',
        from: adaptation.adaptedDifficulty - 1,
        to: adaptation.adaptedDifficulty,
        reason: 'High performance - increased difficulty',
        confidence: 0.9,
      });
    } else if (recentAvg < 0.6 && adaptation.adaptedDifficulty > 1) {
      adaptation.adaptedDifficulty = Math.max(1, adaptation.adaptedDifficulty - 1);
      adaptation.adaptationHistory.push({
        timestamp: Date.now(),
        type: 'difficulty',
        from: adaptation.adaptedDifficulty + 1,
        to: adaptation.adaptedDifficulty,
        reason: 'Low performance - decreased difficulty',
        confidence: 0.9,
      });
    }
  }

  private async updateContentStats(entry: ContentCacheEntry): Promise<void> {
    // Update access statistics (fire and forget)
    try {
      const cacheOptions: CacheOptions = { namespace: this.namespace };
      await cacheManager.set(entry.contentId, entry, cacheOptions);
    } catch (error) {
      // Don't throw - this is a background update
      console.warn('⚠️ Failed to update content stats:', error);
    }
  }

  private async updateContentIndex(contentId: string, entry: ContentCacheEntry): Promise<void> {
    try {
      // Update search indices
      const indexOptions: CacheOptions = { 
        namespace: this.indexNamespace,
        ttl: this.longTTL,
      };
      
      // Index by tags
      for (const tag of entry.tags) {
        const tagKey = `tag:${tag}`;
        await executeRedisCommand('sadd', [`${this.indexNamespace}:${tagKey}`, contentId]);
        await executeRedisCommand('expire', [`${this.indexNamespace}:${tagKey}`, this.longTTL]);
      }
      
      // Index by difficulty
      const difficultyKey = `difficulty:${entry.metadata.difficulty}`;
      await executeRedisCommand('sadd', [`${this.indexNamespace}:${difficultyKey}`, contentId]);
      await executeRedisCommand('expire', [`${this.indexNamespace}:${difficultyKey}`, this.longTTL]);
    } catch (error) {
      console.warn('⚠️ Failed to update content index:', error);
    }
  }

  private async removeFromContentIndex(contentId: string): Promise<void> {
    try {
      // Remove from all indices - this is a simplified cleanup
      const indexPattern = `${this.indexNamespace}:*`;
      const indexKeys = await executeRedisCommand<string[]>('keys', [indexPattern]);
      
      if (indexKeys) {
        for (const indexKey of indexKeys) {
          await executeRedisCommand('srem', [indexKey, contentId]);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to remove from content index:', error);
    }
  }

  private async invalidateContentAdaptations(contentId: string): Promise<void> {
    try {
      const pattern = `${this.adaptationNamespace}:${contentId}:*`;
      await cacheManager.deleteByPattern(pattern);
    } catch (error) {
      console.warn('⚠️ Failed to invalidate content adaptations:', error);
    }
  }

  private incrementVersion(currentVersion: string): string {
    const parts = currentVersion.split('.');
    const minor = parseInt(parts[1] || '0', 10) + 1;
    return `${parts[0]}.${minor}`;
  }

  private generateChangelog(oldContent: AdaptiveContent, newContent: AdaptiveContent): string[] {
    const changes: string[] = [];
    
    if (oldContent.title !== newContent.title) {
      changes.push(`Title changed from "${oldContent.title}" to "${newContent.title}"`);
    }
    
    if (oldContent.difficulty !== newContent.difficulty) {
      changes.push(`Difficulty changed from ${oldContent.difficulty} to ${newContent.difficulty}`);
    }
    
    return changes;
  }

  private matchesQuery(entry: ContentCacheEntry, query: string, options: ContentQueryOptions): boolean {
    const searchableText = [
      entry.content.title,
      entry.content.description,
      ...entry.tags,
    ].join(' ').toLowerCase();
    
    return searchableText.includes(query.toLowerCase());
  }

  private sortSearchResults(results: ContentCacheEntry[], options: ContentQueryOptions): ContentCacheEntry[] {
    const sortBy = options.sortBy || 'popularity';
    
    return results.sort((a, b) => {
      switch (sortBy) {
        case 'popularity':
          return b.accessCount - a.accessCount;
        case 'effectiveness':
          return b.metadata.effectiveness - a.metadata.effectiveness;
        case 'lastAccessed':
          return b.lastAccessed - a.lastAccessed;
        case 'difficulty':
          return a.metadata.difficulty - b.metadata.difficulty;
        default:
          return 0;
      }
    });
  }

  private async getTotalContentCount(): Promise<number> {
    try {
      const pattern = `${this.namespace}:*`;
      const keys = await executeRedisCommand<string[]>('keys', [pattern]);
      return keys?.length || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getCachedContentCount(): Promise<number> {
    return this.getTotalContentCount(); // Same as total for now
  }

  private async getAdaptationCount(): Promise<number> {
    try {
      const pattern = `${this.adaptationNamespace}:*`;
      const keys = await executeRedisCommand<string[]>('keys', [pattern]);
      return keys?.length || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getPopularContent(): Promise<{ contentId: string; accessCount: number; }[]> {
    // This would require more sophisticated tracking
    return [];
  }

  private async getIneffectiveContent(): Promise<{ contentId: string; effectiveness: number; }[]> {
    // This would require performance tracking
    return [];
  }

  private startInvalidationJobs(): void {
    // Run invalidation checks every 5 minutes
    this.invalidationInterval = setInterval(async () => {
      await this.processInvalidationRules();
    }, 5 * 60 * 1000);
  }

  private startStatsCollection(): void {
    // Collect stats every 10 minutes
    this.statsInterval = setInterval(async () => {
      await this.collectContentStats();
    }, 10 * 60 * 1000);
  }

  private async processInvalidationRules(): Promise<void> {
    for (const [ruleName, rule] of this.invalidationRules) {
      try {
        await this.processRule(rule);
      } catch (error) {
        console.error(`❌ Failed to process invalidation rule ${ruleName}:`, error);
      }
    }
  }

  private async processRule(rule: ContentInvalidationRule): Promise<void> {
    // This would implement the actual rule processing logic
    // For now, it's a placeholder
    console.log(`🔄 Processing invalidation rule: ${rule.pattern}`);
  }

  private async collectContentStats(): Promise<void> {
    try {
      const stats = await this.getContentStats();
      console.log(`📊 Content cache stats - Cached: ${stats.cachedContent}, Hit rate: ${stats.hitRate.toFixed(2)}%`);
    } catch (error) {
      console.error('❌ Failed to collect content stats:', error);
    }
  }

  /**
   * Shutdown cleanup
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.invalidationInterval) {
      clearInterval(this.invalidationInterval);
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const contentCache = ContentCacheManager.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Cache content
 */
export async function cacheContent(content: AdaptiveContent, options?: any): Promise<boolean> {
  return contentCache.setContent(content, options);
}

/**
 * Get cached content
 */
export async function getCachedContent(contentId: string, options?: ContentQueryOptions): Promise<ContentCacheEntry | null> {
  return contentCache.getContent(contentId, options);
}

/**
 * Get user adaptation
 */
export async function getUserAdaptation(
  contentId: string,
  userId: string,
  learningProfile: LearningProfile,
  recentSessions: LearningSession[]
): Promise<UserContentAdaptation | null> {
  return contentCache.getOrCreateAdaptation(contentId, userId, learningProfile, recentSessions);
}

/**
 * Update adaptation
 */
export async function updateUserAdaptation(
  contentId: string,
  userId: string,
  performanceData: any
): Promise<boolean> {
  return contentCache.updateAdaptation(contentId, userId, performanceData);
}

/**
 * Invalidate content
 */
export async function invalidateContent(contentId: string, cascade?: boolean): Promise<boolean> {
  return contentCache.invalidateContent(contentId, cascade);
}

/**
 * Search content
 */
export async function searchCachedContent(query: string, options?: ContentQueryOptions): Promise<ContentCacheEntry[]> {
  return contentCache.searchContent(query, options);
}

export default contentCache;