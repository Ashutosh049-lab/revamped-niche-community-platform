import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit as limitQuery, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface UserProfile {
  id: string;
  interests: string[];
  experience: string;
  followedCommunities: string[];
  engagementHistory: {
    [contentId: string]: {
      type: 'like' | 'comment' | 'share' | 'view';
      timestamp: Date;
      duration?: number; // for views
    }
  };
  preferences: {
    contentTypes: string[];
    timePreference: 'recent' | 'popular' | 'mixed';
    diversityFactor: number; // 0-1, higher means more diverse recommendations
  };
}

export interface ContentItem {
  id: string;
  type: 'post' | 'comment' | 'community' | 'user';
  title?: string;
  content: string;
  tags: string[];
  category: string;
  authorId: string;
  communityId?: string;
  createdAt: Date;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  quality: {
    score: number; // 0-1, calculated based on various factors
    factors: string[]; // what contributed to the score
  };
}

export interface Recommendation {
  contentId: string;
  contentType: 'post' | 'comment' | 'community' | 'user';
  title: string;
  description: string;
  relevanceScore: number; // 0-1
  reasons: string[]; // why this was recommended
  tags: string[];
  author: {
    id: string;
    name: string;
    photoURL?: string;
  };
  metadata: {
    createdAt: Date;
    engagement: number;
    quality: number;
    freshness: number;
    diversity: number;
  };
}

export interface RecommendationContext {
  userId: string;
  currentContent?: string; // current post/page for contextual recommendations
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  sessionActivity: string[]; // what user has done this session
  limit: number;
  type?: 'general' | 'contextual' | 'discovery' | 'trending';
}

class SmartRecommendationService {
  private openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
  
  // Content quality weights
  private qualityWeights = {
    engagement: 0.3,
    authorReputation: 0.2,
    contentLength: 0.15,
    tags: 0.1,
    freshness: 0.15,
    communityActivity: 0.1
  };

  // Recommendation algorithm weights
  private recommendationWeights = {
    userInterests: 0.25,
    contentQuality: 0.2,
    socialSignals: 0.2,
    freshness: 0.15,
    diversity: 0.1,
    contextualRelevance: 0.1
  };

  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    try {
      const userProfile = await this.getUserProfile(context.userId);
      if (!userProfile) return [];

      // Get candidate content based on recommendation type
      const candidates = await this.getCandidateContent(context, userProfile);
      
      // Score and rank candidates
      const scoredRecommendations = await this.scoreAndRankContent(
        candidates, 
        userProfile, 
        context
      );

      // Apply diversity and freshness filters
      const diversifiedRecommendations = this.diversifyRecommendations(
        scoredRecommendations,
        userProfile.preferences.diversityFactor
      );

      // Format final recommendations
      const recommendations = await this.formatRecommendations(
        diversifiedRecommendations.slice(0, context.limit)
      );

      // Log recommendation interaction for learning
      await this.logRecommendations(context.userId, recommendations);

      return recommendations;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Get content recommendations similar to a specific post
   */
  async getSimilarContent(postId: string, userId: string, limit: number = 10): Promise<Recommendation[]> {
    try {
      const postDoc = await getDoc(doc(db, 'posts', postId));
      if (!postDoc.exists()) return [];

      const post = postDoc.data();
      const userProfile = await this.getUserProfile(userId);

      // Find content with similar tags, category, or semantic similarity
      const candidates = await this.findSimilarContent(post, limit * 3);
      
      // Score based on similarity and user preferences
      const scored = await this.scoreSimilarityRecommendations(candidates, post, userProfile);
      
      return await this.formatRecommendations(scored.slice(0, limit));
    } catch (error) {
      console.error('Error getting similar content:', error);
      return [];
    }
  }

  /**
   * Get community recommendations for a user
   */
  async getCommunityRecommendations(userId: string, limit: number = 5): Promise<Recommendation[]> {
    try {
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) return [];

      // Get communities user hasn't joined yet
      const candidatesQuery = query(
        collection(db, 'communities'),
        orderBy('memberCount', 'desc'),
        limitQuery(50)
      );

      const snapshot = await getDocs(candidatesQuery);
      const allCommunities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter out already joined communities
      const candidates = allCommunities.filter(
        community => !userProfile.followedCommunities.includes(community.id)
      );

      // Score communities based on user interests and activity
      const scoredCommunities = this.scoreCommunityRecommendations(candidates, userProfile);
      
      return scoredCommunities.slice(0, limit).map(community => ({
        contentId: community.id,
        contentType: 'community' as const,
        title: community.name,
        description: community.description,
        relevanceScore: community.score,
        reasons: community.reasons,
        tags: community.tags || [],
        author: {
          id: community.createdBy,
          name: community.creatorName || 'Unknown',
        },
        metadata: {
          createdAt: community.createdAt?.toDate() || new Date(),
          engagement: community.memberCount || 0,
          quality: community.activityScore || 0.5,
          freshness: this.calculateFreshness(community.createdAt?.toDate() || new Date()),
          diversity: 0.5
        }
      }));
    } catch (error) {
      console.error('Error getting community recommendations:', error);
      return [];
    }
  }

