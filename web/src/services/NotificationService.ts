import { useState, useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import type { MessagePayload } from 'firebase/messaging';
import { app } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface NotificationPayload {
  id?: string;
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
    [key: string]: any;
  };
  isRead: boolean;
  createdAt: Date;
}

export class NotificationService {
  private messaging: any = null;

  constructor() {
    if (app) {
      try {
        this.messaging = getMessaging(app);
      } catch (error) {
        console.warn('Firebase Messaging not available:', error);
      }
    }
  }

  // Request permission and get FCM token
  async requestPermission(): Promise<string | null> {
    if (!this.messaging) return null;

    try {
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return null;
      }

      const token = await getToken(this.messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });

      if (token) {
        console.log('FCM Token:', token);
        return token;
      } else {
        console.log('No registration token available');
        return null;
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  // Save FCM token to user document
  async saveTokenToDatabase(userId: string, token: string): Promise<void> {
    if (!db) return;

    try {
      await updateDoc(doc(db, 'users', userId), {
        fcmTokens: arrayUnion(token),
        notificationSettings: {
          pushEnabled: true,
          emailEnabled: true,
          comments: true,
          reactions: true,
          follows: true,
          mentions: true,
          achievements: true,
          polls: true,
          posts: true
        }
      });
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  }

  // Set up foreground message listener
  setupForegroundListener(callback: (payload: MessagePayload) => void): void {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log('Message received in foreground:', payload);
      callback(payload);
      
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        this.showBrowserNotification(payload);
      }
    });
  }

  // Show browser notification
  private showBrowserNotification(payload: MessagePayload): void {
    const { title, body, icon } = payload.notification || {};
    
    if (!title || !body) return;

    const notification = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.data?.targetId || 'default',
      requireInteraction: false,
      silent: false
    });

    // Handle click
    notification.onclick = () => {
      window.focus();
      if (payload.data?.actionUrl) {
        window.location.href = payload.data.actionUrl;
      }
      notification.close();
    };

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  }

  // Create in-app notification
  async createNotification(notification: Omit<NotificationPayload, 'id' | 'createdAt'>): Promise<void> {
    if (!db) return;

    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  // Send notification to specific user
  async sendNotificationToUser(
    userId: string,
    type: NotificationPayload['type'],
    title: string,
    message: string,
    data: NotificationPayload['data'] = {}
  ): Promise<void> {
    await this.createNotification({
      userId,
      type,
      title,
      message,
      data,
      isRead: false
    });

    // TODO: Call server endpoint to send push notification
    // This would typically be done via Firebase Cloud Functions
    console.log(`Notification sent to user ${userId}: ${title}`);
  }

  // Send notification to community members
  async sendNotificationToCommunity(
    communityId: string,
    excludeUserId: string | null,
    type: NotificationPayload['type'],
    title: string,
    message: string,
    data: NotificationPayload['data'] = {}
  ): Promise<void> {
    // TODO: Implement community-wide notifications
    // This would query community members and send notifications to each
    console.log(`Community notification sent to ${communityId}: ${title} (type=${type}, excluded=${excludeUserId}, msgLength=${message.length}, dataKeys=${Object.keys(data).length})`);
  }

  // Helper methods for specific notification types
  async notifyNewComment(
    postId: string,
    postTitle: string,
    commenterName: string,
    postAuthorId: string,
    communityId: string
  ): Promise<void> {
    await this.sendNotificationToUser(
      postAuthorId,
      'comment',
      'New Comment',
      `${commenterName} commented on "${postTitle}"`,
      {
        targetId: postId,
        targetType: 'post',
        communityId,
        actionUrl: `/c/${communityId}/post/${postId}#comments`
      }
    );
  }

  async notifyNewReaction(
    targetId: string,
    targetType: 'post' | 'comment',
    reaction: string,
    reactorName: string,
    authorId: string,
    communityId: string
  ): Promise<void> {
    await this.sendNotificationToUser(
      authorId,
      'reaction',
      'New Reaction',
      `${reactorName} reacted ${reaction} to your ${targetType}`,
      {
        targetId,
        targetType,
        communityId,
        actionUrl: `/c/${communityId}/post/${targetId}`
      }
    );
  }

  async notifyNewFollower(
    communityId: string,
    communityName: string,
    followerName: string,
    communityOwnerId: string
  ): Promise<void> {
    await this.sendNotificationToUser(
      communityOwnerId,
      'follow',
      'New Follower',
      `${followerName} joined ${communityName}`,
      {
        targetId: communityId,
        targetType: 'community',
        communityId,
        actionUrl: `/c/${communityId}`
      }
    );
  }

  async notifyMention(
    mentionedUserId: string,
    mentionerName: string,
    contentType: 'post' | 'comment',
    contentId: string,
    communityId: string
  ): Promise<void> {
    await this.sendNotificationToUser(
      mentionedUserId,
      'mention',
      'You were mentioned',
      `${mentionerName} mentioned you in a ${contentType}`,
      {
        targetId: contentId,
        targetType: contentType,
        communityId,
        actionUrl: `/c/${communityId}/post/${contentId}`
      }
    );
  }

  async notifyAchievementUnlocked(
    userId: string,
    achievementName: string,
    points: number
  ): Promise<void> {
    await this.sendNotificationToUser(
      userId,
      'achievement',
      'Achievement Unlocked!',
      `You earned "${achievementName}" (+${points} points)`,
      {
        targetId: achievementName,
        targetType: 'achievement',
        actionUrl: '/profile#achievements'
      }
    );
  }

  async notifyNewPoll(
    communityId: string,
    communityName: string,
    pollQuestion: string,
    authorName: string
  ): Promise<void> {
    // Notify all community members
    await this.sendNotificationToCommunity(
      communityId,
      null,
      'poll',
      'New Poll',
      `${authorName} created a poll in ${communityName}: "${pollQuestion}"`,
      {
        targetId: communityId,
        targetType: 'poll',
        communityId,
        actionUrl: `/c/${communityId}#polls`
      }
    );
  }

  async notifyTrendingPost(
    postId: string,
    postTitle: string,
    authorId: string,
    communityId: string
  ): Promise<void> {
    await this.sendNotificationToUser(
      authorId,
      'post',
      'Your post is trending!',
      `"${postTitle}" is getting lots of engagement`,
      {
        targetId: postId,
        targetType: 'post',
        communityId,
        actionUrl: `/c/${communityId}/post/${postId}`
      }
    );
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Hook for React components
export function useNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Check if notifications are supported
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    setPermission(Notification.permission);
  }, []);

  const requestPermission = async () => {
    const token = await notificationService.requestPermission();
    setToken(token);
    setPermission(Notification.permission);
    return token;
  };

  const setupForegroundListener = (callback: (payload: MessagePayload) => void) => {
    notificationService.setupForegroundListener(callback);
  };

  return {
    isSupported,
    permission,
    token,
    requestPermission,
    setupForegroundListener,
    service: notificationService
  };
}

