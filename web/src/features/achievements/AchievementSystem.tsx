import { useState, useEffect, useMemo } from 'react';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  increment, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthProvider';
import { createRecommendationEngine } from '../../services/RecommendationEngine';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'engagement' | 'community' | 'content' | 'social' | 'special';
  criteria: {
    type: 'posts' | 'comments' | 'votes' | 'reactions' | 'communities' | 'followers' | 'days' | 'special';
    threshold: number;
    period?: 'daily' | 'weekly' | 'monthly' | 'all-time';
  };
  points: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  unlockedBy: string[]; // User IDs who unlocked this
  totalUnlocked: number;
}

export interface UserAchievement {
  achievementId: string;
  unlockedAt: Timestamp;
  progress?: number;
  metadata?: any;
}

export interface UserStats {
  totalPosts: number;
  totalComments: number;
  totalVotes: number;
  totalReactions: number;
  communitiesJoined: number;
  daysActive: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  totalPoints: number;
  achievements: UserAchievement[];
  badges: string[];
}

const PREDEFINED_ACHIEVEMENTS: Omit<Achievement, 'id' | 'unlockedBy' | 'totalUnlocked'>[] = [
  // Engagement Achievements
  {
    name: "First Steps",
    description: "Create your first post",
    icon: "👶",
    category: "engagement",
    criteria: { type: "posts", threshold: 1 },
    points: 10,
    rarity: "common"
  },
  {
    name: "Conversationalist",
    description: "Leave 10 comments",
    icon: "💬",
    category: "engagement", 
    criteria: { type: "comments", threshold: 10 },
    points: 25,
    rarity: "common"
  },
  {
    name: "Active Contributor",
    description: "Create 25 posts",
    icon: "✍️",
    category: "content",
    criteria: { type: "posts", threshold: 25 },
    points: 100,
    rarity: "uncommon"
  },
  {
    name: "Content Creator",
    description: "Create 100 posts",
    icon: "🎨",
    category: "content",
    criteria: { type: "posts", threshold: 100 },
    points: 500,
    rarity: "rare"
  },
  {
    name: "Community Builder",
    description: "Join 5 communities",
    icon: "🏗️",
    category: "community",
    criteria: { type: "communities", threshold: 5 },
    points: 50,
    rarity: "common"
  },
  {
    name: "Social Butterfly",
    description: "Get 100 reactions on your content",
    icon: "🦋",
    category: "social",
    criteria: { type: "reactions", threshold: 100 },
    points: 150,
    rarity: "uncommon"
  },
  {
    name: "Voter",
    description: "Cast 50 votes",
    icon: "🗳️",
    category: "engagement",
    criteria: { type: "votes", threshold: 50 },
    points: 75,
    rarity: "common"
  },
  {
    name: "Democracy Enthusiast", 
    description: "Cast 500 votes",
    icon: "🏛️",
    category: "engagement",
    criteria: { type: "votes", threshold: 500 },
    points: 300,
    rarity: "rare"
  },
  {
    name: "Weekly Warrior",
    description: "Be active for 7 consecutive days",
    icon: "⚡",
    category: "engagement",
    criteria: { type: "days", threshold: 7 },
    points: 200,
    rarity: "uncommon"
  },
  {
    name: "Dedication Legend",
    description: "Be active for 30 consecutive days",
    icon: "🏆",
    category: "engagement",
    criteria: { type: "days", threshold: 30 },
    points: 1000,
    rarity: "epic"
  },
  {
    name: "Community Explorer",
    description: "Join 20 different communities",
    icon: "🌍",
    category: "community",
    criteria: { type: "communities", threshold: 20 },
    points: 400,
    rarity: "rare"
  },
  {
    name: "Master Contributor",
    description: "Create 500 posts",
    icon: "👑",
    category: "content",
    criteria: { type: "posts", threshold: 500 },
    points: 2000,
    rarity: "legendary"
  }
];

interface AchievementSystemProps {
  userId?: string;
  showUserStats?: boolean;
  className?: string;
}

