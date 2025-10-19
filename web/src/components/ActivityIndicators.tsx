import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link } from 'react-router-dom';

interface ActivityIndicatorsProps {
  className?: string;
}

interface TrendingCommunity {
  id: string;
  name: string;
  category: string;
  memberCount: number;
  activityScore: number;
  growth: number;
}

interface TrendingTag {
  tag: string;
  count: number;
  growth: number;
}

interface RecentActivity {
  type: 'post' | 'community' | 'comment';
  count: number;
  timeframe: string;
}

export default function ActivityIndicators({ className = '' }: ActivityIndicatorsProps) {
  const [trendingCommunities, setTrendingCommunities] = useState<TrendingCommunity[]>([]);
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActivityData = async () => {
      if (!db) return;

      try {
        setLoading(true);

        // Get trending communities
        const communitiesQuery = query(
          collection(db, 'communities'),
          where('isActive', '==', true),
          orderBy('activityScore', 'desc'),
          limit(5)
        );
        
        const communitiesSnapshot = await getDocs(communitiesQuery);
        const communities = communitiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          growth: Math.random() * 50 // Placeholder for growth calculation
        })) as TrendingCommunity[];

        setTrendingCommunities(communities);

        // Get recent posts for trending tags
        const recentPostsQuery = query(
          collection(db, 'posts'),
          where('createdAt', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000)), // Last 24 hours
          orderBy('createdAt', 'desc'),
          limit(100)
        );

        const postsSnapshot = await getDocs(recentPostsQuery);
        const posts = postsSnapshot.docs.map(doc => doc.data());

        // Calculate trending tags
        const tagCounts = new Map<string, number>();
        posts.forEach(post => {
          if (post.tags && Array.isArray(post.tags)) {
            post.tags.forEach((tag: string) => {
              tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
          }
        });

        const tags = Array.from(tagCounts.entries())
          .map(([tag, count]) => ({
            tag,
            count,
            growth: Math.random() * 100 // Placeholder
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        setTrendingTags(tags);

        // Calculate recent activity

        const activity = [
          {
            type: 'post' as const,
            count: posts.length,
            timeframe: '24h'
          },
          {
            type: 'community' as const,
            count: communities.filter(c => c.activityScore > 50).length,
            timeframe: 'active'
          }
        ];

        setRecentActivity(activity);
      } catch (error) {
        console.error('Error loading activity data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadActivityData();
  }, []);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-lg">📊</span>
            <span>Platform Activity</span>
          </h3>
          <span className="text-xs text-gray-500 bg-green-100 px-2 py-1 rounded-full">
            Live Updates
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Recent Activity Stats */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3 text-sm">Activity Overview</h4>
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {activity.type === 'post' ? '📝' : 
                       activity.type === 'community' ? '🏠' : '💬'}
                    </span>
                    <span className="text-sm text-gray-600 capitalize">
                      {activity.type === 'post' ? 'New Posts' : 
                       activity.type === 'community' ? 'Active Communities' : 'Comments'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-gray-900">{activity.count}</span>
                    <span className="text-xs text-gray-500">/{activity.timeframe}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Communities */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3 text-sm">Hot Communities</h4>
            <div className="space-y-2">
              {trendingCommunities.slice(0, 4).map((community, index) => (
                <Link
                  key={community.id}
                  to={`/c/${community.id}`}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-400 rounded-md flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{index + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                        {community.name}
                      </p>
                      <p className="text-xs text-gray-500">{community.memberCount} members</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-green-600 font-medium">↗</span>
                    <span className="text-gray-600">{Math.round(community.growth)}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Trending Tags */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3 text-sm">Trending Topics</h4>
            <div className="flex flex-wrap gap-1.5">
              {trendingTags.slice(0, 8).map((tagData) => (
                <button
                  key={tagData.tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200 hover:from-blue-100 hover:to-purple-100 transition-colors"
                  onClick={() => {
                    // TODO: Filter by tag
                    console.log('Filter by tag:', tagData.tag);
                  }}
                >
                  <span>#{tagData.tag}</span>
                  <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded-full text-xs">
                    {tagData.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <Link 
                to="/communities" 
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Explore Communities
              </Link>
              <Link 
                to="/trending" 
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                View Trending
              </Link>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}