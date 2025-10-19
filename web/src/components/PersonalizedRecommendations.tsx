import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { createRecommendationEngine } from '../services/RecommendationEngine';
import type { CommunityRecommendation, PostRecommendation } from '../services/RecommendationEngine';
import type { FilterOptions } from './AdvancedFilters';

interface PersonalizedRecommendationsProps {
  type: 'communities' | 'posts';
  filters?: FilterOptions;
  maxItems?: number;
  className?: string;
  hideWhenEmpty?: boolean;
}

export default function PersonalizedRecommendations({ 
  type, 
  filters,
  maxItems = 5,
  className = '',
  hideWhenEmpty = false,
}: PersonalizedRecommendationsProps) {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<(CommunityRecommendation | PostRecommendation)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recommendationEngine = useMemo(() => 
    user ? createRecommendationEngine(user.uid) : null, 
    [user]
  );

  useEffect(() => {
    const loadRecommendations = async () => {
      if (!recommendationEngine) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const recommendationFilters = {
          categories: filters?.categories || [],
          tags: filters?.tags || [],
          sortBy: (filters?.sortBy || 'relevance'),
          maxResults: maxItems,
          minActivityScore: filters?.minActivityScore || 0
        };

        let results;
        if (type === 'communities') {
          results = await recommendationEngine.getCommunityRecommendations(recommendationFilters);
        } else {
          results = await recommendationEngine.getPostRecommendations(recommendationFilters);
        }

        setRecommendations(results);
      } catch (err) {
        setError('Failed to load recommendations');
        console.error('Error loading recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    loadRecommendations();
  }, [
    recommendationEngine,
    type,
    maxItems,
    // Primitive dependencies to avoid re-running due to object identity
    filters?.sortBy ?? 'relevance',
    (filters?.categories || []).join('|'),
    (filters?.tags || []).join('|'),
    filters?.minActivityScore ?? 0,
  ]);

  if (!user) {
    return (
      <div className={`bg-white rounded-lg border p-6 text-center ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Personalized Recommendations</h3>
        <p className="text-gray-600 mb-4">Sign in to get personalized recommendations based on your interests.</p>
        <Link 
          to="/login" 
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/2"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg border p-6 text-center ${className}`}>
        <div className="text-red-600 mb-2">
          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.924-.833-2.694 0L3.12 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (recommendations.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <div className={`bg-white rounded-lg border p-6 text-center ${className}`}>
        <div className="text-gray-400 mb-2">
          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recommendations Yet</h3>
        <p className="text-gray-600 mb-4">
          Start engaging with content to get personalized {type} recommendations!
        </p>
        <p className="text-sm text-gray-500">
          Vote on posts, join communities, and interact with content to improve your recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Recommended {type === 'communities' ? 'Communities' : 'Posts'}
          </h3>
          <div className="flex items-center gap-1 text-sm text-blue-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>Personalized</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {recommendations.map((item) => (
          <RecommendationItem 
            key={item.id} 
            item={item} 
            type={type}
            onEngagement={(engagementType) => handleEngagement(item.id, engagementType)}
          />
        ))}
      </div>

      <div className="p-4 border-t border-gray-200">
        <Link
          to={type === 'communities' ? '/communities' : '/feed'}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          <span>View all {type}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );

  function handleEngagement(itemId: string, engagementType: string) {
    if (!recommendationEngine) return;

    const item = recommendations.find(r => r.id === itemId);
    if (!item) return;

    // Track engagement for recommendation improvement
    recommendationEngine.trackEngagement(
      engagementType as any,
      itemId,
      type === 'communities' ? 'community' : 'post',
      {
        category: 'category' in item ? item.category : undefined,
        tags: item.tags,
        communityId: type === 'posts' ? (item as PostRecommendation).communityId : undefined
      }
    );
  }
}

interface RecommendationItemProps {
  item: CommunityRecommendation | PostRecommendation;
  type: 'communities' | 'posts';
  onEngagement: (engagementType: string) => void;
}

function RecommendationItem({ item, type, onEngagement }: RecommendationItemProps) {
  const isPost = type === 'posts';
  const post = isPost ? item as PostRecommendation : null;
  const community = !isPost ? item as CommunityRecommendation : null;

  const linkTo = isPost 
    ? `/c/${post!.communityId}/post/${post!.id}`
    : `/c/${community!.id}`;

  return (
    <div className="group hover:bg-gray-50 rounded-lg p-3 transition-colors">
      <Link 
        to={linkTo}
        onClick={() => onEngagement('view')}
        className="block"
      >
        <div className="flex items-start gap-3">
          {/* Icon/Avatar */}
          <div className="flex-shrink-0">
            {isPost ? (
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16l8-8-8-8z" />
                </svg>
              </div>
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {isPost ? post!.title : community!.name}
                </h4>
                
                {isPost ? (
                  <p className="text-sm text-gray-600 mt-1">
                    in <span className="font-medium">{post!.communityName}</span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {community!.description}
                  </p>
                )}

                {/* Reason */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {item.reason}
                  </span>
                  <span className="text-xs text-gray-500">
                    {Math.round(item.relevanceScore)}% match
                  </span>
                </div>

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{item.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex-shrink-0 text-right text-xs text-gray-500 ml-3">
                {isPost ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>{post!.voteScore}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                      </svg>
                      <span>{post!.commentCount}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                      </svg>
                      <span>{community!.memberCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03z" clipRule="evenodd" />
                      </svg>
                      <span>{Math.round(community!.activityScore)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

// Utility class for text truncation
const styles = `
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

// Add styles to document head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}