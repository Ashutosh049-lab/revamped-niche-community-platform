import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  onNewPost, 
  onNewComment, 
  onVoteUpdate, 
  onReactionUpdate,
  onNewPoll,
  onPollVote,
  joinCommunity,
  leaveCommunity,
  offNewPost,
  offNewComment,
  offVoteUpdate,
  offReactionUpdate,
  offNewPoll,
  offPollVote
} from '../lib/socket';

export interface AnimationState {
  isNew: boolean;
  isUpdated: boolean;
  animationType: 'slideIn' | 'fadeIn' | 'bounce' | 'pulse' | null;
}

export interface RealTimeItem {
  id: string;
  type: 'post' | 'comment' | 'poll' | 'vote' | 'reaction';
  data: any;
  timestamp: number;
  animation: AnimationState;
}

export function useRealTimeUpdates(communityId?: string) {
  const [realtimeItems, setRealtimeItems] = useState<Map<string, RealTimeItem>>(new Map());
  const [notifications, setNotifications] = useState<RealTimeItem[]>([]);
  const animationTimeouts = useRef<Map<string, number>>(new Map());

  // Join/leave community rooms
  useEffect(() => {
    if (communityId) {
      joinCommunity(communityId);
      return () => leaveCommunity(communityId);
    }
  }, [communityId]);

  // Add item with animation
  const addRealtimeItem = useCallback((item: Omit<RealTimeItem, 'animation' | 'timestamp'>, animationType: AnimationState['animationType'] = 'slideIn') => {
    const realtimeItem: RealTimeItem = {
      ...item,
      timestamp: Date.now(),
      animation: {
        isNew: true,
        isUpdated: false,
        animationType
      }
    };

    setRealtimeItems(prev => new Map(prev.set(item.id, realtimeItem)));
    
    // Add to notifications if not in current view
    setNotifications(prev => [realtimeItem, ...prev.slice(0, 9)]); // Keep max 10 notifications

    // Clear animation after delay
    const timeout = setTimeout(() => {
      setRealtimeItems(prev => {
        const newMap = new Map(prev);
        const existingItem = newMap.get(item.id);
        if (existingItem) {
          newMap.set(item.id, {
            ...existingItem,
            animation: {
              ...existingItem.animation,
              isNew: false,
              animationType: null
            }
          });
        }
        return newMap;
      });
    }, 1000);

    animationTimeouts.current.set(item.id, timeout);
  }, []);

  // Update existing item with animation
  const updateRealtimeItem = useCallback((id: string, updateData: any, animationType: AnimationState['animationType'] = 'pulse') => {
    setRealtimeItems(prev => {
      const newMap = new Map(prev);
      const existingItem = newMap.get(id);
      if (existingItem) {
        newMap.set(id, {
          ...existingItem,
          data: { ...existingItem.data, ...updateData },
          timestamp: Date.now(),
          animation: {
            isNew: false,
            isUpdated: true,
            animationType
          }
        });

        // Clear update animation after delay
        const timeout = setTimeout(() => {
          setRealtimeItems(prevMap => {
            const updatedMap = new Map(prevMap);
            const item = updatedMap.get(id);
            if (item) {
              updatedMap.set(id, {
                ...item,
                animation: {
                  ...item.animation,
                  isUpdated: false,
                  animationType: null
                }
              });
            }
            return updatedMap;
          });
        }, 800);

        animationTimeouts.current.set(`${id}_update`, timeout);
      }
      return newMap;
    });
  }, []);

  // Socket event handlers
  useEffect(() => {
    const handleNewPost = (post: any) => {
      addRealtimeItem({
        id: post.id,
        type: 'post',
        data: post
      }, 'slideIn');
    };

    const handleNewComment = (comment: any) => {
      addRealtimeItem({
        id: comment.id,
        type: 'comment',
        data: comment
      }, 'fadeIn');
    };

    const handleVoteUpdate = (voteData: any) => {
      updateRealtimeItem(voteData.targetId, {
        voteScore: voteData.newScore,
        lastVoteBy: voteData.userId,
        lastVoteType: voteData.voteType
      }, 'pulse');
    };

    const handleReactionUpdate = (reactionData: any) => {
      updateRealtimeItem(reactionData.targetId, {
        reactions: reactionData.reactions || {},
        lastReactionBy: reactionData.userId,
        lastReaction: reactionData.emoji
      }, 'bounce');
    };

    const handleNewPoll = (poll: any) => {
      addRealtimeItem({
        id: poll.id,
        type: 'poll',
        data: poll
      }, 'slideIn');
    };

    const handlePollVote = (voteData: any) => {
      updateRealtimeItem(voteData.pollId, {
        votes: voteData.votes,
        lastVoteBy: voteData.userId
      }, 'pulse');
    };

    // Register socket event listeners
    onNewPost(handleNewPost);
    onNewComment(handleNewComment);
    onVoteUpdate(handleVoteUpdate);
    onReactionUpdate(handleReactionUpdate);
    onNewPoll(handleNewPoll);
    onPollVote(handlePollVote);

    return () => {
      try {
        offNewPost(handleNewPost);
        offNewComment(handleNewComment);
        offVoteUpdate(handleVoteUpdate);
        offReactionUpdate(handleReactionUpdate);
        offNewPoll(handleNewPoll);
        offPollVote(handlePollVote);
      } catch {}
      // Clear all timeouts
      animationTimeouts.current.forEach(timeout => clearTimeout(timeout));
      animationTimeouts.current.clear();
    };
  }, [addRealtimeItem, updateRealtimeItem]);

  // Get animation classes for an item
  const getAnimationClasses = (animation: AnimationState): string => {
    const classes: string[] = [];
    
    if (animation.isNew && animation.animationType) {
      switch (animation.animationType) {
        case 'slideIn':
          classes.push('animate-slide-in-right');
          break;
        case 'fadeIn':
          classes.push('animate-fade-in');
          break;
        case 'bounce':
          classes.push('animate-bounce-in');
          break;
        case 'pulse':
          classes.push('animate-pulse-once');
          break;
      }
    }
    
    if (animation.isUpdated && animation.animationType === 'pulse') {
      classes.push('animate-pulse-once');
    }
    
    if (animation.isUpdated && animation.animationType === 'bounce') {
      classes.push('animate-bounce-small');
    }
    
    return classes.join(' ');
  };

  // Clear notifications
  const clearNotifications = () => {
    setNotifications([]);
  };

  // Remove notification
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(item => item.id !== id));
  };

  return {
    realtimeItems: Array.from(realtimeItems.values()),
    notifications,
    getAnimationClasses,
    clearNotifications,
    removeNotification,
    addRealtimeItem,
    updateRealtimeItem
  };
}

// Custom animation CSS classes (to be added to global styles)
export const REALTIME_ANIMATION_STYLES = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes bounceIn {
    0% {
      transform: scale(0.3);
      opacity: 0;
    }
    50% {
      transform: scale(1.05);
    }
    70% {
      transform: scale(0.9);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes pulseOnce {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
  }

  @keyframes bounceSmall {
    0%, 20%, 53%, 80%, 100% {
      transform: translateY(0);
    }
    40%, 43% {
      transform: translateY(-8px);
    }
    70% {
      transform: translateY(-4px);
    }
  }

  .animate-slide-in-right {
    animation: slideInRight 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  .animate-fade-in {
    animation: fadeIn 0.5s ease-out;
  }

  .animate-bounce-in {
    animation: bounceIn 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  .animate-pulse-once {
    animation: pulseOnce 0.6s ease-in-out;
  }

  .animate-bounce-small {
    animation: bounceSmall 0.8s ease-in-out;
  }

  /* Highlight effects */
  .realtime-highlight {
    background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent);
    animation: highlightSweep 2s ease-out;
  }

  @keyframes highlightSweep {
    0% {
      background-position: -100% center;
    }
    100% {
      background-position: 100% center;
    }
  }
`;