  /**
   * Get trending content with personalization
   */
  async getTrendingRecommendations(userId: string, timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<Recommendation[]> {
    try {
      const userProfile = await this.getUserProfile(userId);
      const timeThreshold = this.getTimeThreshold(timeframe);

      const trendingQuery = query(
        collection(db, 'posts'),
        where('createdAt', '>=', timeThreshold),
        orderBy('engagementScore', 'desc'),
        limitQuery(50)
      );

      const snapshot = await getDocs(trendingQuery);
      const trendingPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Personalize trending content based on user interests
      const personalizedTrending = this.personalizeTrendingContent(trendingPosts, userProfile);
      
      return await this.formatRecommendations(personalizedTrending.slice(0, 20));
    } catch (error) {
      console.error('Error getting trending recommendations:', error);
      return [];
    }
  }

  /**
   * Learn from user interactions to improve recommendations
   */
  async recordInteraction(
    userId: string, 
    contentId: string, 
    interactionType: 'view' | 'like' | 'comment' | 'share' | 'hide' | 'report',
    duration?: number
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      const interactionData = {
        type: interactionType,
        timestamp: new Date(),
        duration: duration || 0
      };

      // Update user's engagement history
      await updateDoc(userRef, {
        [`engagementHistory.${contentId}`]: interactionData,
        lastActiveAt: new Date()
      });

      // Update content engagement metrics
      const contentRef = doc(db, 'posts', contentId);
      const updateData: any = {};
      
      if (interactionType === 'like') {
        updateData[`engagement.likes`] = updateData[`engagement.likes`] || 0 + 1;
      } else if (interactionType === 'view') {
        updateData[`engagement.views`] = updateData[`engagement.views`] || 0 + 1;
      } else if (interactionType === 'comment') {
        updateData[`engagement.comments`] = updateData[`engagement.comments`] || 0 + 1;
      } else if (interactionType === 'share') {
        updateData[`engagement.shares`] = updateData[`engagement.shares`] || 0 + 1;
      }

      if (Object.keys(updateData).length > 0) {
        await updateDoc(contentRef, updateData);
      }

      // Use this data to refine user's interest profile
      await this.updateUserInterestProfile(userId, contentId);
    } catch (error) {
      console.error('Error recording interaction:', error);
    }
  }

