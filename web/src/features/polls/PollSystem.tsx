import { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  arrayUnion, 
  increment,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthProvider';
import { emitPoll, emitPollVote, onNewPoll, onPollVote } from '../../lib/socket';

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  voters: string[];
}

export interface Poll {
  id: string;
  communityId: string;
  authorId: string;
  question: string;
  description?: string;
  options: PollOption[];
  totalVotes: number;
  voters: string[];
  allowMultiple: boolean;
  expiresAt: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface PollSystemProps {
  communityId: string;
  className?: string;
}

export default function PollSystem({ communityId, className = '' }: PollSystemProps) {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !communityId) return;

    const pollsQuery = query(
      collection(db, 'polls'),
      where('communityId', '==', communityId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(pollsQuery, (snapshot) => {
      const pollsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Poll[];
      
      setPolls(pollsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [communityId]);

  // Real-time poll updates via Socket.io
  useEffect(() => {
    const handleNewPoll = (poll: Poll) => {
      if (poll.communityId === communityId) {
        setPolls(prev => {
          if (prev.some(p => p.id === poll.id)) return prev;
          return [poll, ...prev];
        });
      }
    };

    const handlePollVote = (voteData: any) => {
      setPolls(prev => prev.map(poll => {
        if (poll.id === voteData.pollId) {
          return {
            ...poll,
            options: poll.options.map(option => {
              if (option.id === voteData.optionId) {
                return {
                  ...option,
                  votes: voteData.newVotes,
                  voters: voteData.voters
                };
              }
              return option;
            }),
            totalVotes: voteData.totalVotes,
            voters: voteData.allVoters
          };
        }
        return poll;
      }));
    };

    onNewPoll(handleNewPoll);
    onPollVote(handlePollVote);
  }, [communityId]);

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-3"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span>📊</span>
            <span>Live Polls</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Engage with the community through real-time polls and Q&A
          </p>
        </div>
        {user && (
          <button
            onClick={() => setShowCreatePoll(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Poll
          </button>
        )}
      </div>

      {/* Create Poll Modal */}
      {showCreatePoll && (
        <CreatePollModal
          communityId={communityId}
          onClose={() => setShowCreatePoll(false)}
          onPollCreated={(poll) => {
            setPolls(prev => [poll, ...prev]);
            setShowCreatePoll(false);
          }}
        />
      )}

      {/* Polls List */}
      <div className="space-y-4">
        {polls.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No active polls</h3>
            <p className="text-gray-600">Be the first to create a poll for this community!</p>
          </div>
        ) : (
          polls.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))
        )}
      </div>
    </div>
  );
}

// Poll Card Component
function PollCard({ poll }: { poll: Poll }) {
  const { user } = useAuth();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    if (user?.uid && poll.voters.includes(user.uid)) {
      setHasVoted(true);
      // Find which options the user voted for
      const userOptions = poll.options.filter(option => 
        option.voters.includes(user.uid)
      ).map(option => option.id);
      setSelectedOptions(userOptions);
    }
  }, [user, poll]);

