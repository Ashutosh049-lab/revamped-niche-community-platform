import { useState, useEffect } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, increment, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthProvider';
import { emitVote } from '../../lib/socket';

interface VotingButtonsProps {
  targetId: string;
  targetType: 'post' | 'comment';
  voteScore: number;
  upvotes: string[];
  downvotes: string[];
  communityId?: string;
  className?: string;
}

export default function VotingButtons({ 
  targetId, 
  targetType, 
  voteScore, 
  upvotes = [], 
  downvotes = [],
  communityId,
  className = '' 
}: VotingButtonsProps) {
  const { user } = useAuth();
  const [currentVoteScore, setCurrentVoteScore] = useState(voteScore);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      if (upvotes.includes(user.uid)) setUserVote('up');
      else if (downvotes.includes(user.uid)) setUserVote('down');
      else setUserVote(null);
    }
  }, [user?.uid, upvotes, downvotes]);

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!user?.uid || isVoting) return;

    setIsVoting(true);
    
    try {
      const collection = targetType === 'post' ? 'posts' : 'comments';
      const docRef = doc(db, collection, targetId);
      
      let voteChange = 0;
      let updates: any = {};

      // Remove previous vote if exists
      if (userVote === 'up') {
        updates.upvotes = arrayRemove(user.uid);
        voteChange -= 1;
      } else if (userVote === 'down') {
        updates.downvotes = arrayRemove(user.uid);
        voteChange += 1;
      }

      // Add new vote if different from current
      if (userVote !== voteType) {
        if (voteType === 'up') {
          updates.upvotes = arrayUnion(user.uid);
          voteChange += 1;
        } else {
          updates.downvotes = arrayUnion(user.uid);
          voteChange -= 1;
        }
        setUserVote(voteType);
      } else {
        // Toggle off the vote
        setUserVote(null);
      }

      // Update vote score
      if (voteChange !== 0) {
        updates.voteScore = increment(voteChange);
      }

      await updateDoc(docRef, updates);
      // Only count when adding a vote or switching direction (not when toggling off)
      const shouldCount = userVote !== voteType;
      try {
        await updateDoc(doc(db, 'users', user.uid), shouldCount ? {
          'stats.totalVotes': increment(1),
          lastActiveAt: serverTimestamp(),
        } : {
          lastActiveAt: serverTimestamp(),
        });
      } catch {}

      setCurrentVoteScore(prev => prev + voteChange);

      // Emit real-time update
      emitVote({
        targetId,
        targetType,
        userId: user.uid,
        voteType: userVote !== voteType ? voteType : null,
        newScore: currentVoteScore + voteChange,
        communityId
      });

      // Award points to post/comment author
      if (userVote !== voteType && voteType === 'up') {
        const targetDoc = await getDoc(docRef);
        const authorId = targetDoc.data()?.authorId;
        if (authorId && authorId !== user.uid) {
          const authorRef = doc(db, 'users', authorId);
          await updateDoc(authorRef, {
            points: increment(targetType === 'post' ? 10 : 5)
          });
        }
      }

    } catch (error) {
      console.error('Error voting:', error);
      // Revert optimistic update
      setCurrentVoteScore(voteScore);
      setUserVote(userVote);
    } finally {
      setIsVoting(false);
    }
  };

  const getVoteButtonClass = (type: 'up' | 'down') => {
    const isActive = userVote === type;
    const baseClass = "flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium transition-all disabled:opacity-50";
    
    if (type === 'up') {
      return `${baseClass} ${isActive 
        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
        : 'text-gray-600 hover:bg-green-50 hover:text-green-600'
      }`;
    } else {
      return `${baseClass} ${isActive 
        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
        : 'text-gray-600 hover:bg-red-50 hover:text-red-600'
      }`;
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => handleVote('up')}
        disabled={!user || isVoting}
        className={getVoteButtonClass('up')}
        title={userVote === 'up' ? 'Remove upvote' : 'Upvote'}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      </button>
      
      <span className={`px-2 py-1 text-sm font-semibold min-w-[2rem] text-center ${
        currentVoteScore > 0 ? 'text-green-600' : 
        currentVoteScore < 0 ? 'text-red-600' : 'text-gray-600'
      }`}>
        {currentVoteScore}
      </span>
      
      <button
        type="button"
        onClick={() => handleVote('down')}
        disabled={!user || isVoting}
        className={getVoteButtonClass('down')}
        title={userVote === 'down' ? 'Remove downvote' : 'Downvote'}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 112 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}