  /**
   * Generate AI-powered content summaries and insights
   */
  async generateContentInsights(contentIds: string[]): Promise<{ [contentId: string]: any }> {
    if (!this.openaiApiKey) return {};

    try {
      const insights: { [contentId: string]: any } = {};
      
      // Process in batches to avoid rate limits
      for (const contentId of contentIds.slice(0, 10)) {
        const postDoc = await getDoc(doc(db, 'posts', contentId));
        if (!postDoc.exists()) continue;

        const post = postDoc.data();
        const content = post.content;

        // Generate AI insights
        const prompt = `Analyze this community post and provide insights:

Content: "${content}"

Please provide:
1. Main topics/themes (3-5 keywords)
2. Sentiment (positive/neutral/negative)
3. Engagement potential (high/medium/low)
4. Target audience
5. Content quality score (1-10)

Format as JSON.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          try {
            insights[contentId] = JSON.parse(data.choices[0].message.content);
          } catch {
            insights[contentId] = { topics: [], sentiment: 'neutral', quality: 5 };
          }
        }
      }

      return insights;
    } catch (error) {
      console.error('Error generating content insights:', error);
      return {};
    }
  }

  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return null;

      const userData = userDoc.data();
      return {
        id: userId,
        interests: userData.interests || [],
        experience: userData.experience || 'beginner',
        followedCommunities: userData.followedCommunities || [],
        engagementHistory: userData.engagementHistory || {},
        preferences: {
          contentTypes: userData.preferences?.contentTypes || ['post', 'discussion'],
          timePreference: userData.preferences?.timePreference || 'mixed',
          diversityFactor: userData.preferences?.diversityFactor || 0.6
        }
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  private async getCandidateContent(
    _context: RecommendationContext,
    userProfile: UserProfile
  ): Promise<ContentItem[]> {
    const candidates: ContentItem[] = [];

    try {
      // Get content from followed communities
      if (userProfile.followedCommunities.length > 0) {
        const communityQuery = query(
          collection(db, 'posts'),
          where('communityId', 'in', userProfile.followedCommunities.slice(0, 10)),
          orderBy('createdAt', 'desc'),
          limitQuery(100)
        );
        
        const communitySnapshot = await getDocs(communityQuery);
        candidates.push(...this.formatCandidates(communitySnapshot.docs));
      }

      // Get content based on user interests
      if (userProfile.interests.length > 0) {
        const interestQuery = query(
          collection(db, 'posts'),
          where('tags', 'array-contains-any', userProfile.interests.slice(0, 10)),
          orderBy('engagementScore', 'desc'),
          limitQuery(50)
        );
        
        const interestSnapshot = await getDocs(interestQuery);
        candidates.push(...this.formatCandidates(interestSnapshot.docs));
      }

      // Get generally popular content
      const popularQuery = query(
        collection(db, 'posts'),
        orderBy('engagementScore', 'desc'),
        limitQuery(30)
      );
      
      const popularSnapshot = await getDocs(popularQuery);
      candidates.push(...this.formatCandidates(popularSnapshot.docs));

      // Remove duplicates
      const uniqueCandidates = candidates.reduce((acc, candidate) => {
        if (!acc.find(c => c.id === candidate.id)) {
          acc.push(candidate);
        }
        return acc;
      }, [] as ContentItem[]);

      return uniqueCandidates;
    } catch (error) {
      console.error('Error getting candidate content:', error);
      return [];
    }
  }

  private formatCandidates(docs: any[]): ContentItem[] {
    return docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: 'post',
        title: data.title,
        content: data.content,
        tags: data.tags || [],
        category: data.category || 'general',
        authorId: data.authorId,
        communityId: data.communityId,
        createdAt: data.createdAt?.toDate() || new Date(),
        engagement: {
          likes: data.likes || 0,
          comments: data.commentCount || 0,
          shares: data.shares || 0,
          views: data.views || 0
        },
        quality: {
          score: this.calculateContentQuality(data),
          factors: []
        }
      };
    });
  }

  private async scoreAndRankContent(
    candidates: ContentItem[],
    userProfile: UserProfile,
    context: RecommendationContext
  ): Promise<Array<ContentItem & { score: number; reasons: string[] }>> {
    return candidates.map(candidate => {
      const scores = {
        interests: this.calculateInterestScore(candidate, userProfile),
        quality: candidate.quality.score,
        social: this.calculateSocialScore(candidate),
        freshness: this.calculateFreshness(candidate.createdAt),
        diversity: this.calculateDiversityScore(candidate, userProfile),
        contextual: this.calculateContextualScore(candidate, context)
      };

      const finalScore = (
        scores.interests * this.recommendationWeights.userInterests +
        scores.quality * this.recommendationWeights.contentQuality +
        scores.social * this.recommendationWeights.socialSignals +
        scores.freshness * this.recommendationWeights.freshness +
        scores.diversity * this.recommendationWeights.diversity +
        scores.contextual * this.recommendationWeights.contextualRelevance
      );

      const reasons = [];
      if (scores.interests > 0.7) reasons.push('Matches your interests');
      if (scores.quality > 0.8) reasons.push('High quality content');
      if (scores.social > 0.7) reasons.push('Popular with community');
      if (scores.freshness > 0.8) reasons.push('Recently posted');

      return {
        ...candidate,
        score: finalScore,
        reasons
      };
    }).sort((a, b) => b.score - a.score);
  }

  private calculateInterestScore(candidate: ContentItem, userProfile: UserProfile): number {
    const matchingInterests = candidate.tags.filter(tag => 
      userProfile.interests.some(interest => 
        interest.toLowerCase().includes(tag.toLowerCase()) ||
        tag.toLowerCase().includes(interest.toLowerCase())
      )
    );

    if (userProfile.interests.length === 0) return 0.5;
    return Math.min(matchingInterests.length / userProfile.interests.length, 1);
  }

  private calculateContentQuality(data: any): number {
    let score = 0;

    // Content length (sweet spot around 100-500 words)
    const wordCount = (data.content || '').split(' ').length;
    const lengthScore = wordCount >= 50 && wordCount <= 1000 ? 1 : 0.5;
    score += lengthScore * this.qualityWeights.contentLength;

    // Engagement ratio
    const totalEngagement = (data.likes || 0) + (data.commentCount || 0) + (data.shares || 0);
    const views = Math.max(data.views || 1, 1);
    const engagementRate = totalEngagement / views;
    score += Math.min(engagementRate * 10, 1) * this.qualityWeights.engagement;

    // Tags quality (having relevant tags)
    const tagScore = (data.tags || []).length > 0 ? 1 : 0.3;
    score += tagScore * this.qualityWeights.tags;

    // Freshness
    const daysSincePost = (Date.now() - (data.createdAt?.toDate()?.getTime() || 0)) / (1000 * 60 * 60 * 24);
    const freshnessScore = Math.max(0, 1 - (daysSincePost / 7)); // Decay over a week
    score += freshnessScore * this.qualityWeights.freshness;

    return Math.min(score, 1);
  }

  private calculateSocialScore(candidate: ContentItem): number {
    const totalEngagement = candidate.engagement.likes + 
                           candidate.engagement.comments + 
                           candidate.engagement.shares;
    const views = Math.max(candidate.engagement.views, 1);
    
    // Normalize based on typical engagement rates
    return Math.min(totalEngagement / (views * 0.1), 1);
  }

  private calculateFreshness(createdAt: Date): number {
    const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursAgo <= 1) return 1;
    if (hoursAgo <= 6) return 0.8;
    if (hoursAgo <= 24) return 0.6;
    if (hoursAgo <= 72) return 0.4;
    if (hoursAgo <= 168) return 0.2; // 1 week
    return 0.1;
  }

  private calculateDiversityScore(_candidate: ContentItem, userProfile: UserProfile): number {
    // Check if this content type/category is different from recent interactions
    const recentInteractions = Object.entries(userProfile.engagementHistory)
      .sort(([,a], [,b]) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    // Simple diversity check - different category is more diverse
    return recentInteractions.length === 0 ? 0.5 : 0.7;
  }

  private calculateContextualScore(candidate: ContentItem, context: RecommendationContext): number {
    // Time-based context
    let score = 0.5;

    if (context.timeOfDay === 'morning' && candidate.category === 'news') score += 0.3;
    if (context.timeOfDay === 'evening' && candidate.category === 'discussion') score += 0.2;
    
    return Math.min(score, 1);
  }

  private diversifyRecommendations(
    recommendations: Array<ContentItem & { score: number; reasons: string[] }>,
    diversityFactor: number
  ): Array<ContentItem & { score: number; reasons: string[] }> {
    if (diversityFactor <= 0) return recommendations;

    const diversified = [];
    const usedCategories = new Set();
    const usedAuthors = new Set();

    for (const rec of recommendations) {
      const categoryPenalty = usedCategories.has(rec.category) ? diversityFactor * 0.3 : 0;
      const authorPenalty = usedAuthors.has(rec.authorId) ? diversityFactor * 0.2 : 0;
      
      rec.score = Math.max(0, rec.score - categoryPenalty - authorPenalty);
      
      diversified.push(rec);
      usedCategories.add(rec.category);
      usedAuthors.add(rec.authorId);
    }

    return diversified.sort((a, b) => b.score - a.score);
  }

  private async formatRecommendations(
    scoredContent: Array<ContentItem & { score: number; reasons: string[] }>
  ): Promise<Recommendation[]> {
    // Get author information for each recommendation
    const recommendations: Recommendation[] = [];
    
    for (const content of scoredContent) {
      try {
        const authorDoc = await getDoc(doc(db, 'users', content.authorId));
        const authorData = authorDoc.exists() ? authorDoc.data() : {};

        recommendations.push({
          contentId: content.id,
          contentType: content.type,
          title: content.title || content.content.substring(0, 100) + '...',
          description: content.content.substring(0, 200) + '...',
          relevanceScore: content.score,
          reasons: content.reasons,
          tags: content.tags,
          author: {
            id: content.authorId,
            name: authorData.displayName || 'Unknown User',
            photoURL: authorData.photoURL
          },
          metadata: {
            createdAt: content.createdAt,
            engagement: this.calculateSocialScore(content),
            quality: content.quality.score,
            freshness: this.calculateFreshness(content.createdAt),
            diversity: 0.5 // Placeholder
          }
        });
      } catch (error) {
        console.error('Error formatting recommendation:', error);
      }
    }

    return recommendations;
  }

  private async findSimilarContent(post: any, limit: number): Promise<ContentItem[]> {
    // Find posts with similar tags or in same community
    const similarQuery = query(
      collection(db, 'posts'),
      where('tags', 'array-contains-any', post.tags || []),
      orderBy('engagementScore', 'desc'),
      limitQuery(limit)
    );

    const snapshot = await getDocs(similarQuery);
    return this.formatCandidates(snapshot.docs.filter(doc => doc.id !== post.id));
  }

  private async scoreSimilarityRecommendations(
    candidates: ContentItem[],
    referencePost: any,
    userProfile: UserProfile | null
  ): Promise<Array<ContentItem & { score: number; reasons: string[] }>> {
    return candidates.map(candidate => {
      // Calculate similarity based on tags, category, community
      let similarityScore = 0;
      const reasons = [];

      // Tag similarity
      const commonTags = candidate.tags.filter(tag => referencePost.tags?.includes(tag));
      if (commonTags.length > 0) {
        similarityScore += 0.4;
        reasons.push('Similar topics');
      }

      // Same community
      if (candidate.communityId === referencePost.communityId) {
        similarityScore += 0.3;
        reasons.push('Same community');
      }

      // Same category
      if (candidate.category === referencePost.category) {
        similarityScore += 0.2;
        reasons.push('Similar category');
      }

      // User interest alignment
      if (userProfile) {
        const interestScore = this.calculateInterestScore(candidate, userProfile);
        similarityScore += interestScore * 0.1;
        if (interestScore > 0.5) reasons.push('Matches your interests');
      }

      return {
        ...candidate,
        score: similarityScore,
        reasons
      };
    }).sort((a, b) => b.score - a.score);
  }

  private scoreCommunityRecommendations(communities: any[], userProfile: UserProfile) {
    return communities.map(community => {
      let score = 0;
      const reasons = [];

      // Interest alignment
      const matchingInterests = (community.tags || []).filter((tag: string) =>
        userProfile.interests.some(interest => 
          interest.toLowerCase().includes(tag.toLowerCase())
        )
      );

      if (matchingInterests.length > 0) {
        score += 0.4;
        reasons.push('Matches your interests');
      }

      // Activity level
      const activityScore = Math.min((community.memberCount || 0) / 1000, 1);
      score += activityScore * 0.3;
      if (activityScore > 0.7) reasons.push('Active community');

      // Quality indicators
      if (community.description && community.description.length > 50) {
        score += 0.1;
        reasons.push('Well described');
      }

      // Recent activity
      const daysSinceActivity = (Date.now() - (community.lastActivityAt?.toDate()?.getTime() || 0)) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity <= 7) {
        score += 0.2;
        reasons.push('Recently active');
      }

      return { ...community, score, reasons };
    }).sort((a, b) => b.score - a.score);
  }

  private personalizeTrendingContent(trendingPosts: any[], userProfile: UserProfile | null) {
    if (!userProfile) return trendingPosts;

    return trendingPosts.map(post => ({
      ...post,
      personalizedScore: post.engagementScore * (1 + this.calculateInterestScore({
        tags: post.tags || [],
        category: post.category || '',
        type: 'post',
        id: post.id,
        content: post.content,
        authorId: post.authorId,
        createdAt: post.createdAt?.toDate() || new Date(),
        engagement: {
          likes: post.likes || 0,
          comments: post.commentCount || 0,
          shares: post.shares || 0,
          views: post.views || 0
        },
        quality: { score: 0.5, factors: [] }
      }, userProfile))
    })).sort((a, b) => b.personalizedScore - a.personalizedScore);
  }

  private getTimeThreshold(timeframe: 'hour' | 'day' | 'week'): Date {
    const now = new Date();
    const threshold = new Date(now);

    switch (timeframe) {
      case 'hour':
        threshold.setHours(now.getHours() - 1);
        break;
      case 'day':
        threshold.setDate(now.getDate() - 1);
        break;
      case 'week':
        threshold.setDate(now.getDate() - 7);
        break;
    }

    return threshold;
  }

  private async updateUserInterestProfile(
    userId: string,
    contentId: string
  ): Promise<void> {
    try {
      // Get the content to extract topics/tags (future use)
      const contentDoc = await getDoc(doc(db, 'posts', contentId));
      if (!contentDoc.exists()) return;

      // Update user's implicit interests placeholder
      const userRef = doc(db, 'users', userId);

      // This would update the user's interest scores
      // Implementation would involve more complex interest modeling
      await updateDoc(userRef, {
        lastRecommendationUpdate: new Date()
      });
    } catch (error) {
      console.error('Error updating user interest profile:', error);
    }
  }
  private async logRecommendations(userId: string, recommendations: Recommendation[]): Promise<void> {
    try {
      const logData = {
        userId,
        recommendations: recommendations.map(r => ({
          contentId: r.contentId,
          relevanceScore: r.relevanceScore,
          reasons: r.reasons
        })),
        timestamp: new Date(),
        type: 'general'
      };

      await addDoc(collection(db, 'recommendationLogs'), logData);
    } catch (error) {
      console.error('Error logging recommendations:', error);
    }
  }
}

// Export singleton instance
export const smartRecommendationService = new SmartRecommendationService();

export default smartRecommendationService;