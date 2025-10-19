# Firestore Enhanced Schema

Collections
- users (uid)
  - displayName: string
  - photoURL: string
  - interests: string[]
  - bio: string
  - badges: string[]
  - points: number
  - level: number
  - achievements: { id: string, unlockedAt: timestamp }[]
  - preferences: {
    feedSort: 'recent' | 'top' | 'trending',
    emailNotifications: boolean,
    pushNotifications: boolean
  }
  - followedCommunities: string[]
  - createdAt: timestamp
  - lastActiveAt: timestamp

- communities (id)
  - name: string
  - slug: string (unique)
  - description: string
  - category: string
  - tags: string[]
  - createdBy: uid
  - moderators: uid[]
  - rules: string[]
  - createdAt: timestamp
  - memberCount: number
  - postsCount: number
  - activityScore: number
  - isActive: boolean

- posts (id)
  - communityId: ref -> communities/{id}
  - authorId: uid
  - title: string
  - content: richtext JSON or HTML
  - media: { url: string, type: 'image' | 'gif' | 'video', alt?: string }[]
  - reactions: { [emoji]: { count: number, users: uid[] } }
  - voteScore: number
  - upvotes: uid[]
  - downvotes: uid[]
  - commentCount: number
  - isPinned: boolean
  - isLocked: boolean
  - tags: string[]
  - createdAt: timestamp
  - updatedAt: timestamp

- comments (id)
  - postId: ref -> posts/{id}
  - communityId: ref -> communities/{id}
  - authorId: uid
  - parentId: optional ref -> comments/{id} (for threading)
  - content: string | richtext
  - media: { url: string, type: 'image' | 'gif' | 'video' }[]
  - reactions: { [emoji]: { count: number, users: uid[] } }
  - voteScore: number
  - upvotes: uid[]
  - downvotes: uid[]
  - replyCount: number
  - depth: number
  - isDeleted: boolean
  - createdAt: timestamp
  - updatedAt: timestamp

- votes (uid_postId or uid_commentId)
  - userId: uid
  - targetId: string (post or comment ID)
  - targetType: 'post' | 'comment'
  - type: 'up' | 'down'
  - createdAt: timestamp

- follows (uid_communityId)
  - uid: uid
  - communityId: communities/{id}
  - createdAt: timestamp

- polls (id)
  - communityId: ref -> communities/{id}
  - authorId: uid
  - question: string
  - options: { id: string, text: string, votes: number }[]
  - voters: uid[]
  - allowMultiple: boolean
  - expiresAt: timestamp
  - isActive: boolean
  - createdAt: timestamp

- achievements (id)
  - name: string
  - description: string
  - icon: string
  - criteria: {
    type: 'posts' | 'comments' | 'votes' | 'community',
    threshold: number
  }
  - points: number

- notifications (id)
  - userId: uid
  - type: 'comment' | 'reaction' | 'follow' | 'mention' | 'achievement'
  - title: string
  - message: string
  - data: object
  - isRead: boolean
  - createdAt: timestamp

- follows (uid_communityId)
  - uid: uid
  - communityId: communities/{id}
  - createdAt: timestamp

Suggested composite indexes
- posts by community, createdAt desc (for community feed)
- posts by voteScore desc (for "Top")
- comments by postId, createdAt asc (for threads)
- communities by category, memberCount desc (for discovery)

Notes
- Use onSnapshot listeners for live updates.
- Socket.io rooms: join room `community:{communityId}` to scope live events.
