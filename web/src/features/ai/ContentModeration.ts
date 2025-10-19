import { 
  collection, 
  doc, 
  addDoc, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

// AI Moderation Configuration
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
const PERSPECTIVE_API_KEY = import.meta.env.VITE_PERSPECTIVE_API_KEY as string | undefined;

export interface ModerationResult {
  isAppropriate: boolean;
  confidenceScore: number;
  flaggedReasons: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction: 'approve' | 'review' | 'reject' | 'auto-delete';
  details: {
    toxicity?: number;
    profanity?: number;
    spam?: number;
    harassment?: number;
    hate?: number;
    violence?: number;
  };
}

export interface ContentAnalysis {
  content: string;
  contentType: 'post' | 'comment' | 'message' | 'bio';
  userId: string;
  communityId?: string;
  timestamp: Date;
  moderation: ModerationResult;
}

class ContentModerationService {
  private perspectiveApiUrl = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';

  /**
   * Main content moderation function
   */
  async moderateContent(
    content: string, 
    contentType: 'post' | 'comment' | 'message' | 'bio',
    userId: string,
    communityId?: string
  ): Promise<ModerationResult> {
    try {
      // Run multiple AI moderation checks in parallel
      const [perspectiveResults, openAiResults, keywordResults] = await Promise.all([
        this.checkWithPerspectiveAPI(content),
        this.checkWithOpenAI(content),
        this.checkWithKeywordFilter(content)
      ]);

      // Combine results and determine final moderation decision
      const combinedResult = this.combineResults(
        perspectiveResults,
        openAiResults,
        keywordResults
      );

      // Log moderation result
      await this.logModerationResult({
        content,
        contentType,
        userId,
        communityId,
        timestamp: new Date(),
        moderation: combinedResult
      });

      // Take automated action if needed
      if (combinedResult.suggestedAction === 'auto-delete') {
        await this.handleAutoDelete(content, contentType, userId, combinedResult);
      } else if (combinedResult.suggestedAction === 'review') {
        await this.flagForReview(content, contentType, userId, communityId, combinedResult);
      }

      return combinedResult;
    } catch (error) {
      console.error('Content moderation failed:', error);
      // Return safe default - flag for review on error
      return {
        isAppropriate: false,
        confidenceScore: 0.5,
        flaggedReasons: ['moderation-error'],
        severity: 'medium',
        suggestedAction: 'review',
        details: {}
      };
    }
  }

  /**
   * Google Perspective API check for toxicity and other attributes
   */
  private async checkWithPerspectiveAPI(content: string): Promise<Partial<ModerationResult>> {
    if (!PERSPECTIVE_API_KEY) {
      console.warn('Perspective API key not configured');
      return { confidenceScore: 0, details: {} };
    }

    try {
      const response = await fetch(`${this.perspectiveApiUrl}?key=${PERSPECTIVE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: { text: content },
          requestedAttributes: {
            TOXICITY: {},
            SEVERE_TOXICITY: {},
            IDENTITY_ATTACK: {},
            INSULT: {},
            PROFANITY: {},
            THREAT: {},
            SEXUALLY_EXPLICIT: {},
            FLIRTATION: {}
          },
          languages: ['en'],
          doNotStore: true
        })
      });

      if (!response.ok) {
        throw new Error(`Perspective API error: ${response.status}`);
      }

      const data = await response.json();
      const scores = data.attributeScores;

      const toxicity = scores.TOXICITY?.summaryScore?.value || 0;
      const profanity = scores.PROFANITY?.summaryScore?.value || 0;
      const threat = scores.THREAT?.summaryScore?.value || 0;
      const insult = scores.INSULT?.summaryScore?.value || 0;

      const flaggedReasons = [];
      if (toxicity > 0.7) flaggedReasons.push('high-toxicity');
      if (profanity > 0.8) flaggedReasons.push('profanity');
      if (threat > 0.6) flaggedReasons.push('threat');
      if (insult > 0.7) flaggedReasons.push('insult');

      return {
        details: {
          toxicity,
          profanity,
          harassment: insult,
          hate: scores.IDENTITY_ATTACK?.summaryScore?.value || 0,
          violence: threat
        },
        flaggedReasons,
        confidenceScore: Math.max(toxicity, profanity, threat, insult)
      };
    } catch (error) {
      console.error('Perspective API check failed:', error);
      return { confidenceScore: 0, details: {} };
    }
  }

  /**
   * OpenAI content moderation check
   */
  private async checkWithOpenAI(content: string): Promise<Partial<ModerationResult>> {
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured');
      return { confidenceScore: 0, flaggedReasons: [] };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: content,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const result = data.results[0];

      const flaggedReasons = [];
      if (result.categories.hate) flaggedReasons.push('hate-speech');
      if (result.categories.harassment) flaggedReasons.push('harassment');
      if (result.categories.violence) flaggedReasons.push('violence');
      if (result.categories.sexual) flaggedReasons.push('sexual-content');
      if (result.categories.self_harm) flaggedReasons.push('self-harm');

      return {
        flaggedReasons,
        confidenceScore: Math.max(...(Object.values(result.category_scores) as number[])),
        details: {
          hate: result.category_scores.hate,
          harassment: result.category_scores.harassment,
          violence: result.category_scores.violence
        }
      };
    } catch (error) {
      console.error('OpenAI moderation check failed:', error);
      return { confidenceScore: 0, flaggedReasons: [] };
    }
  }

  /**
   * Keyword-based filtering for quick detection
   */
  private async checkWithKeywordFilter(content: string): Promise<Partial<ModerationResult>> {
    const lowerContent = content.toLowerCase();
    
    // Predefined keyword lists (in production, these would be more comprehensive)
    const spamKeywords = [
      'buy now', 'click here', 'limited time', 'act fast', 'guaranteed',
      'make money fast', 'work from home', 'get rich quick'
    ];
    
    const profanityKeywords = [
      // Basic profanity detection - in production use more comprehensive lists
      'damn', 'hell', 'stupid', 'idiot'
    ];

    const flaggedReasons = [];
    let spamScore = 0;
    let profanityScore = 0;

    // Check for spam patterns
    const spamMatches = spamKeywords.filter(keyword => lowerContent.includes(keyword));
    if (spamMatches.length > 0) {
      flaggedReasons.push('potential-spam');
      spamScore = Math.min(spamMatches.length * 0.3, 1);
    }

    // Check for excessive caps (spam indicator)
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.7 && content.length > 20) {
      flaggedReasons.push('excessive-caps');
      spamScore = Math.max(spamScore, 0.6);
    }

    // Check for profanity
    const profanityMatches = profanityKeywords.filter(word => lowerContent.includes(word));
    if (profanityMatches.length > 0) {
      flaggedReasons.push('profanity-keywords');
      profanityScore = Math.min(profanityMatches.length * 0.4, 1);
    }

    return {
      flaggedReasons,
      confidenceScore: Math.max(spamScore, profanityScore),
      details: {
        spam: spamScore,
        profanity: profanityScore
      }
    };
  }

  /**
   * Combine results from multiple AI services
   */
  private combineResults(
    perspective: Partial<ModerationResult>,
    openai: Partial<ModerationResult>,
    keywords: Partial<ModerationResult>
  ): ModerationResult {
    // Combine flagged reasons
    const allReasons = [
      ...(perspective.flaggedReasons || []),
      ...(openai.flaggedReasons || []),
      ...(keywords.flaggedReasons || [])
    ];
    const flaggedReasons = [...new Set(allReasons)];

    // Calculate combined confidence score (weighted average)
    const perspectiveWeight = 0.4;
    const openaiWeight = 0.4;
    const keywordWeight = 0.2;
    
    const confidenceScore = (
      (perspective.confidenceScore || 0) * perspectiveWeight +
      (openai.confidenceScore || 0) * openaiWeight +
      (keywords.confidenceScore || 0) * keywordWeight
    );

    // Combine details
    const details = {
      toxicity: Math.max(perspective.details?.toxicity || 0, openai.details?.hate || 0),
      profanity: Math.max(perspective.details?.profanity || 0, keywords.details?.profanity || 0),
      spam: keywords.details?.spam || 0,
      harassment: Math.max(perspective.details?.harassment || 0, openai.details?.harassment || 0),
      hate: Math.max(perspective.details?.hate || 0, openai.details?.hate || 0),
      violence: Math.max(perspective.details?.violence || 0, openai.details?.violence || 0)
    };

    // Determine severity and suggested action
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let suggestedAction: 'approve' | 'review' | 'reject' | 'auto-delete' = 'approve';

    if (confidenceScore >= 0.9) {
      severity = 'critical';
      suggestedAction = 'auto-delete';
    } else if (confidenceScore >= 0.7) {
      severity = 'high';
      suggestedAction = 'reject';
    } else if (confidenceScore >= 0.5) {
      severity = 'medium';
      suggestedAction = 'review';
    } else if (confidenceScore >= 0.3) {
      severity = 'low';
      suggestedAction = 'review';
    }

    const isAppropriate = confidenceScore < 0.5 && flaggedReasons.length === 0;

    return {
      isAppropriate,
      confidenceScore,
      flaggedReasons,
      severity,
      suggestedAction,
      details
    };
  }

  /**
   * Log moderation result for analytics and improvement
   */
  private async logModerationResult(analysis: ContentAnalysis): Promise<void> {
    if (!db) return;

    try {
      await addDoc(collection(db, 'moderationLogs'), {
        ...analysis,
        timestamp: analysis.timestamp
      });
    } catch (error) {
      console.error('Failed to log moderation result:', error);
    }
  }

  /**
   * Handle automatic deletion of content
   */
  private async handleAutoDelete(
    content: string,
    contentType: string,
    userId: string,
    result: ModerationResult
  ): Promise<void> {
    if (!db) return;

    try {
      // Create a removal record
      await addDoc(collection(db, 'autoRemovals'), {
        content,
        contentType,
        userId,
        reason: result.flaggedReasons,
        severity: result.severity,
        confidenceScore: result.confidenceScore,
        removedAt: new Date(),
        status: 'auto-deleted'
      });

      // Issue warning to user
      const userRef = doc(db, 'users', userId);
      const userWarnings = collection(userRef, 'warnings');
      await addDoc(userWarnings, {
        type: 'content-violation',
        reasons: result.flaggedReasons,
        severity: result.severity,
        content: content.substring(0, 100) + '...', // Truncated for privacy
        createdAt: new Date(),
        status: 'active'
      });

      console.log(`Auto-deleted content from user ${userId} for: ${result.flaggedReasons.join(', ')}`);
    } catch (error) {
      console.error('Failed to handle auto-delete:', error);
    }
  }

  /**
   * Flag content for manual review
   */
  private async flagForReview(
    content: string,
    contentType: string,
    userId: string,
    communityId: string | undefined,
    result: ModerationResult
  ): Promise<void> {
    if (!db) return;

    try {
      await addDoc(collection(db, 'reviewQueue'), {
        content,
        contentType,
        userId,
        communityId,
        reasons: result.flaggedReasons,
        severity: result.severity,
        confidenceScore: result.confidenceScore,
        details: result.details,
        status: 'pending',
        flaggedAt: new Date(),
        priority: result.severity === 'high' ? 1 : result.severity === 'medium' ? 2 : 3
      });

      console.log(`Flagged content for review from user ${userId}: ${result.flaggedReasons.join(', ')}`);
    } catch (error) {
      console.error('Failed to flag content for review:', error);
    }
  }

  /**
   * Batch moderate multiple pieces of content
   */
  async batchModerate(contents: Array<{
    content: string;
    contentType: 'post' | 'comment' | 'message' | 'bio';
    userId: string;
    communityId?: string;
  }>): Promise<ModerationResult[]> {
    const results = await Promise.all(
      contents.map(item => 
        this.moderateContent(item.content, item.contentType, item.userId, item.communityId)
      )
    );

    return results;
  }

  /**
   * Get moderation statistics for analytics
   */
  async getModerationStats(timeRange: 'day' | 'week' | 'month' = 'week') {
    if (!db) return null;

    const now = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
    }

    try {
      const moderationQuery = query(
        collection(db, 'moderationLogs'),
        where('timestamp', '>=', startDate)
      );

      const snapshot = await getDocs(moderationQuery);
      const logs = snapshot.docs.map(doc => doc.data());

      const stats = {
        totalChecked: logs.length,
        approved: logs.filter(log => log.moderation.isAppropriate).length,
        flagged: logs.filter(log => !log.moderation.isAppropriate).length,
        autoDeleted: logs.filter(log => log.moderation.suggestedAction === 'auto-delete').length,
        averageConfidence: logs.reduce((sum, log) => sum + log.moderation.confidenceScore, 0) / logs.length,
        topReasons: this.getTopReasons(logs),
        severityBreakdown: {
          low: logs.filter(log => log.moderation.severity === 'low').length,
          medium: logs.filter(log => log.moderation.severity === 'medium').length,
          high: logs.filter(log => log.moderation.severity === 'high').length,
          critical: logs.filter(log => log.moderation.severity === 'critical').length,
        }
      };

      return stats;
    } catch (error) {
      console.error('Failed to get moderation stats:', error);
      return null;
    }
  }

  private getTopReasons(logs: any[]) {
    const reasonCounts: { [key: string]: number } = {};
    
    logs.forEach(log => {
      log.moderation.flaggedReasons.forEach((reason: string) => {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
    });

    return Object.entries(reasonCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }));
  }
}

// Export singleton instance
export const contentModerationService = new ContentModerationService();

// Helper function to check content before posting
export async function checkContentBeforePost(
  content: string,
  contentType: 'post' | 'comment' | 'message' | 'bio',
  userId: string,
  communityId?: string
): Promise<{ allowed: boolean; reason?: string; result: ModerationResult }> {
  const result = await contentModerationService.moderateContent(
    content, 
    contentType, 
    userId, 
    communityId
  );

  const allowed = result.suggestedAction === 'approve';
  const reason = !allowed ? `Content flagged for: ${result.flaggedReasons.join(', ')}` : undefined;

  return { allowed, reason, result };
}

export default contentModerationService;