  const handleOptionToggle = (optionId: string) => {
    if (hasVoted || !user) return;

    if (poll.allowMultiple) {
      setSelectedOptions(prev => 
        prev.includes(optionId) 
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
    }
  };

  const handleVote = async () => {
    if (!user?.uid || !db || selectedOptions.length === 0 || hasVoted) return;

    setIsVoting(true);
    try {
      const pollRef = doc(db, 'polls', poll.id);
      
      // Update poll document
      const updates: any = {
        voters: arrayUnion(user.uid),
        totalVotes: increment(1),
        updatedAt: Timestamp.now()
      };

      // Update selected options
      const optionUpdates: any = {};
      selectedOptions.forEach(optionId => {
        optionUpdates[`options`] = poll.options.map(option => {
          if (option.id === optionId) {
            return {
              ...option,
              votes: option.votes + 1,
              voters: [...option.voters, user.uid]
            };
          }
          return option;
        });
      });

      await updateDoc(pollRef, { ...updates, ...optionUpdates });

      // Emit real-time update
      emitPollVote({
        pollId: poll.id,
        userId: user.uid,
        optionId: selectedOptions[0], // For simplicity, just use first selected
        communityId: poll.communityId
      });

      setHasVoted(true);
    } catch (error) {
      console.error('Error voting on poll:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const getTimeRemaining = () => {
    const now = Date.now();
    const expiry = poll.expiresAt.toMillis();
    const remaining = expiry - now;

    if (remaining <= 0) return 'Expired';

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return `${minutes}m remaining`;
  };

  const isExpired = poll.expiresAt.toMillis() <= Date.now();

  return (
    <div className="bg-white rounded-lg border hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {poll.question}
            </h3>
            {poll.description && (
              <p className="text-gray-600 text-sm mb-3">{poll.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {poll.totalVotes} votes
              </span>
              <span className={`flex items-center gap-1 ${isExpired ? 'text-red-600' : 'text-green-600'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {getTimeRemaining()}
              </span>
              {poll.allowMultiple && (
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                  Multiple choice
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Poll Options */}
        <div className="space-y-3 mb-6">
          {poll.options.map((option) => {
            const percentage = poll.totalVotes > 0 ? (option.votes / poll.totalVotes) * 100 : 0;
            const isSelected = selectedOptions.includes(option.id);
            const userVoted = hasVoted && option.voters.includes(user?.uid || '');

            return (
              <div key={option.id} className="relative">
                <button
                  onClick={() => handleOptionToggle(option.id)}
                  disabled={hasVoted || isExpired || !user}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    isSelected && !hasVoted
                      ? 'border-blue-500 bg-blue-50'
                      : userVoted
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${hasVoted || isExpired ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected || userVoted ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}>
                        {(isSelected || userVoted) && (
                          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 8 8">
                            <circle cx="4" cy="4" r="3" />
                          </svg>
                        )}
                      </div>
                      <span className="font-medium text-gray-900">{option.text}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        {option.votes}
                      </span>
                      <span className="text-sm text-gray-500">
                        ({Math.round(percentage)}%)
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  {hasVoted && (
                    <div className="absolute inset-0 rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-100 to-purple-100 transition-all duration-500 ease-out"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Vote Button */}
        {!hasVoted && !isExpired && user && (
          <button
            onClick={handleVote}
            disabled={selectedOptions.length === 0 || isVoting}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isVoting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Voting...
              </>
            ) : (
              `Vote (${selectedOptions.length} selected)`
            )}
          </button>
        )}

        {hasVoted && (
          <div className="flex items-center justify-center py-3 text-green-600 font-medium">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Thank you for voting!
          </div>
        )}

        {isExpired && (
          <div className="flex items-center justify-center py-3 text-red-600 font-medium">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            This poll has expired
          </div>
        )}
      </div>
    </div>
  );
}

// Create Poll Modal Component
function CreatePollModal({ 
  communityId, 
  onClose, 
  onPollCreated 
}: { 
  communityId: string; 
  onClose: () => void; 
  onPollCreated: (poll: Poll) => void; 
}) {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [duration, setDuration] = useState(24); // hours
  const [isCreating, setIsCreating] = useState(false);

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreate = async () => {
    if (!user?.uid || !db || !question.trim()) return;

    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < 2) return;

    setIsCreating(true);
    try {
      const now = Timestamp.now();
      const expiresAt = Timestamp.fromMillis(now.toMillis() + duration * 60 * 60 * 1000);

      const pollData = {
        communityId,
        authorId: user.uid,
        question: question.trim(),
        description: description.trim() || null,
        options: validOptions.map((text, index) => ({
          id: `option_${index}`,
          text: text.trim(),
          votes: 0,
          voters: []
        })),
        totalVotes: 0,
        voters: [],
        allowMultiple,
        expiresAt,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await addDoc(collection(db, 'polls'), pollData);
      const newPoll = { id: docRef.id, ...pollData } as Poll;

      // Emit real-time update
      emitPoll(newPoll);
      
      onPollCreated(newPoll);
    } catch (error) {
      console.error('Error creating poll:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const canCreate = question.trim() && options.filter(opt => opt.trim()).length >= 2;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Create New Poll</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* Question */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Poll Question *
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What would you like to ask the community?"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more context to your poll..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Poll Options *
              </label>
              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="p-2 text-red-600 hover:text-red-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                {options.length < 10 && (
                  <button
                    onClick={addOption}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Option
                  </button>
                )}
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Allow Multiple Choices</label>
                  <p className="text-xs text-gray-500">Let users select more than one option</p>
                </div>
                <button
                  onClick={() => setAllowMultiple(!allowMultiple)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    allowMultiple ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    allowMultiple ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Poll Duration
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>1 day</option>
                  <option value={72}>3 days</option>
                  <option value={168}>1 week</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!canCreate || isCreating}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  'Create Poll'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}