import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  doc,
  getDoc,
  updateDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface UserInterest {
  category: string;
  tags: string[];
  engagementScore: number;
  lastEngagement: Timestamp;
}

export interface CommunityRecommendation {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  memberCount: number;
  activityScore: number;
  relevanceScore: number;
  reason: string;
}

export interface PostRecommendation {
  id: string;
  title: string;
  communityId: string;
  communityName: string;
  category: string;
  tags: string[];
  voteScore: number;
  commentCount: number;
  relevanceScore: number;
  reason: string;
  createdAt: Timestamp;
}

export interface RecommendationFilters {
  categories?: string[];
  tags?: string[];
  minActivityScore?: number;
  maxResults?: number;
  excludeCommunities?: string[];
  sortBy?: 'relevance' | 'activity' | 'popularity' | 'newest';
}

export class RecommendationEngine {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  // Track user engagement
  async trackEngagement(
    type: 'view' | 'vote' | 'comment' | 'react' | 'share',
    itemId: string,
    itemType: 'post' | 'community' | 'comment',
    metadata: {
      category?: string;
      tags?: string[];
      communityId?: string;
    }
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', this.userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) return;

      const userData = userDoc.data();
      const engagementHistory = userData.engagementHistory || [];

      // Weight different engagement types
      const engagementWeights = {
        view: 1,
        vote: 3,
        comment: 5,
        react: 2,
        share: 4
      };

      const weight = engagementWeights[type];

      // Update engagement history
      const newEngagement = {
        type,
        itemId,
        itemType,
        timestamp: new Date(),
        weight,
        ...metadata
      };

      // Update user interests based on engagement
      if (metadata.category) {
        await this.updateUserInterests(metadata.category, metadata.tags || [], weight);
      }

      // Update engagement history (keep last 1000 entries)
      const updatedHistory = [newEngagement, ...engagementHistory.slice(0, 999)];

      await updateDoc(userRef, {
        engagementHistory: updatedHistory,
        lastActiveAt: new Date()
      });
    } catch (error) {
      console.error('Error tracking engagement:', error);
    }
  }

  // Update user interests based on engagement
  private async updateUserInterests(category: string, tags: string[], weight: number): Promise<void> {
    const userRef = doc(db, 'users', this.userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return;

    const userData = userDoc.data();
    const currentInterests: UserInterest[] = userData.userInterests || [];

    // Find existing interest or create new one
    let categoryInterest = currentInterests.find(interest => interest.category === category);

    if (categoryInterest) {
      // Update existing interest
      categoryInterest.engagementScore += weight;
      categoryInterest.lastEngagement = Timestamp.now();
      
      // Merge tags
      const newTags = tags.filter(tag => !categoryInterest!.tags.includes(tag));
      categoryInterest.tags = [...categoryInterest.tags, ...newTags];
    } else {
      // Create new interest
      categoryInterest = {
        category,
        tags,
        engagementScore: weight,
        lastEngagement: Timestamp.now()
      };
      currentInterests.push(categoryInterest);
    }

    // Sort interests by engagement score and keep top 20
    const sortedInterests = currentInterests
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 20);

    await updateDoc(userRef, {
      userInterests: sortedInterests,
      interests: sortedInterests.map(i => i.category) // Backward compatibility
    });
  }

  // Get personalized community recommendations
  async getCommunityRecommendations(filters: RecommendationFilters = {}): Promise<CommunityRecommendation[]> {
    try {
      const {
        categories = [],
        tags = [],
        minActivityScore = 0,
        maxResults = 10,
        excludeCommunities = [],
        sortBy = 'relevance'
      } = filters;

      // Get user interests
      const userDoc = await getDoc(doc(db, 'users', this.userId));
      const userInterests: UserInterest[] = userDoc.data()?.userInterests || [];
      const followedCommunities: string[] = userDoc.data()?.followedCommunities || [];

      // Build query constraints
      let constraints: any[] = [
        where('isActive', '==', true),
        where('activityScore', '>=', minActivityScore)
      ];

      if (categories.length > 0) {
        constraints.push(where('category', 'in', categories));
      }

      // Query communities
      const communitiesQuery = query(
        collection(db, 'communities'),
        ...constraints,
        orderBy('activityScore', 'desc'),
        limit(maxResults * 3) // Get more to filter and score
      );

      const snapshot = await getDocs(communitiesQuery);
      const communities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Filter out followed and excluded communities
      const filteredCommunities = communities.filter(community => 
        !followedCommunities.includes(community.id) &&
        !excludeCommunities.includes(community.id)
      );

      // Calculate relevance scores
      const scoredCommunities = filteredCommunities.map(community => {
        const relevanceScore = this.calculateCommunityRelevance(community, userInterests, tags);
        const reason = this.generateCommunityRecommendationReason(community, userInterests);
        
        return {
          ...community,
          relevanceScore,
          reason
        };
      });

      // Sort by specified criteria
      const sortedCommunities = this.sortRecommendations(scoredCommunities, sortBy);

      return sortedCommunities.slice(0, maxResults);
    } catch (error) {
      console.error('Error getting community recommendations:', error);
      return [];
    }
  }

  // Get personalized post recommendations
  async getPostRecommendations(filters: RecommendationFilters = {}): Promise<PostRecommendation[]> {
    try {
      const {
        categories = [],
        tags = [],
        maxResults = 20,
        sortBy = 'relevance'
      } = filters;

      // Get user interests
      const userDoc = await getDoc(doc(db, 'users', this.userId));
      const userInterests: UserInterest[] = userDoc.data()?.userInterests || [];
      const followedCommunities: string[] = userDoc.data()?.followedCommunities || [];

      // Get posts from followed communities and similar communities
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(maxResults * 2) // Get more to score and filter
      );

      const snapshot = await getDocs(postsQuery);
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Get community data for scoring
      const communityIds = [...new Set(posts.map(post => post.communityId))];
      const communityPromises = communityIds.map(id => getDoc(doc(db, 'communities', id)));
      const communityDocs = await Promise.all(communityPromises);
      const communitiesMap = new Map();
      
      communityDocs.forEach(doc => {
        if (doc.exists()) {
          communitiesMap.set(doc.id, doc.data());
        }
      });

      // Score posts
      const scoredPosts = posts.map(post => {
        const community = communitiesMap.get(post.communityId);
        const relevanceScore = this.calculatePostRelevance(post, community, userInterests, followedCommunities);
        const reason = this.generatePostRecommendationReason(post, community, userInterests, followedCommunities);
        
        return {
          ...post,
          communityName: community?.name || 'Unknown',
          category: community?.category || 'General',
          relevanceScore,
          reason
        };
      });

      // Sort and filter
      const sortedPosts = this.sortRecommendations(scoredPosts, sortBy);
      const filteredPosts = sortedPosts.filter(post => {
        if (categories.length > 0 && !categories.includes(post.category)) return false;
        if (tags.length > 0 && !tags.some(tag => post.tags?.includes(tag))) return false;
        return true;
      });

      return filteredPosts.slice(0, maxResults);
    } catch (error) {
      console.error('Error getting post recommendations:', error);
      return [];
    }
  }

  // Calculate community relevance score
  private calculateCommunityRelevance(community: any, userInterests: UserInterest[], preferredTags: string[]): number {
    let score = 0;

    // Category match
    const categoryInterest = userInterests.find(interest => interest.category === community.category);
    if (categoryInterest) {
      score += categoryInterest.engagementScore * 0.4;
    }

    // Tag matching
    const communityTags = community.tags || [];
    const userTags = userInterests.flatMap(interest => interest.tags);
    const tagMatches = communityTags.filter((tag: string) => userTags.includes(tag) || preferredTags.includes(tag));
    score += tagMatches.length * 5;

    // Activity score normalization (0-100 scale)
    score += (community.activityScore || 0) * 0.1;

    // Member count factor (more popular = slightly higher score)
    score += Math.log10((community.memberCount || 1) + 1) * 2;

    // Freshness factor
    const daysSinceCreation = (Date.now() - community.createdAt?.toMillis()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 30) {
      score += 5; // Boost new communities
    }

    return Math.round(score * 100) / 100;
  }

  // Calculate post relevance score
  private calculatePostRelevance(
    post: any, 
    community: any, 
    userInterests: UserInterest[], 
    followedCommunities: string[]
  ): number {
    let score = 0;

    // Community following bonus
    if (followedCommunities.includes(post.communityId)) {
      score += 50;
    }

    // Category interest
    if (community) {
      const categoryInterest = userInterests.find(interest => interest.category === community.category);
      if (categoryInterest) {
        score += categoryInterest.engagementScore * 0.3;
      }
    }

    // Tag matching
    const postTags = post.tags || [];
    const userTags = userInterests.flatMap(interest => interest.tags);
    const tagMatches = postTags.filter((tag: string) => userTags.includes(tag));
    score += tagMatches.length * 8;

    // Engagement metrics
    score += (post.voteScore || 0) * 0.5;
    score += (post.commentCount || 0) * 2;

    // Recency factor
    const hoursOld = (Date.now() - post.createdAt?.toMillis()) / (1000 * 60 * 60);
    if (hoursOld < 24) {
      score += 10; // Recent posts get a boost
    } else if (hoursOld < 72) {
      score += 5;
    }

    return Math.round(score * 100) / 100;
  }

  // Generate recommendation reasons
  private generateCommunityRecommendationReason(community: any, userInterests: UserInterest[]): string {
    const categoryInterest = userInterests.find(interest => interest.category === community.category);
    const communityTags = community.tags || [];
    const userTags = userInterests.flatMap(interest => interest.tags);
    const matchingTags = communityTags.filter((tag: string) => userTags.includes(tag));

    if (categoryInterest && matchingTags.length > 0) {
      return `Based on your interest in ${community.category} and ${matchingTags.slice(0, 2).join(', ')}`;
    } else if (categoryInterest) {
      return `Because you're interested in ${community.category}`;
    } else if (matchingTags.length > 0) {
      return `Because you like ${matchingTags.slice(0, 2).join(' and ')}`;
    } else if (community.activityScore > 80) {
      return `Trending community with high activity`;
    } else {
      return `Popular community you might enjoy`;
    }
  }

  private generatePostRecommendationReason(
    post: any, 
    community: any, 
    userInterests: UserInterest[], 
    followedCommunities: string[]
  ): string {
    if (followedCommunities.includes(post.communityId)) {
      return `From ${community?.name || 'your community'}`;
    }

    const categoryInterest = userInterests.find(interest => interest.category === community?.category);
    if (categoryInterest) {
      return `Because you're interested in ${community.category}`;
    }

    if (post.voteScore > 10) {
      return `Highly upvoted post`;
    }

    if (post.commentCount > 5) {
      return `Popular discussion`;
    }

    return `Recommended for you`;
  }

  // Sort recommendations
  private sortRecommendations(recommendations: any[], sortBy: string): any[] {
    switch (sortBy) {
      case 'relevance':
        return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
      case 'activity':
        return recommendations.sort((a, b) => (b.activityScore || 0) - (a.activityScore || 0));
      case 'popularity':
        return recommendations.sort((a, b) => (b.memberCount || b.voteScore || 0) - (a.memberCount || a.voteScore || 0));
      case 'newest':
        return recommendations.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });
      default:
        return recommendations;
    }
  }

  // Get trending tags
  async getTrendingTags(timeFrame: '24h' | '7d' | '30d' = '7d', maxResults = 20): Promise<Array<{tag: string, count: number, growth: number}>> {
    try {
      const timeMap = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const cutoffTime = new Date(Date.now() - timeMap[timeFrame]);

      // Get recent posts with tags
      const postsQuery = query(
        collection(db, 'posts'),
        where('createdAt', '>=', cutoffTime),
        orderBy('createdAt', 'desc'),
        limit(1000)
      );

      const snapshot = await getDocs(postsQuery);
      const posts = snapshot.docs.map(doc => doc.data());

      // Count tag occurrences
      const tagCounts = new Map<string, number>();
      posts.forEach(post => {
        if (post.tags && Array.isArray(post.tags)) {
          post.tags.forEach((tag: string) => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          });
        }
      });

      // Convert to array and sort
      const trendingTags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({
          tag,
          count,
          growth: this.calculateTagGrowth(tag, timeFrame) // TODO: Implement growth calculation
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, maxResults);

      return trendingTags;
    } catch (error) {
      console.error('Error getting trending tags:', error);
      return [];
    }
  }

  private calculateTagGrowth(_tag: string, _timeFrame: string): number {
    // TODO: Implement growth calculation by comparing with previous period
    return Math.random() * 100; // Placeholder
  }
}

// Export singleton-like factory function
export function createRecommendationEngine(userId: string): RecommendationEngine {
  return new RecommendationEngine(userId);
}