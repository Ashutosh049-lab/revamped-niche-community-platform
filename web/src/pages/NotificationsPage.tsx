import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { useFirestoreRealtime } from '../hooks/useFirestoreRealtime';
import { where, orderBy, limit } from 'firebase/firestore';
import { useToast } from '../components/ToastProvider';
import PageAlert from '../components/PageAlert';

interface Notification {
  id: string;
  userId: string;
  type: 'comment' | 'reaction' | 'follow' | 'mention' | 'achievement' | 'poll' | 'post';
  title: string;
  message: string;
  data: {
    targetId?: string;
    targetType?: string;
    communityId?: string;
    authorId?: string;
    actionUrl?: string;
  };
  isRead: boolean;
  createdAt: Date;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread' | 'mentions' | 'reactions' | 'follows'>('all');
  const [showSettings, setShowSettings] = useState(false);

  const constraints = user ? [
    where('userId', '==', user.uid),
    orderBy('createdAt', 'desc'),
    limit(50)
  ] : [];

  const { data: notifications, loading, error } = useFirestoreRealtime<Notification>({
    collection: 'notifications',
    constraints,
    enableRealTimeUpdates: true
  });

  const { showToast } = useToast();
  useEffect(() => {
    if (error) {
      showToast('Failed to load notifications.', 'error');
    }
  }, [error]);

  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case 'unread':
        return !notification.isRead;
      case 'mentions':
        return notification.type === 'mention';
      case 'reactions':
        return notification.type === 'reaction';
      case 'follows':
        return notification.type === 'follow';
      default:
        return true;
    }
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return '💬';
      case 'reaction':
        return '😊';
      case 'follow':
        return '👥';
      case 'mention':
        return '📢';
      case 'achievement':
        return '🏆';
      case 'poll':
        return '📊';
      case 'post':
        return '📝';
      default:
        return '🔔';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'comment':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'reaction':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'follow':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'mention':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'achievement':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'poll':
        return 'text-indigo-600 bg-indigo-50 border-indigo-200';
      case 'post':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h1>
          <p className="text-gray-600 mb-6">You need to sign in to view your notifications.</p>
          <Link 
            to="/login" 
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                🔔 Notifications
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-sm px-2 py-1 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h1>
              <p className="text-gray-600">
                Stay up to date with your community activity
              </p>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-4 bg-white rounded-lg border p-4">
              <h3 className="font-semibold mb-3">Notification Settings</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm">Comments on my posts</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm">Reactions to my content</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm">New followers</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm">Mentions in posts/comments</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm">Email notifications</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg border mb-6">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'all', label: 'All', count: notifications.length },
              { id: 'unread', label: 'Unread', count: unreadCount },
              { id: 'mentions', label: 'Mentions', icon: '📢' },
              { id: 'reactions', label: 'Reactions', icon: '😊' },
              { id: 'follows', label: 'Follows', icon: '👥' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  filter === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon && <span>{tab.icon}</span>}
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

        {/* Notifications List */}
        <div className="bg-white rounded-lg border">
          {loading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="max-w-xl mx-auto">
                <PageAlert type="error" title="Error loading notifications">
                  Please try again. If the issue persists, check your connection or reload the page.
                </PageAlert>
              </div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl text-gray-300 mb-4">🔔</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </h3>
              <p className="text-gray-500">
                {filter === 'unread' 
                  ? 'You have no unread notifications.'
                  : 'When you interact with communities, notifications will appear here.'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !notification.isRead ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTypeColor(notification.type)}`}>
                      <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-2">
                          <h4 className="font-medium text-gray-900 mb-1">
                            {notification.title}
                          </h4>
                          <p className="text-gray-600 text-sm mb-2">
                            {notification.message}
                          </p>
                          <div className="text-xs text-gray-500">
                            {formatRelativeTime(notification.createdAt)}
                          </div>
                        </div>
                        
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2"></div>
                        )}
                      </div>
                      
                      {notification.data.actionUrl && (
                        <div className="mt-2">
                          <Link
                            to={notification.data.actionUrl}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View →
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}