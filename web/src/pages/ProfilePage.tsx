import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import ProfileCustomization from '../features/profile/ProfileCustomization';
import LeaderboardSystem from '../features/leaderboard/LeaderboardSystem';
import { useToast } from '../components/ToastProvider';

interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  bio?: string;
  avatar?: string;
  interests: string[];
  followedCommunities: string[];
  achievements: string[];
  stats: {
    totalPosts: number;
    totalComments: number;
    totalVotes: number;
    reputation: number;
  };
  createdAt: Date;
  lastActiveAt: Date;
}

interface UserPost {
  id: string;
  title: string;
  content: string;
  communityId: string;
  communityName: string;
  voteScore: number;
  commentCount: number;
  createdAt: Date;
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'achievements' | 'edit'>('overview');
  
  const isOwnProfile = !userId || userId === currentUser?.uid;
  const targetUserId = userId || currentUser?.uid;
  const { showToast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!targetUserId || !db) return;

      try {
        setLoading(true);

        // Fetch user profile
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setProfile({
            id: userDoc.id,
            displayName: userData.displayName || userData.email || 'Anonymous',
            email: userData.email,
            bio: userData.bio,
            avatar: userData.avatar,
            interests: userData.interests || [],
            followedCommunities: userData.followedCommunities || [],
            achievements: userData.achievements || [],
            stats: {
              totalPosts: userData.stats?.totalPosts || 0,
              totalComments: userData.stats?.totalComments || 0,
              totalVotes: userData.stats?.totalVotes || 0,
              reputation: userData.stats?.reputation || 0
            },
            createdAt: userData.createdAt?.toDate() || new Date(),
            lastActiveAt: userData.lastActiveAt?.toDate() || new Date()
          });
        }

        // Fetch user's recent posts
        const postsQuery = query(
          collection(db, 'posts'),
          where('authorId', '==', targetUserId),
          orderBy('createdAt', 'desc'),
          limit(10)
        );

        const postsSnapshot = await getDocs(postsQuery);
        const posts: UserPost[] = [];

        for (const postDoc of postsSnapshot.docs) {
          const postData = postDoc.data();
          
          // Get community name
          let communityName = 'Unknown Community';
          try {
            const communityDoc = await getDoc(doc(db, 'communities', postData.communityId));
            if (communityDoc.exists()) {
              communityName = communityDoc.data().name;
            }
          } catch (error) {
            console.warn('Error fetching community name:', error);
          }

          posts.push({
            id: postDoc.id,
            title: postData.title,
            content: postData.content,
            communityId: postData.communityId,
            communityName,
            voteScore: postData.voteScore || 0,
            commentCount: postData.commentCount || 0,
            createdAt: postData.createdAt?.toDate() || new Date()
          });
        }

        setUserPosts(posts);
      } catch (error) {
        console.error('Error fetching profile:', error);
        showToast('Failed to load profile', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [targetUserId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="bg-white rounded-lg border p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-20 h-20 bg-gray-200 rounded-full"></div>
                <div>
                  <div className="h-6 bg-gray-200 rounded w-32 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-48"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">User Not Found</h1>
          <p className="text-gray-600 mb-4">The user profile you're looking for doesn't exist.</p>
          <Link to="/" className="text-blue-600 hover:text-blue-800">← Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Profile Header */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.displayName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  profile.displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{profile.displayName}</h1>
                <p className="text-gray-600">{profile.email}</p>
                {profile.bio && (
                  <p className="text-gray-700 mt-2 max-w-md">{profile.bio}</p>
                )}
              </div>
            </div>
            
            <div className="flex-1 md:text-right">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{profile.stats.totalPosts}</div>
                  <div className="text-sm text-gray-600">Posts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{profile.stats.totalComments}</div>
                  <div className="text-sm text-gray-600">Comments</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{profile.followedCommunities.length}</div>
                  <div className="text-sm text-gray-600">Communities</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{profile.stats.reputation}</div>
                  <div className="text-sm text-gray-600">Reputation</div>
                </div>
              </div>
              
              <div className="text-sm text-gray-500">
                Joined {profile.createdAt.toLocaleDateString()} • 
                Last seen {profile.lastActiveAt.toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg border mb-6">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'posts', label: 'Posts', icon: '📝', count: profile.stats.totalPosts },
              { id: 'achievements', label: 'Achievements', icon: '🏆', count: profile.achievements.length },
              ...(isOwnProfile ? [{ id: 'edit', label: 'Edit Profile', icon: '⚙️' }] : [])
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

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Interests */}
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-semibold mb-4">Interests</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.length > 0 ? (
                      profile.interests.map((interest, index) => (
                        <span
                          key={index}
                          className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                        >
                          {interest}
                        </span>
                      ))
                    ) : (
                      <p className="text-gray-500">No interests listed</p>
                    )}
                  </div>
                </div>

                {/* Recent Posts */}
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-semibold mb-4">Recent Posts</h3>
                  <div className="space-y-4">
                    {userPosts.length > 0 ? (
                      userPosts.slice(0, 3).map(post => (
                        <div key={post.id} className="border-l-4 border-blue-500 pl-4">
                          <Link 
                            to={`/c/${post.communityId}/post/${post.id}`}
                            className="text-lg font-medium text-gray-900 hover:text-blue-600 block"
                          >
                            {post.title}
                          </Link>
                          <div className="text-sm text-gray-600 mt-1">
                            in {post.communityName} • {post.createdAt.toLocaleDateString()} • 
                            {post.voteScore} votes • {post.commentCount} comments
                          </div>
                          <p className="text-gray-700 mt-2 line-clamp-2">
                            {post.content.substring(0, 150)}...
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">No posts yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'posts' && (
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">All Posts</h3>
                <div className="space-y-4">
                  {userPosts.length > 0 ? (
                    userPosts.map(post => (
                      <div key={post.id} className="border-l-4 border-blue-500 pl-4">
                        <Link 
                          to={`/c/${post.communityId}/post/${post.id}`}
                          className="text-lg font-medium text-gray-900 hover:text-blue-600 block"
                        >
                          {post.title}
                        </Link>
                        <div className="text-sm text-gray-600 mt-1">
                          in {post.communityName} • {post.createdAt.toLocaleDateString()} • 
                          {post.voteScore} votes • {post.commentCount} comments
                        </div>
                        <p className="text-gray-700 mt-2">
                          {post.content.substring(0, 200)}...
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No posts yet</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'achievements' && (
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">Achievements</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile.achievements.length > 0 ? (
                    profile.achievements.map((achievement, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                        <span className="text-2xl">🏆</span>
                        <div>
                          <div className="font-medium">{achievement}</div>
                          <div className="text-sm text-gray-600">Achievement unlocked</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-8">
                      <span className="text-4xl text-gray-300">🏆</span>
                      <p className="text-gray-500 mt-2">No achievements yet</p>
                      <p className="text-sm text-gray-400">Keep participating to earn badges!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'edit' && isOwnProfile && (
              <ProfileCustomization />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Leaderboard Position */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4">Leaderboard</h3>
              <LeaderboardSystem />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}