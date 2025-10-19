import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import PersonalizedRecommendations from '../components/PersonalizedRecommendations';
import ActivityIndicators from '../components/ActivityIndicators';
import AuthTest from '../components/AuthTest';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface UserStats {
  totalPosts: number;
  totalComments: number;
  totalVotes: number;
  joinedCommunities: string[];
  achievements: string[];
  lastActiveAt: Date;
}

export default function HomePage() {
  const { user } = useAuth();
  const [userStats, setUserStats] = useState<UserStats | null>(null);

  useEffect(() => {
    if (!user?.uid || !db) {
      return;
    }

    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      try {
        if (snap.exists()) {
          const userData: any = snap.data();
          setUserStats({
            totalPosts: userData.stats?.totalPosts || 0,
            totalComments: userData.stats?.totalComments || 0,
            totalVotes: userData.stats?.totalVotes || 0,
            joinedCommunities: userData.followedCommunities || [],
            achievements: userData.achievements || [],
            lastActiveAt: userData.lastActiveAt?.toDate?.() || new Date()
          });
        } else {
          setUserStats(null);
        }
      } catch (e) {
        console.error('Error parsing user stats:', e);
      } finally {
      }
    }, (err) => {
      console.error('User stats subscription error:', err);
    });

    return () => { try { unsub(); } catch {} };
  }, [user?.uid]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          {/* Hero Section */}
          <div className="text-center py-20">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Welcome to Your Niche Community Platform
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Connect with like-minded individuals, discover trending discussions, 
              and participate in vibrant communities tailored to your interests.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                to="/login"
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="bg-white text-blue-600 px-8 py-3 rounded-lg border border-blue-600 hover:bg-blue-50 transition-colors font-medium"
              >
                Create Account
              </Link>
            </div>
          </div>
          
          {/* Temporary Auth Test */}
          <AuthTest />

          {/* Features Preview */}
          <div className="grid md:grid-cols-3 gap-8 py-16">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏠</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Personalized Dashboard</h3>
              <p className="text-gray-600">Get personalized recommendations and continue where you left off</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Niche Communities</h3>
              <p className="text-gray-600">Join specialized communities that match your interests</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Real-time Engagement</h3>
              <p className="text-gray-600">Live discussions with instant notifications and updates</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user.displayName || 'User'}! 👋
          </h1>
          <p className="text-gray-600">
            Here's what's happening in your communities today
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">{userStats?.totalPosts || 0}</div>
                <div className="text-sm text-gray-600">Posts</div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-2xl font-bold text-green-600">{userStats?.totalComments || 0}</div>
                <div className="text-sm text-gray-600">Comments</div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-2xl font-bold text-purple-600">{userStats?.joinedCommunities?.length || 0}</div>
                <div className="text-sm text-gray-600">Communities</div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-2xl font-bold text-orange-600">{userStats?.achievements?.length || 0}</div>
                <div className="text-sm text-gray-600">Achievements</div>
              </div>
            </div>

            {/* Continue Where You Left Off */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-xl font-semibold mb-4">Continue Where You Left Off</h2>
              <div className="space-y-3">
                <Link 
                  to="/feed" 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-2xl">📰</span>
                  <div>
                    <div className="font-medium">Your Feed</div>
                    <div className="text-sm text-gray-600">Catch up on latest posts from your communities</div>
                  </div>
                </Link>
                <Link 
                  to="/notifications" 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-2xl">🔔</span>
                  <div>
                    <div className="font-medium">Notifications</div>
                    <div className="text-sm text-gray-600">Check your latest mentions and replies</div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Trending Today */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                🔥 Trending Today
              </h2>
              <ActivityIndicators />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Community Recommendations */}
            <PersonalizedRecommendations 
              type="communities" 
              maxItems={5}
            />

            {/* Post Recommendations */}
            <PersonalizedRecommendations 
              type="posts" 
              maxItems={5}
              hideWhenEmpty
            />

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link 
                  to="/communities" 
                  className="block w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
                >
                  🔍 Discover Communities
                </Link>
                <Link 
                  to="/feed" 
                  className="block w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
                >
                  ✨ Create Post
                </Link>
                <Link 
                  to="/profile" 
                  className="block w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
                >
                  👤 Edit Profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}