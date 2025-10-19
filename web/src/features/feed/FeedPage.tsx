import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useFirestoreRealtime, queryBuilders } from '../../hooks/useFirestoreRealtime';
import AdvancedFilters from '../../components/AdvancedFilters';
import type { FilterOptions } from '../../components/AdvancedFilters';
import PersonalizedRecommendations from '../../components/PersonalizedRecommendations';
import VotingButtons from '../voting/VotingButtons';
import ReactionButtons from '../reactions/ReactionButtons';
import PostComposer from '../posts/PostComposer';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link } from 'react-router-dom';
import { onPostDeleted } from '../../lib/socket';
import { useToast } from '../../components/ToastProvider';

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  communityId: string;
  communityName?: string;
  voteScore: number;
  upvotes: string[];
  downvotes: string[];
  commentCount: number;
  reactions: Record<string, { count: number; users: string[] }>;
  tags: string[];
  media?: Array<{ url: string; type: string; alt?: string }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export default function FeedPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    tags: [],
    sortBy: 'relevance',
    timeFrame: '7d',
    minActivityScore: 0,
    searchQuery: ''
  });
  const [followedCommunities, setFollowedCommunities] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'following' | 'trending'>('feed');
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>('');


  // Get user's followed communities
  useEffect(() => {
    const getUserData = async () => {
      if (!user?.uid || !db) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setFollowedCommunities(userData.followedCommunities || []);
          setShowRecommendations(userData.preferences?.showRecommendations ?? true);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    getUserData();
  }, [user]);

  // Default selection for composer
  useEffect(() => {
    if (!selectedCommunityId && followedCommunities.length > 0) {
      setSelectedCommunityId(followedCommunities[0]);
    }
  }, [followedCommunities, selectedCommunityId]);

  // Dynamic query based on active tab
  const feedQuery = useMemo(() => {
    switch (activeTab) {
      case 'following':
        return queryBuilders.userFeed(followedCommunities, filters.sortBy);
      case 'trending':
        return queryBuilders.trendingPosts(filters.timeFrame);
      default:
        return queryBuilders.userFeed(followedCommunities, filters.sortBy);
    }
  }, [activeTab, followedCommunities, filters]);

  const { data: posts, loading, error } = useFirestoreRealtime<Post>({
    ...feedQuery,
    enableRealTimeUpdates: true,
    emitSocketEvents: false
  });

  const { showToast } = useToast();

  // Remove posts from view when post:deleted is received
  useEffect(() => {
    const handler = (evt: { postId: string; communityId: string }) => {
      setHiddenPostIds(prev => new Set(prev).add(evt.postId));
      showToast('A post was deleted by moderation', 'info');
    };
    onPostDeleted(handler as any);
  }, []);

  // Filter posts based on search and other criteria
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(new Set());

  const filteredPosts = useMemo(() => {
    let filtered = posts.filter(p => !hiddenPostIds.has(p.id));

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(post => 
        post.title.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query) ||
        post.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [posts, filters]);

  const handleFollowCommunity = async (communityId: string, isFollowing: boolean) => {
    if (!user?.uid || !db) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      
      if (isFollowing) {
        await updateDoc(userRef, {
          followedCommunities: arrayRemove(communityId)
        });
        setFollowedCommunities(prev => prev.filter(id => id !== communityId));
      } else {
        await updateDoc(userRef, {
          followedCommunities: arrayUnion(communityId)
        });
        setFollowedCommunities(prev => [...prev, communityId]);
      }
    } catch (error) {
      console.error('Error following/unfollowing community:', error);
    }
  };

  if (loading && posts.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="h-6 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Feed</h1>
          <p className="text-gray-600">
            Discover content from communities you follow and personalized recommendations
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Feed Tabs */}
            <div className="bg-white rounded-lg border">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'feed', label: 'For You', icon: '✨' },
                    { id: 'following', label: 'Following', icon: '👥', count: followedCommunities.length },
                    { id: 'trending', label: 'Trending', icon: '🔥' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                      {tab.count !== undefined && tab.count > 0 && (
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Filters */}
              <div className="p-4">
                <AdvancedFilters
                  onFiltersChange={setFilters}
                  initialFilters={filters}
                  showPersonalized={activeTab === 'feed'}
                />
              </div>
            </div>

            {/* Quick Create Post */}
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Create a post</h2>
              </div>
              {(!user || followedCommunities.length === 0) ? (
                <div className="text-sm text-gray-600">
                  {user ? (
                    <>
                      You’re not following any communities yet. Follow some communities to post.
                      <Link to="/communities" className="text-blue-600 underline ml-1">Explore communities</Link>
                    </>
                  ) : (
                    <>Please sign in to create a post.</>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Community</label>
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={selectedCommunityId}
                      onChange={(e) => setSelectedCommunityId(e.target.value)}
                    >
                      {followedCommunities.map((cid) => (
                        <option key={cid} value={cid}>{cid}</option>
                      ))}
                    </select>
                  </div>
                  {selectedCommunityId && <PostComposer communityId={selectedCommunityId} />}
                </>
              )}
            </div>

            {/* Posts Feed */}
            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700">Error loading posts. Please try again.</p>
                </div>
              )}

              {filteredPosts.length === 0 && !loading ? (
                <div className="text-center py-12 bg-white rounded-lg border">
                  {followedCommunities.length === 0 ? (
                    <div>
                      <div className="text-gray-400 mb-4">
                        <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No communities followed</h3>
                      <p className="text-gray-600 mb-4">Start by following some communities to see their posts in your feed.</p>
                      <Link
                        to="/communities"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Explore Communities
                      </Link>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts found</h3>
                      <p className="text-gray-600">Try adjusting your filters or check back later for new content.</p>
                    </div>
                  )}
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Personalized Recommendations */}
            {showRecommendations && (
              <PersonalizedRecommendations
                type="communities"
                filters={filters}
                maxItems={5}
              />
            )}

            {/* Community Follow Suggestions */}
            <CommunityFollowSuggestions
              followedCommunities={followedCommunities}
              onFollow={handleFollowCommunity}
            />

            {/* Post Recommendations */}
            {showRecommendations && (
              <PersonalizedRecommendations
                type="posts"
                filters={filters}
                maxItems={3}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Post Card Component
function PostCard({ post }: { post: Post }) {
  return (
    <div
      className="bg-white rounded-lg border hover:shadow-md transition-shadow"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target && target.closest('[data-no-nav]')) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <Link 
              to={`/c/${post.communityId}/post/${post.id}`}
              className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-2"
            >
              {post.title}
            </Link>
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <Link 
                to={`/c/${post.communityId}`} 
                className="font-medium hover:text-blue-600 transition-colors"
              >
                {post.communityName || post.communityId}
              </Link>
              <span>•</span>
              <span>{post.createdAt?.toDate().toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        {post.content && (
          <div 
            className="prose prose-sm max-w-none text-gray-700 mb-4" 
            dangerouslySetInnerHTML={{ __html: post.content.substring(0, 300) + (post.content.length > 300 ? '...' : '') }} 
          />
        )}

        {/* Media */}
        {post.media && post.media.length > 0 && (
          <div className="mb-4">
            <div className={`grid gap-2 ${
              post.media.length === 1 ? 'grid-cols-1' : 
              post.media.length === 2 ? 'grid-cols-2' : 'grid-cols-2'
            }`}>
              {post.media.slice(0, 4).map((item, index) => (
                <div key={index} className="rounded-lg overflow-hidden border">
                  {item.type.startsWith('video') ? (
                    <video 
                      src={item.url} 
                      controls 
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <img 
                      src={item.url} 
                      alt={item.alt || 'Post media'} 
                      className="w-full h-48 object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {post.tags.slice(0, 3).map(tag => (
              <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                #{tag}
              </span>
            ))}
            {post.tags.length > 3 && (
              <span className="text-xs text-gray-500">+{post.tags.length - 3} more</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <VotingButtons
              targetId={post.id}
              targetType="post"
              voteScore={post.voteScore || 0}
              upvotes={post.upvotes || []}
              downvotes={post.downvotes || []}
              communityId={post.communityId}
            />
            
            <Link 
              to={`/c/${post.communityId}/post/${post.id}#comments`}
              className="flex items-center gap-1 px-3 py-1 rounded-md text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{post.commentCount || 0} comments</span>
            </Link>
          </div>

          <ReactionButtons
            targetId={post.id}
            targetType="post"
            reactions={post.reactions}
            communityId={post.communityId}
          />
        </div>
      </div>
    </div>
  );
}

// Community Follow Suggestions Component
function CommunityFollowSuggestions({ 
  followedCommunities, 
  onFollow 
}: { 
  followedCommunities: string[]; 
  onFollow: (id: string, isFollowing: boolean) => void; 
}) {
  void followedCommunities; void onFollow;
  // This would be implemented with actual community suggestions
  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold text-gray-900 mb-3">Suggested Communities</h3>
      <p className="text-sm text-gray-500">Community suggestions will appear here based on your interests.</p>
    </div>
  );
}
