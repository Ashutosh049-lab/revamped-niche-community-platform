import { useState, useEffect } from 'react'
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../auth/AuthProvider'
import { emitReaction, emitReactionRemove, onReactionRemoved } from '../../lib/socket'

interface ReactionButtonsProps {
  targetId: string
  targetType: 'post' | 'comment'
  reactions: Record<string, { count: number; users: string[] }>
  communityId?: string
  className?: string
  canModerate?: boolean
}

const commonReactions = ['👍', '❤️', '😆', '😮', '😢', '😡']
const additionalReactions = ['🔥', '💯', '🎉', '🤔', '👏', '🚀', '💡', '⚡']

const EMPTY_REACTIONS: Record<string, { count: number; users: string[] }> = Object.freeze({})

export default function ReactionButtons({ 
  targetId, 
  targetType, 
  reactions, 
  communityId,
  className = '',
  canModerate = false,
}: ReactionButtonsProps) {
  const { user } = useAuth()
  const [showAll, setShowAll] = useState(false)
  const incomingReactions = reactions ?? EMPTY_REACTIONS
  const [currentReactions, setCurrentReactions] = useState(incomingReactions)
  const [isReacting, setIsReacting] = useState<string | null>(null)

  useEffect(() => {
    const handler = (data: { targetId: string; targetType: 'post' | 'comment'; emoji: string; communityId: string }) => {
      if (data.targetId !== targetId || data.targetType !== targetType) return
      setCurrentReactions(prev => {
        const next = { ...prev }
        if (next[data.emoji]) {
          next[data.emoji] = { count: 0, users: [] }
        }
        return next
      })
    }
    const off = (onReactionRemoved as any)(handler)
    return () => { try { off?.() } catch {} }
  }, [targetId, targetType])

  useEffect(() => {
    setCurrentReactions(incomingReactions)
  }, [incomingReactions])

  const handleReact = async (emoji: string) => {
    if (!user?.uid || isReacting === emoji) return

    setIsReacting(emoji)
    
    try {
      const collection = targetType === 'post' ? 'posts' : 'comments'
      const docRef = doc(db, collection, targetId)
      
      const currentReaction = currentReactions[emoji]
      const userHasReacted = currentReaction?.users?.includes(user.uid)
      const action = userHasReacted ? 'remove' : 'add'
      
      let updates: any = {}
      
      if (action === 'add') {
        updates[`reactions.${emoji}.count`] = increment(1)
        updates[`reactions.${emoji}.users`] = arrayUnion(user.uid)
        
        // Optimistic update
        setCurrentReactions(prev => ({
          ...prev,
          [emoji]: {
            count: (prev[emoji]?.count || 0) + 1,
            users: [...(prev[emoji]?.users || []), user.uid]
          }
        }))
      } else {
        updates[`reactions.${emoji}.count`] = increment(-1)
        updates[`reactions.${emoji}.users`] = arrayRemove(user.uid)
        
        // Optimistic update
        setCurrentReactions(prev => {
          const newCount = Math.max(0, (prev[emoji]?.count || 0) - 1)
          const newUsers = prev[emoji]?.users?.filter(id => id !== user.uid) || []
          return {
            ...prev,
            [emoji]: { count: newCount, users: newUsers }
          }
        })
      }
      
      await updateDoc(docRef, updates)
      
      // Emit real-time update
      emitReaction({
        targetId,
        targetType,
        userId: user.uid,
        emoji,
        action,
        communityId
      })
      
    } catch (error) {
      console.error('Error reacting:', error)
      // Revert optimistic update
      setCurrentReactions(reactions)
    } finally {
      setIsReacting(null)
    }
  }

  const getUserReactionStatus = (emoji: string) => {
    return currentReactions[emoji]?.users?.includes(user?.uid || '') || false
  }

  const allReactions = showAll ? [...commonReactions, ...additionalReactions] : commonReactions
  const hasAnyReactions = Object.values(currentReactions).some(r => r.count > 0)

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {allReactions.map((emoji) => {
        const reaction = currentReactions[emoji]
        const count = reaction?.count || 0
        const userReacted = getUserReactionStatus(emoji)
        const isLoading = isReacting === emoji
        
        return (
          <button
            type="button"
            key={emoji}
            onClick={() => handleReact(emoji)}
            disabled={!user || isLoading}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium transition-all disabled:opacity-50 ${
              userReacted
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
            } ${isLoading ? 'animate-pulse' : ''}`}
            title={userReacted ? `Remove ${emoji} reaction` : `React with ${emoji}`}
          >
            <span className="text-base">{emoji}</span>
            {count > 0 && (
              <span className={`text-xs font-bold ${
                userReacted ? 'text-blue-800' : 'text-gray-700'
              }`}>
                {count}
              </span>
            )}
            {canModerate && count > 0 && communityId && (
              <span
                role="button"
                tabIndex={0}
                onClick={async (e) => {
                  e.stopPropagation()
                  if (!confirm('Remove all reactions for this emoji? This will broadcast a moderation event.')) return;
                  await emitReactionRemove({ targetId, targetType, emoji, communityId })
                  setCurrentReactions(prev => ({ ...prev, [emoji]: { count: 0, users: [] } }))
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!confirm('Remove all reactions for this emoji? This will broadcast a moderation event.')) return;
                    await emitReactionRemove({ targetId, targetType, emoji, communityId })
                    setCurrentReactions(prev => ({ ...prev, [emoji]: { count: 0, users: [] } }))
                  }
                }}
                className="ml-1 text-[10px] text-red-600 hover:text-red-800 border border-red-200 rounded px-1 cursor-pointer select-none"
                title="Remove all reactions of this emoji (moderation)"
              >
                ×
              </span>
            )}
          </button>
        )
      })}
      
      {hasAnyReactions && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          title={showAll ? 'Show fewer reactions' : 'Show more reactions'}
        >
          {showAll ? '−' : '+'}
        </button>
      )}
    </div>
  )
}
