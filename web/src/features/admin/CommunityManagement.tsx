import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  doc, 
  where,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthProvider';

interface CommunityStats {
  totalMembers: number;
  totalPosts: number;
  totalComments: number;
  activeUsers: number;
  newMembersThisWeek: number;
  engagement: number;
}

interface ReportedContent {
  id: string;
  type: 'post' | 'comment';
  content: string;
  authorId: string;
  authorName: string;
  reportedBy: string[];
  reportReasons: string[];
  createdAt: Date;
  status: 'pending' | 'reviewed' | 'removed' | 'dismissed';
}

interface CommunityMember {
  id: string;
  displayName: string;
  photoURL?: string;
  role: 'member' | 'moderator' | 'admin';
  joinedAt: Date;
  lastActiveAt: Date;
  totalPosts: number;
  totalComments: number;
  warnings: number;
  status: 'active' | 'suspended' | 'banned';
}

interface CommunityManagementProps {
  communityId: string;
}

export default function CommunityManagement({ communityId }: CommunityManagementProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CommunityStats>({
    totalMembers: 0,
    totalPosts: 0,
    totalComments: 0,
    activeUsers: 0,
    newMembersThisWeek: 0,
    engagement: 0
  });
  const [reportedContent, setReportedContent] = useState<ReportedContent[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [userRole, setUserRole] = useState<string>('member');

  useEffect(() => {
    loadData();
  }, [communityId, user]);

  const loadData = async () => {
    if (!communityId || !db) return;

    setLoading(true);
    try {
      await Promise.all([
        loadCommunityStats(),
        loadReportedContent(),
        loadMembers(),
        loadUserRole()
      ]);
    } catch (error) {
      console.error('Error loading community management data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCommunityStats = async () => {
    try {
      // Load community statistics
      const communityRef = doc(db, 'communities', communityId);
      const communityDoc = await getDoc(communityRef);
      
      if (communityDoc.exists()) {
        const data = communityDoc.data();
        setStats({
          totalMembers: data.memberCount || 0,
          totalPosts: data.postCount || 0,
          totalComments: data.commentCount || 0,
          activeUsers: data.activeUsers || 0,
          newMembersThisWeek: data.newMembersThisWeek || 0,
          engagement: data.engagementRate || 0
        });
      }
    } catch (error) {
      console.error('Error loading community stats:', error);
    }
  };

  const loadReportedContent = async () => {
    try {
      const reportsQuery = query(
        collection(db, 'reports'),
        where('communityId', '==', communityId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(reportsQuery);
      const reports = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type,
          content: data.content,
          authorId: data.authorId,
          authorName: data.authorName,
          reportedBy: data.reportedBy || [],
          reportReasons: data.reportReasons || [],
          createdAt: data.createdAt.toDate(),
          status: data.status
        } as ReportedContent;
      });

      setReportedContent(reports);
    } catch (error) {
      console.error('Error loading reported content:', error);
    }
  };

  const loadMembers = async () => {
    try {
      const membersQuery = query(
        collection(db, 'users'),
        where('followedCommunities', 'array-contains', communityId),
        orderBy('lastActiveAt', 'desc'),
        limit(100)
      );

      const snapshot = await getDocs(membersQuery);
      const membersList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          displayName: data.displayName || 'Anonymous',
          photoURL: data.photoURL,
          role: data.roles?.[communityId] || 'member',
          joinedAt: data.joinedCommunities?.[communityId]?.toDate() || new Date(),
          lastActiveAt: data.lastActiveAt?.toDate() || new Date(),
          totalPosts: data.communityStats?.[communityId]?.posts || 0,
          totalComments: data.communityStats?.[communityId]?.comments || 0,
          warnings: data.warnings?.[communityId] || 0,
          status: data.status || 'active'
        } as CommunityMember;
      });

      setMembers(membersList);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const loadUserRole = async () => {
    if (!user?.uid) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserRole(userData.roles?.[communityId] || 'member');
      }
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  };

  const handleReportAction = async (reportId: string, action: 'approve' | 'dismiss' | 'remove') => {
    try {
      const reportRef = doc(db, 'reports', reportId);
      const batch = writeBatch(db);

      if (action === 'remove') {
        const report = reportedContent.find(r => r.id === reportId);
        if (report) {
          // Remove the actual content
          if (report.type === 'post') {
            batch.delete(doc(db, 'posts', report.id));
          } else if (report.type === 'comment') {
            batch.delete(doc(db, 'comments', report.id));
          }
        }
        batch.update(reportRef, { status: 'removed', reviewedAt: new Date(), reviewedBy: user?.uid });
      } else if (action === 'dismiss') {
        batch.update(reportRef, { status: 'dismissed', reviewedAt: new Date(), reviewedBy: user?.uid });
      }

      await batch.commit();
      setReportedContent(prev => prev.filter(r => r.id !== reportId));
    } catch (error) {
      console.error('Error handling report action:', error);
    }
  };

  const handleMemberAction = async (memberId: string, action: 'promote' | 'demote' | 'warn' | 'suspend' | 'ban') => {
    try {
      const memberRef = doc(db, 'users', memberId);
      const batch = writeBatch(db);

      switch (action) {
        case 'promote':
          batch.update(memberRef, {
            [`roles.${communityId}`]: 'moderator'
          });
          break;
        case 'demote':
          batch.update(memberRef, {
            [`roles.${communityId}`]: 'member'
          });
          break;
        case 'warn':
          batch.update(memberRef, {
            [`warnings.${communityId}`]: (members.find(m => m.id === memberId)?.warnings || 0) + 1
          });
          break;
        case 'suspend':
          batch.update(memberRef, {
            status: 'suspended',
            suspendedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          });
          break;
        case 'ban':
          batch.update(memberRef, {
            status: 'banned',
            bannedFrom: { [communityId]: new Date() }
          });
          break;
      }

      await batch.commit();
      await loadMembers(); // Refresh members list
    } catch (error) {
      console.error('Error handling member action:', error);
    }
  };

  const canPerformAction = (requiredRole: string) => {
    const roleHierarchy = { member: 0, moderator: 1, admin: 2 };
    return roleHierarchy[userRole as keyof typeof roleHierarchy] >= roleHierarchy[requiredRole as keyof typeof roleHierarchy];
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!canPerformAction('moderator')) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 text-xl mb-2">Access Denied</div>
          <p className="text-red-700">You don't have permission to access community management tools.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🛡️</span>
            <span>Community Management</span>
          </h1>
          <p className="text-gray-600 mt-1">Moderate and manage your community</p>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-gray-200">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'reports', label: 'Reports', icon: '🚨', badge: reportedContent.length },
              { id: 'members', label: 'Members', icon: '👥' },
              { id: 'settings', label: 'Settings', icon: '⚙️' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 relative ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-1">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Members</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalMembers.toLocaleString()}</p>
                </div>
                <div className="text-blue-500 text-3xl">👥</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Posts</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPosts.toLocaleString()}</p>
                </div>
                <div className="text-green-500 text-3xl">📝</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeUsers.toLocaleString()}</p>
                </div>
                <div className="text-purple-500 text-3xl">⚡</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Comments</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalComments.toLocaleString()}</p>
                </div>
                <div className="text-yellow-500 text-3xl">💬</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">New This Week</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.newMembersThisWeek.toLocaleString()}</p>
                </div>
                <div className="text-indigo-500 text-3xl">📈</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Engagement</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round(stats.engagement)}%</p>
                </div>
                <div className="text-red-500 text-3xl">🎯</div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-500 text-center py-8">Recent activity feed would go here</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Reported Content</h2>
          </div>
          <div className="p-6">
            {reportedContent.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✨</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports</h3>
                <p className="text-gray-600">All content is looking good!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reportedContent.map(report => (
                  <div key={report.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          report.type === 'post' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {report.type}
                        </span>
                        <span className="text-sm text-gray-600">by {report.authorName}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {report.reportedBy.length} report{report.reportedBy.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-gray-900 mb-2">{report.content}</p>
                      <div className="flex flex-wrap gap-1">
                        {report.reportReasons.map((reason, idx) => (
                          <span key={idx} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReportAction(report.id, 'dismiss')}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleReportAction(report.id, 'remove')}
                        className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                      >
                        Remove Content
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Community Members</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {members.map(member => (
                  <tr key={member.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {member.photoURL ? (
                          <img src={member.photoURL} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-semibold">
                            {member.displayName[0]}
                          </div>
                        )}
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{member.displayName}</div>
                          <div className="text-sm text-gray-500">
                            {member.warnings > 0 && (
                              <span className="text-red-600">{member.warnings} warning{member.warnings !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        member.role === 'admin' ? 'bg-red-100 text-red-800' :
                        member.role === 'moderator' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{member.totalPosts} posts</div>
                      <div>{member.totalComments} comments</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        member.status === 'active' ? 'bg-green-100 text-green-800' :
                        member.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        {canPerformAction('admin') && member.role !== 'admin' && (
                          <>
                            {member.role === 'member' ? (
                              <button
                                onClick={() => handleMemberAction(member.id, 'promote')}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Promote
                              </button>
                            ) : (
                              <button
                                onClick={() => handleMemberAction(member.id, 'demote')}
                                className="text-orange-600 hover:text-orange-900"
                              >
                                Demote
                              </button>
                            )}
                          </>
                        )}
                        {member.status === 'active' && (
                          <>
                            <button
                              onClick={() => handleMemberAction(member.id, 'warn')}
                              className="text-yellow-600 hover:text-yellow-900"
                            >
                              Warn
                            </button>
                            <button
                              onClick={() => handleMemberAction(member.id, 'suspend')}
                              className="text-red-600 hover:text-red-900"
                            >
                              Suspend
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}