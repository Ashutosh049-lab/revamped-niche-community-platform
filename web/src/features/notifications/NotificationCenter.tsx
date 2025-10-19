import { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc, 
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthProvider';
import { formatDistanceToNow } from 'date-fns';

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'mention' | 'follow' | 'achievement' | 'poll' | 'community' | 'system';
  title: string;
  message: string;
  recipientId: string;
  senderId?: string;
  senderName?: string;
  senderPhotoURL?: string;
  relatedContentId?: string;
  relatedContentType?: 'post' | 'comment' | 'poll' | 'community';
  actionUrl?: string;
  isRead: boolean;
  isPinned: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  metadata: {
    [key: string]: any;
  };
  createdAt: Date;
  readAt?: Date;
  expiresAt?: Date;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  maxHeight?: string;
}

export default function NotificationCenter({ 
  isOpen, 
  onClose, 
  maxHeight = '500px' 
}: NotificationCenterProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'mentions' | 'achievements'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    // Set up real-time listener for notifications
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type,
          title: data.title,
          message: data.message,
          recipientId: data.recipientId,
          senderId: data.senderId,
          senderName: data.senderName,
          senderPhotoURL: data.senderPhotoURL,
          relatedContentId: data.relatedContentId,
          relatedContentType: data.relatedContentType,
          actionUrl: data.actionUrl,
          isRead: data.isRead || false,
          isPinned: data.isPinned || false,
          priority: data.priority || 'medium',
          category: data.category || 'general',
          metadata: data.metadata || {},
          createdAt: data.createdAt.toDate(),
          readAt: data.readAt?.toDate(),
          expiresAt: data.expiresAt?.toDate()
        } as Notification;
      });

      setNotifications(newNotifications);
      setUnreadCount(newNotifications.filter(n => !n.isRead).length);
      setLoading(false);
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    if (!db) return;

    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        isRead: true,
        readAt: new Date()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!db || !user?.uid) return;

    try {
      const batch = writeBatch(db);
      const unreadNotifications = notifications.filter(n => !n.isRead);

      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        batch.update(notificationRef, {
          isRead: true,
          readAt: new Date()
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Pin/unpin notification
  const togglePin = async (notificationId: string, isPinned: boolean) => {
    if (!db) return;

    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        isPinned: !isPinned
      });
    } catch (error) {
      console.error('Error toggling notification pin:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    if (!db) return;

    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        expiresAt: new Date() // Mark as expired instead of deleting
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Filter notifications based on current filter
  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case 'unread':
        return !notification.isRead;
      case 'mentions':
        return notification.type === 'mention';
      case 'achievements':
        return notification.type === 'achievement';
      default:
        return true;
    }
  });

  // Group notifications by priority and pin status
  const groupedNotifications = {
    pinned: filteredNotifications.filter(n => n.isPinned),
    urgent: filteredNotifications.filter(n => n.priority === 'urgent' && !n.isPinned),
    high: filteredNotifications.filter(n => n.priority === 'high' && !n.isPinned),
    regular: filteredNotifications.filter(n => 
      (n.priority === 'medium' || n.priority === 'low') && !n.isPinned
    )
  };


  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // Handle navigation based on notification type
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    } else if (notification.relatedContentId) {
      // Navigate to related content based on type
      switch (notification.relatedContentType) {
        case 'post':
          window.location.href = `/posts/${notification.relatedContentId}`;
          break;
        case 'community':
          window.location.href = `/communities/${notification.relatedContentId}`;
          break;
        case 'poll':
          window.location.href = `/polls/${notification.relatedContentId}`;
          break;
      }
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      {/* Notification Panel */}
      <div className="absolute right-4 top-16 w-96 bg-white rounded-lg shadow-2xl border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 mt-3">
            {[
              { key: 'all', label: 'All' },
              { key: 'unread', label: 'Unread' },
              { key: 'mentions', label: 'Mentions' },
              { key: 'achievements', label: 'Achievements' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === tab.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div 
          className="overflow-y-auto"
          style={{ maxHeight }}
        >
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-600">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <div className="text-4xl mb-2">🔔</div>
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {/* Pinned Notifications */}
              {groupedNotifications.pinned.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  onPin={() => togglePin(notification.id, notification.isPinned)}
                  onDelete={() => deleteNotification(notification.id)}
                  isPinned={true}
                />
              ))}

              {/* Urgent Notifications */}
              {groupedNotifications.urgent.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  onPin={() => togglePin(notification.id, notification.isPinned)}
                  onDelete={() => deleteNotification(notification.id)}
                />
              ))}

              {/* High Priority Notifications */}
              {groupedNotifications.high.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  onPin={() => togglePin(notification.id, notification.isPinned)}
                  onDelete={() => deleteNotification(notification.id)}
                />
              ))}

              {/* Regular Notifications */}
              {groupedNotifications.regular.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  onPin={() => togglePin(notification.id, notification.isPinned)}
                  onDelete={() => deleteNotification(notification.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => window.location.href = '/notifications'}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View all notifications
          </button>
        </div>
      </div>
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onPin: () => void;
  onDelete: () => void;
  isPinned?: boolean;
}

function NotificationItem({ 
  notification, 
  onClick, 
  onPin, 
  onDelete, 
  isPinned = false 
}: NotificationItemProps) {
  const [showActions, setShowActions] = useState(false);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-blue-500';
      default: return 'border-l-gray-300';
    }
  };

  const getNotificationIcon = (type: string) => {
    const icons = {
      like: '❤️',
      comment: '💬',
      mention: '📢',
      follow: '👥',
      achievement: '🏆',
      poll: '📊',
      community: '🏘️',
      system: '⚙️'
    };
    return icons[type as keyof typeof icons] || '📢';
  };

  return (
    <div
      className={`relative p-4 hover:bg-gray-50 transition-colors cursor-pointer border-l-4 ${
        getPriorityColor(notification.priority)
      } ${!notification.isRead ? 'bg-blue-50' : ''} ${isPinned ? 'bg-yellow-50' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Pin indicator */}
      {isPinned && (
        <div className="absolute top-2 right-2">
          <span className="text-yellow-500">📌</span>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Avatar or Icon */}
        <div className="flex-shrink-0">
          {notification.senderPhotoURL ? (
            <img
              src={notification.senderPhotoURL}
              alt={notification.senderName}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm">
              {getNotificationIcon(notification.type)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {notification.title}
              </p>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {notification.message}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <span>{formatDistanceToNow(notification.createdAt)} ago</span>
                {notification.category && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{notification.category}</span>
                  </>
                )}
              </div>
            </div>

            {/* Unread indicator */}
            {!notification.isRead && (
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="absolute top-2 right-8 flex items-center gap-1 bg-white rounded shadow-md p-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            className="p-1 text-gray-400 hover:text-yellow-500"
            title={isPinned ? "Unpin" : "Pin"}
          >
            📌
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-gray-400 hover:text-red-500"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}

// Notification Bell Component for Header
export function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid || !db) return;

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      where('isRead', '==', false),
      where('expiresAt', '>', new Date())
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    });

    return unsubscribe;
  }, [user?.uid]);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationCenter 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
}