export default function AchievementSystem({ 
  userId, 
  showUserStats = true, 
  className = '' 
}: AchievementSystemProps) {
  const { user } = useAuth();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);

  const targetUserId = userId || user?.uid;
  const isOwnProfile = !userId || userId === user?.uid;

  const recommendationEngine = useMemo(() => 
    user ? createRecommendationEngine(user.uid) : null, 
    [user]
  );

  useEffect(() => {
    if (!targetUserId || !db) return;

    const loadUserStats = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserStats({
            totalPosts: userData.totalPosts || 0,
            totalComments: userData.totalComments || 0,
            totalVotes: userData.totalVotes || 0,
            totalReactions: userData.totalReactions || 0,
            communitiesJoined: userData.followedCommunities?.length || 0,
            daysActive: userData.daysActive || 0,
            currentStreak: userData.currentStreak || 0,
            longestStreak: userData.longestStreak || 0,
            level: userData.level || 1,
            totalPoints: userData.points || 0,
            achievements: userData.achievements || [],
            badges: userData.badges || []
          });
        }
      } catch (error) {
        console.error('Error loading user stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserStats();
  }, [targetUserId]);

  useEffect(() => {
    if (!userStats || !isOwnProfile) return;

    const checkAchievements = async () => {
      const newlyUnlocked: Achievement[] = [];

      for (const achievementTemplate of PREDEFINED_ACHIEVEMENTS) {
        const hasAchievement = userStats.achievements.some(
          ua => ua.achievementId === achievementTemplate.name
        );

        if (!hasAchievement && meetsAchievementCriteria(userStats, achievementTemplate)) {
          const achievement: Achievement = {
            ...achievementTemplate,
            id: achievementTemplate.name,
            unlockedBy: [],
            totalUnlocked: 0
          };

          newlyUnlocked.push(achievement);

          // Update user document
          try {
            await updateDoc(doc(db, 'users', user!.uid), {
              achievements: arrayUnion({
                achievementId: achievement.id,
                unlockedAt: Timestamp.now(),
                metadata: {}
              }),
              points: increment(achievement.points),
              badges: arrayUnion(achievement.icon)
            });

            // Track achievement unlock for recommendations
            if (recommendationEngine) {
              recommendationEngine.trackEngagement(
                'achievement' as any,
                achievement.id,
                'community',
                { category: achievement.category }
              );
            }
          } catch (error) {
            console.error('Error unlocking achievement:', error);
          }
        }
      }

      if (newlyUnlocked.length > 0) {
        setNewAchievements(newlyUnlocked);
        // Auto-hide after 5 seconds
        setTimeout(() => setNewAchievements([]), 5000);
      }
    };

    checkAchievements();
  }, [userStats, isOwnProfile, user, recommendationEngine]);

  const meetsAchievementCriteria = (stats: UserStats, achievement: any): boolean => {
    switch (achievement.criteria.type) {
      case 'posts':
        return stats.totalPosts >= achievement.criteria.threshold;
      case 'comments':
        return stats.totalComments >= achievement.criteria.threshold;
      case 'votes':
        return stats.totalVotes >= achievement.criteria.threshold;
      case 'reactions':
        return stats.totalReactions >= achievement.criteria.threshold;
      case 'communities':
        return stats.communitiesJoined >= achievement.criteria.threshold;
      case 'days':
        return stats.currentStreak >= achievement.criteria.threshold;
      default:
        return false;
    }
  };


  const getProgressToNextLevel = (): { current: number; next: number; percentage: number } => {
    if (!userStats) return { current: 0, next: 100, percentage: 0 };
    
    const pointsForLevel = (level: number) => level * level * 100; // Quadratic progression
    const currentLevelPoints = pointsForLevel(userStats.level);
    const nextLevelPoints = pointsForLevel(userStats.level + 1);
    const progressPoints = userStats.totalPoints - currentLevelPoints;
    const pointsNeeded = nextLevelPoints - currentLevelPoints;
    
    return {
      current: progressPoints,
      next: pointsNeeded,
      percentage: Math.min((progressPoints / pointsNeeded) * 100, 100)
    };
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!userStats) return null;

  const unlockedAchievements = PREDEFINED_ACHIEVEMENTS.filter(achievement =>
    userStats.achievements.some(ua => ua.achievementId === achievement.name)
  );

  const lockedAchievements = PREDEFINED_ACHIEVEMENTS.filter(achievement =>
    !userStats.achievements.some(ua => ua.achievementId === achievement.name)
  );

  const progress = getProgressToNextLevel();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* New Achievement Notifications */}
      {newAchievements.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {newAchievements.map((achievement) => (
            <div
              key={achievement.id}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-4 rounded-lg shadow-lg animate-bounce-in"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{achievement.icon}</span>
                <div>
                  <h4 className="font-semibold">Achievement Unlocked!</h4>
                  <p className="text-sm opacity-90">{achievement.name}</p>
                  <p className="text-xs opacity-75">+{achievement.points} points</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* User Stats Overview */}
      {showUserStats && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span>🏆</span>
              <span>{isOwnProfile ? 'Your Progress' : 'User Progress'}</span>
            </h2>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">Level {userStats.level}</div>
              <div className="text-sm text-gray-500">{userStats.totalPoints} points</div>
            </div>
          </div>

          {/* Level Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Progress to Level {userStats.level + 1}</span>
              <span>{progress.current} / {progress.next} points</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon="📝"
              label="Posts"
              value={userStats.totalPosts}
              color="blue"
            />
            <StatCard
              icon="💬"
              label="Comments"
              value={userStats.totalComments}
              color="green"
            />
            <StatCard
              icon="👍"
              label="Votes Cast"
              value={userStats.totalVotes}
              color="purple"
            />
            <StatCard
              icon="🏠"
              label="Communities"
              value={userStats.communitiesJoined}
              color="orange"
            />
          </div>

          {/* Streak Information */}
          <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔥</span>
                <div>
                  <div className="font-semibold text-gray-900">Activity Streak</div>
                  <div className="text-sm text-gray-600">Keep the momentum going!</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-600">
                  {userStats.currentStreak} days
                </div>
                <div className="text-xs text-gray-500">
                  Best: {userStats.longestStreak} days
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Achievements */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span>🎖️</span>
            <span>Achievements ({unlockedAchievements.length}/{PREDEFINED_ACHIEVEMENTS.length})</span>
          </h3>
        </div>

        <div className="p-6">
          {/* Unlocked Achievements */}
          {unlockedAchievements.length > 0 && (
            <div className="mb-8">
              <h4 className="font-medium text-gray-900 mb-4">Unlocked</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unlockedAchievements.map((achievement) => (
                  <AchievementCard
                    key={achievement.name}
                    achievement={{ ...achievement, id: achievement.name, unlockedBy: [], totalUnlocked: 0 }}
                    unlocked={true}
                    userAchievement={userStats.achievements.find(ua => ua.achievementId === achievement.name)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Locked Achievements */}
          {lockedAchievements.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Locked</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lockedAchievements.map((achievement) => (
                  <AchievementCard
                    key={achievement.name}
                    achievement={{ ...achievement, id: achievement.name, unlockedBy: [], totalUnlocked: 0 }}
                    unlocked={false}
                    progress={getAchievementProgress(userStats, achievement)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatCard({ icon, label, value, color }: { 
  icon: string; 
  label: string; 
  value: number; 
  color: string; 
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600'
  };

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}

function AchievementCard({ 
  achievement, 
  unlocked, 
  userAchievement,
  progress 
}: { 
  achievement: Achievement; 
  unlocked: boolean;
  userAchievement?: UserAchievement;
  progress?: number;
}) {
  const rarityClasses = achievement.rarity === 'common' ? 'text-gray-600 bg-gray-100' :
    achievement.rarity === 'uncommon' ? 'text-green-600 bg-green-100' :
    achievement.rarity === 'rare' ? 'text-blue-600 bg-blue-100' :
    achievement.rarity === 'epic' ? 'text-purple-600 bg-purple-100' :
    'text-yellow-600 bg-yellow-100';

  return (
    <div className={`p-4 rounded-lg border-2 transition-all ${
      unlocked 
        ? 'border-green-200 bg-green-50' 
        : 'border-gray-200 bg-gray-50 opacity-75'
    }`}>
      <div className="flex items-start gap-3 mb-3">
        <span className={`text-2xl ${unlocked ? '' : 'grayscale'}`}>
          {achievement.icon}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold ${unlocked ? 'text-gray-900' : 'text-gray-600'}`}>
            {achievement.name}
          </h4>
          <p className={`text-sm ${unlocked ? 'text-gray-600' : 'text-gray-500'}`}>
            {achievement.description}
          </p>
        </div>
        {unlocked && (
          <div className="flex-shrink-0">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${rarityClasses}`}>
          {achievement.rarity}
        </span>
        <span className={`text-sm font-medium ${unlocked ? 'text-green-600' : 'text-gray-500'}`}>
          +{achievement.points} points
        </span>
      </div>

      {!unlocked && progress !== undefined && progress > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {unlocked && userAchievement && (
        <div className="mt-3 text-xs text-gray-500">
          Unlocked {userAchievement.unlockedAt.toDate().toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

function getAchievementProgress(stats: UserStats, achievement: any): number {
  switch (achievement.criteria.type) {
    case 'posts':
      return Math.min((stats.totalPosts / achievement.criteria.threshold) * 100, 100);
    case 'comments':
      return Math.min((stats.totalComments / achievement.criteria.threshold) * 100, 100);
    case 'votes':
      return Math.min((stats.totalVotes / achievement.criteria.threshold) * 100, 100);
    case 'reactions':
      return Math.min((stats.totalReactions / achievement.criteria.threshold) * 100, 100);
    case 'communities':
      return Math.min((stats.communitiesJoined / achievement.criteria.threshold) * 100, 100);
    case 'days':
      return Math.min((stats.currentStreak / achievement.criteria.threshold) * 100, 100);
    default:
      return 0;
  }
}