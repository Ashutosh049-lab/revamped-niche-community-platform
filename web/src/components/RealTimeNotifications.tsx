import { useState, useEffect } from 'react';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import type { RealTimeItem } from '../hooks/useRealTimeUpdates';

interface RealTimeNotificationsProps {
  communityId?: string;
  className?: string;
}

export default function RealTimeNotifications({ communityId, className = '' }: RealTimeNotificationsProps) {
  const { notifications, clearNotifications, removeNotification } = useRealTimeUpdates(communityId);
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-collapse after 10 seconds of no new notifications
  useEffect(() => {
    if (notifications.length > 0 && isExpanded) {
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [notifications.length, isExpanded]);

  // Auto-expand when new notifications arrive
  useEffect(() => {
    if (notifications.length > 0) {
      setIsExpanded(true);
    }
  }, [notifications.length]);

  if (notifications.length === 0) return null;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'post':
        return '📝';
      case 'comment':
        return '💬';
      case 'poll':
        return '📊';
      case 'vote':
        return '👍';
      case 'reaction':
        return '😊';
      default:
        return '🔔';
    }
  };

  const getNotificationMessage = (item: RealTimeItem) => {
    switch (item.type) {
      case 'post':
        return `New post: ${item.data.title?.substring(0, 50)}${item.data.title?.length > 50 ? '...' : ''}`;
      case 'comment':
        return `New comment on "${item.data.postTitle?.substring(0, 30)}${item.data.postTitle?.length > 30 ? '...' : ''}"`;
      case 'poll':
        return `New poll: ${item.data.question?.substring(0, 50)}${item.data.question?.length > 50 ? '...' : ''}`;
      case 'vote':
        return `Someone ${item.data.lastVoteType} your content`;
      case 'reaction':
        return `Someone reacted ${item.data.lastReaction} to your content`;
      default:
        return 'New activity';
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <div className={`bg-white rounded-lg shadow-lg border transition-all duration-300 ${
        isExpanded ? 'w-80 max-h-96' : 'w-16 h-16'
      }`}>
        {/* Collapsed state - notification count button */}
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full h-full flex items-center justify-center relative hover:bg-gray-50 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M15 17h5l-5 5-5-5h5v-12a3 3 0 016 0v12z" />
            </svg>
            {notifications.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold animate-pulse">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>
        )}

        {/* Expanded state - notification list */}
        {isExpanded && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Recent Activity</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearNotifications}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Clear all
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {notifications.map((item) => (
                <NotificationItem
                  key={item.id}
                  item={item}
                  onRemove={removeNotification}
                  getIcon={getNotificationIcon}
                  getMessage={getNotificationMessage}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface NotificationItemProps {
  item: RealTimeItem;
  onRemove: (id: string) => void;
  getIcon: (type: string) => string;
  getMessage: (item: RealTimeItem) => string;
}

function NotificationItem({ item, onRemove, getIcon, getMessage }: NotificationItemProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsVisible(false);
    setTimeout(() => onRemove(item.id), 300);
  };

  const timeAgo = () => {
    const diff = Date.now() - item.timestamp;
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-300 ${
        isVisible ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform translate-x-4'
      } ${
        item.animation.isNew ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
      } hover:bg-gray-100 cursor-pointer`}
      onClick={() => {
        // TODO: Navigate to relevant content
        console.log('Navigate to:', item);
      }}
    >
      <span className="text-lg flex-shrink-0">{getIcon(item.type)}</span>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 line-clamp-2">
          {getMessage(item)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {timeAgo()} ago
        </p>
      </div>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleRemove();
        }}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// Custom scrollbar styles
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #a1a1a1;
  }
  
  /* Text clipping */
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
  styleElement.textContent = scrollbarStyles;
  document.head.appendChild(styleElement);
}