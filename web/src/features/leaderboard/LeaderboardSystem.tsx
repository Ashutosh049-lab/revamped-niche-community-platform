import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  where,
  startAfter,
  DocumentSnapshot 
} from 'firebase/firestore';
import type { QueryConstraint } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthProvider';
import { Link } from 'react-router-dom';

export interface LeaderboardUser {
  id: string;
  displayName: string;
  photoURL?: string;
  points: number;
  level: number;
  totalPosts: number;
  totalComments: number;
  totalVotes: number;
  achievementsCount: number;
  communitiesJoined: number;
  currentStreak: number;
  badges: string[];
  lastActiveAt: Date;
  rank?: number;
}

export interface LeaderboardFilters {
  timeframe: 'all-time' | 'monthly' | 'weekly' | 'daily';
  category: 'overall' | 'posts' | 'comments' | 'votes' | 'achievements';
  communityId?: string;
}

interface LeaderboardSystemProps {
  communityId?: string;
  showFilters?: boolean;
  maxUsers?: number;
  className?: string;
}

export default function LeaderboardSystem({ 
  communityId, 
  showFilters = true, 
  maxUsers = 50,
  className = '' 
}: LeaderboardSystemProps) {
  const { user } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LeaderboardFilters>({
    timeframe: 'all-time',
    category: 'overall',
    communityId
  });
  const [userRank, setUserRank] = useState<number | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, [filters]);

  const loadLeaderboard = async (loadMore = false) => {
    if (!db) return;

    try {
      if (!loadMore) {
        setLoading(true);
        setLeaderboardData([]);
        setLastDoc(null);
        setUserRank(null);
      }

      let q = collection(db, 'users');
      
      // Apply category-based ordering
      const orderField = getOrderField(filters.category);
      let constraints: QueryConstraint[] = [
        orderBy(orderField, 'desc'),
        limit(loadMore ? 20 : maxUsers)
      ];

      // Add community filter if specified
      if (filters.communityId) {
        constraints.unshift(where('followedCommunities', 'array-contains', filters.communityId));
      }

      // Add timeframe constraints for non-all-time
      if (filters.timeframe !== 'all-time') {
        const timeConstraint = getTimeConstraint(filters.timeframe);
        if (timeConstraint) {
          constraints.unshift(where('lastActiveAt', '>=', timeConstraint));
        }
      }

      // Add pagination
      if (loadMore && lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const leaderboardQuery = query(q, ...constraints);
      const snapshot = await getDocs(leaderboardQuery);
      
      if (snapshot.empty) {
        setHasMore(false);
        if (!loadMore) setLoading(false);
        return;
      }

      const users = snapshot.docs.map((doc, index) => {
        const data = doc.data();
        return {
          id: doc.id,
          displayName: data.displayName || 'Anonymous',
          photoURL: data.photoURL,
          points: data.points || 0,
          level: data.level || 1,
          totalPosts: data.totalPosts || 0,
          totalComments: data.totalComments || 0,
          totalVotes: data.totalVotes || 0,
          achievementsCount: data.achievements?.length || 0,
          communitiesJoined: data.followedCommunities?.length || 0,
          currentStreak: data.currentStreak || 0,
          badges: data.badges || [],
          lastActiveAt: data.lastActiveAt?.toDate() || new Date(),
          rank: loadMore ? leaderboardData.length + index + 1 : index + 1
        } as LeaderboardUser;
      });

      if (loadMore) {
        setLeaderboardData(prev => [...prev, ...users]);
      } else {
        setLeaderboardData(users);
        
        // Find current user's rank
        if (user) {
          const userIndex = users.findIndex(u => u.id === user.uid);
          if (userIndex !== -1) {
            setUserRank(userIndex + 1);
          } else {
            // User not in top results, need to find their rank
            findUserRank();
          }
        }
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === (loadMore ? 20 : maxUsers));
      
      if (!loadMore) setLoading(false);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setLoading(false);
    }
  };

  const findUserRank = async () => {
    if (!user?.uid || !db) return;

    try {
      const orderField = getOrderField(filters.category);
      const userQuery = query(
        collection(db, 'users'),
        orderBy(orderField, 'desc')
      );

      const snapshot = await getDocs(userQuery);
      const userIndex = snapshot.docs.findIndex(doc => doc.id === user.uid);
      if (userIndex !== -1) {
        setUserRank(userIndex + 1);
      }
    } catch (error) {
      console.error('Error finding user rank:', error);
    }
  };

  const getOrderField = (category: string): string => {
    switch (category) {
      case 'posts': return 'totalPosts';
      case 'comments': return 'totalComments';
      case 'votes': return 'totalVotes';
      case 'achievements': return 'achievementsCount';
      default: return 'points';
    }
  };

  const getTimeConstraint = (timeframe: string): Date | null => {
    const now = new Date();
    switch (timeframe) {
      case 'daily':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  };

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'posts': return 'Top Contributors';
      case 'comments': return 'Most Active Commenters';
      case 'votes': return 'Most Engaged Voters';
      case 'achievements': return 'Achievement Hunters';
      default: return 'Overall Leaders';
    }
  };


  const getRankColor = (rank: number): string => {
    if (rank === 1) return 'text-yellow-600 bg-yellow-50';
    if (rank === 2) return 'text-gray-600 bg-gray-50';
    if (rank === 3) return 'text-orange-600 bg-orange-50';
    if (rank <= 10) return 'text-purple-600 bg-purple-50';
    return 'text-blue-600 bg-blue-50';
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-gray-100 rounded-lg">
                <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/3"></div>
                </div>
                <div className="w-16 h-8 bg-gray-300 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <span>🏆</span>
            <span>Leaderboard</span>
          </h2>
          <p className="text-gray-600 mt-1">
            {getCategoryLabel(filters.category)} - {filters.timeframe.replace('-', ' ')}
          </p>
        </div>
        
        {userRank && (
          <div className={`px-4 py-2 rounded-lg ${getRankColor(userRank)}`}>
            <div className="text-sm font-medium">Your Rank</div>
            <div className="text-xl font-bold">#{userRank}</div>
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg border p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="overall">Overall Points</option>
                <option value="posts">Most Posts</option>
                <option value="comments">Most Comments</option>
                <option value="votes">Most Votes</option>
                <option value="achievements">Most Achievements</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Timeframe</label>
              <select
                value={filters.timeframe}
                onChange={(e) => setFilters(prev => ({ ...prev, timeframe: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all-time">All Time</option>
                <option value="monthly">This Month</option>
                <option value="weekly">This Week</option>
                <option value="daily">Today</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => loadLeaderboard()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-white rounded-lg border">
        <div className="p-6">
          <div className="space-y-2">
            {leaderboardData.map((leaderUser, index) => (
              <LeaderboardItem
                key={leaderUser.id}
                user={leaderUser}
                rank={leaderUser.rank || index + 1}
                category={filters.category}
                isCurrentUser={user?.uid === leaderUser.id}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={() => loadLeaderboard(true)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Load More
              </button>
            </div>
          )}

          {leaderboardData.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">🏆</div>
              <h3 className="text-lg font-semibold mb-2">No data available</h3>
              <p>Be the first to make it to the leaderboard!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Leaderboard Item Component
function LeaderboardItem({ 
  user, 
  rank, 
  category, 
  isCurrentUser 
}: { 
  user: LeaderboardUser; 
  rank: number; 
  category: string;
  isCurrentUser: boolean;
}) {
  const value = getCategoryValue(user, category);
  const unit = getCategoryUnit(category);
  const rankIcon = getRankIcon(rank);
  const rankColor = getRankColor(rank);

  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
      isCurrentUser 
        ? 'bg-blue-50 border-2 border-blue-200' 
        : 'bg-gray-50 hover:bg-gray-100'
    }`}>
      {/* Rank */}
      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold ${rankColor}`}>
        <span className="text-lg">{rankIcon}</span>
      </div>

      {/* User Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white font-semibold">
            {user.displayName[0]?.toUpperCase()}
          </div>
        )}
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/profile/${user.id}`}
              className="font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate"
            >
              {user.displayName}
            </Link>
            {isCurrentUser && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                You
              </span>
            )}
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-500">Level {user.level}</span>
              {user.badges.slice(0, 3).map((badge, idx) => (
                <span key={idx} className="text-sm">{badge}</span>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
            <span>{user.points.toLocaleString()} pts</span>
            <span>{user.currentStreak} day streak</span>
            {user.achievementsCount > 0 && (
              <span>{user.achievementsCount} achievements</span>
            )}
          </div>
        </div>
      </div>

      {/* Category Value */}
      <div className="flex-shrink-0 text-right">
        <div className="text-2xl font-bold text-gray-900">
          {value.toLocaleString()}
        </div>
        <div className="text-sm text-gray-500 capitalize">{unit}</div>
      </div>

      {/* Rank Number */}
      <div className="flex-shrink-0 w-8 text-center">
        <div className="text-lg font-bold text-gray-600">#{rank}</div>
      </div>
    </div>
  );
}

// Helper functions (duplicate from above for component scope)
function getCategoryValue(user: LeaderboardUser, category: string): number {
  switch (category) {
    case 'posts': return user.totalPosts;
    case 'comments': return user.totalComments;
    case 'votes': return user.totalVotes;
    case 'achievements': return user.achievementsCount;
    default: return user.points;
  }
}

function getCategoryUnit(category: string): string {
  switch (category) {
    case 'posts': return 'posts';
    case 'comments': return 'comments';
    case 'votes': return 'votes';
    case 'achievements': return 'achievements';
    default: return 'points';
  }
}

function getRankIcon(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank <= 10) return '🏆';
  if (rank <= 25) return '🎖️';
  return '📊';
}

function getRankColor(rank: number): string {
  if (rank === 1) return 'text-yellow-600 bg-yellow-50';
  if (rank === 2) return 'text-gray-600 bg-gray-50';
  if (rank === 3) return 'text-orange-600 bg-orange-50';
  if (rank <= 10) return 'text-purple-600 bg-purple-50';
  return 'text-blue-600 bg-blue-50';
}