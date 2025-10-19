import { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthProvider';
import { emitPoll, emitPollVote } from '../../lib/socket';

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  voters: string[];
  color?: string;
  imageUrl?: string;
}

export interface Poll {
  id: string;
  title: string;
  description?: string;
  options: PollOption[];
  createdBy: string;
  creatorName: string;
  creatorPhotoURL?: string;
  communityId?: string;
  communityName?: string;
  type: 'single' | 'multiple' | 'ranked' | 'open-ended';
  settings: {
    allowMultipleVotes: boolean;
    showResults: 'always' | 'after-vote' | 'after-end';
    allowAddOptions: boolean;
    requireAuth: boolean;
    maxVotesPerUser?: number;
  };
  status: 'draft' | 'active' | 'paused' | 'ended';
  totalVotes: number;
  uniqueVoters: string[];
  createdAt: Date;
  endsAt?: Date;
  tags: string[];
  isAnonymous: boolean;
}

interface AdvancedPollingProps {
  communityId?: string;
  embedded?: boolean;
  maxPolls?: number;
}

export default function AdvancedPolling({ 
  communityId, 
  embedded = false, 
  maxPolls = 10 
}: AdvancedPollingProps) {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filter, setFilter] = useState<'active' | 'ended' | 'all'>('active');

  useEffect(() => {
    loadPolls();
  }, [communityId, filter]);

  const loadPolls = () => {
    if (!db) return;

    let pollQuery = query(collection(db, 'polls'));

    // Apply filters
    const constraints = [];
    
    if (communityId) {
      constraints.push(where('communityId', '==', communityId));
    }

    if (filter !== 'all') {
      constraints.push(where('status', '==', filter));
    }

    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(limit(maxPolls));

    if (constraints.length > 0) {
      pollQuery = query(collection(db, 'polls'), ...constraints);
    }

    const unsubscribe = onSnapshot(pollQuery, (snapshot) => {
      const pollsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          description: data.description,
          options: data.options || [],
          createdBy: data.createdBy,
          creatorName: data.creatorName,
          creatorPhotoURL: data.creatorPhotoURL,
          communityId: data.communityId,
          communityName: data.communityName,
          type: data.type || 'single',
          settings: data.settings || {
            allowMultipleVotes: false,
            showResults: 'after-vote',
            allowAddOptions: false,
            requireAuth: true
          },
          status: data.status || 'active',
          totalVotes: data.totalVotes || 0,
          uniqueVoters: data.uniqueVoters || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          endsAt: data.endsAt?.toDate(),
          tags: data.tags || [],
          isAnonymous: data.isAnonymous || false
        } as Poll;
      });

      setPolls(pollsData);
      setLoading(false);
    });

    return unsubscribe;
  };

  if (loading) {
    return (
      <div className={embedded ? 'p-4' : 'max-w-4xl mx-auto p-6'}>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? 'space-y-4' : 'max-w-4xl mx-auto p-6 space-y-6'}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Polls & Voting</h1>
            <p className="text-gray-600 mt-1">Real-time community polls and surveys</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Filter buttons */}
            <div className="flex gap-1">
              {[
                { key: 'active', label: 'Active' },
                { key: 'ended', label: 'Ended' },
                { key: 'all', label: 'All' }
              ].map(filterOption => (
                <button
                  key={filterOption.key}
                  onClick={() => setFilter(filterOption.key as any)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    filter === filterOption.key
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {filterOption.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span>📊</span>
              Create Poll
            </button>
          </div>
        </div>
      )}

      {/* Polls List */}
      <div className="space-y-4">
        {polls.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No polls yet</h3>
            <p className="text-gray-600 mb-4">Be the first to create a poll and get community feedback!</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Poll
            </button>
          </div>
        ) : (
          polls.map(poll => (
            <PollCard 
              key={poll.id} 
              poll={poll} 
              currentUser={user}
            />
          ))
        )}
      </div>

      {/* Create Poll Modal */}
      {showCreateForm && (
        <CreatePollModal
          communityId={communityId}
          onClose={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}

interface PollCardProps {
  poll: Poll;
  currentUser: any;
}

function PollCard({ poll, currentUser }: PollCardProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    if (currentUser?.uid) {
      const userHasVoted = poll.uniqueVoters.includes(currentUser.uid);
      setHasVoted(userHasVoted);
      setShowResults(
        poll.settings.showResults === 'always' ||
        (poll.settings.showResults === 'after-vote' && userHasVoted) ||
        poll.status === 'ended'
      );
    }
  }, [poll, currentUser]);

  const handleVote = async () => {
    if (!currentUser?.uid || !db || selectedOptions.length === 0 || isVoting) return;

    setIsVoting(true);
    try {
      const batch = writeBatch(db);
      const pollRef = doc(db, 'polls', poll.id);

      // Update poll with new votes
      const updatedOptions = poll.options.map(option => {
        if (selectedOptions.includes(option.id)) {
          return {
            ...option,
            votes: option.votes + 1,
            voters: [...option.voters, currentUser.uid]
          };
        }
        return option;
      });

      batch.update(pollRef, {
        options: updatedOptions,
        totalVotes: poll.totalVotes + selectedOptions.length,
        uniqueVoters: arrayUnion(currentUser.uid),
        lastVoteAt: new Date()
      });

      await batch.commit();

      // Emit real-time update
      emitPollVote({
        pollId: poll.id,
        userId: currentUser.uid,
        optionId: selectedOptions[0],
        communityId: poll.communityId
      });

      setSelectedOptions([]);
    } catch (error) {
      console.error('Error voting on poll:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const handleOptionToggle = (optionId: string) => {
    if (poll.type === 'single') {
      setSelectedOptions([optionId]);
    } else {
      setSelectedOptions(prev => 
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    }
  };

  const getTimeRemaining = () => {
    if (!poll.endsAt) return null;
    
    const now = new Date();
    const timeLeft = poll.endsAt.getTime() - now.getTime();
    
    if (timeLeft <= 0) return 'Ended';
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const getResultColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-yellow-500',
      'bg-purple-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-pink-500',
      'bg-gray-500'
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow">
      {/* Poll Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {poll.creatorPhotoURL ? (
              <img
                src={poll.creatorPhotoURL}
                alt={poll.creatorName}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold">
                {poll.creatorName[0]?.toUpperCase()}
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{poll.creatorName}</span>
                {poll.communityName && (
                  <>
                    <span className="text-gray-500">in</span>
                    <span className="text-blue-600 font-medium">{poll.communityName}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                <span>{poll.createdAt.toLocaleDateString()}</span>
                <span>•</span>
                <span>{poll.totalVotes} votes</span>
                {getTimeRemaining() && (
                  <>
                    <span>•</span>
                    <span className={poll.status === 'ended' ? 'text-red-600' : 'text-green-600'}>
                      {getTimeRemaining()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
              poll.status === 'active' ? 'bg-green-100 text-green-800' :
              poll.status === 'ended' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {poll.status}
            </span>
            
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {poll.type}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-semibold text-gray-900">{poll.title}</h3>
          {poll.description && (
            <p className="text-gray-600 mt-1">{poll.description}</p>
          )}
        </div>

        {poll.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {poll.tags.map((tag, index) => (
              <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Poll Options */}
      <div className="p-6">
        <div className="space-y-3">
          {poll.options.map((option, index) => {
            const percentage = poll.totalVotes > 0 ? (option.votes / poll.totalVotes) * 100 : 0;
            const isSelected = selectedOptions.includes(option.id);

            return (
              <div key={option.id} className="relative">
                {showResults ? (
                  <div className={`relative overflow-hidden rounded-lg border p-4 ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}>
                    <div
                      className={`absolute inset-0 ${getResultColor(index)} opacity-20`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                    
                    <div className="relative flex items-center justify-between">
                      <span className="font-medium text-gray-900">{option.text}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {option.votes} votes ({percentage.toFixed(1)}%)
                        </span>
                        {isSelected && <span className="text-blue-600">✓</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleOptionToggle(option.id)}
                    disabled={hasVoted || poll.status !== 'active'}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 text-blue-900' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{option.text}</span>
                      <div className={`w-4 h-4 border-2 rounded ${
                        poll.type === 'single' ? 'rounded-full' : 'rounded'
                      } ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <div className={`w-full h-full bg-white ${
                            poll.type === 'single' ? 'rounded-full' : 'rounded'
                          }`} style={{ 
                            transform: 'scale(0.5)',
                            transformOrigin: 'center'
                          }}></div>
                        )}
                      </div>
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Vote Button */}
        {!hasVoted && poll.status === 'active' && selectedOptions.length > 0 && (
          <button
            onClick={handleVote}
            disabled={isVoting}
            className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isVoting ? 'Voting...' : `Vote${selectedOptions.length > 1 ? ` (${selectedOptions.length})` : ''}`}
          </button>
        )}

        {/* Results Toggle */}
        {hasVoted && poll.settings.showResults === 'after-vote' && poll.status === 'active' && (
          <button
            onClick={() => setShowResults(!showResults)}
            className="w-full mt-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showResults ? 'Hide Results' : 'Show Results'}
          </button>
        )}
      </div>
    </div>
  );
}

interface CreatePollModalProps {
  communityId?: string;
  onClose: () => void;
}

function CreatePollModal({ communityId, onClose }: CreatePollModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'single' as Poll['type'],
    options: ['', ''],
    settings: {
      allowMultipleVotes: false,
      showResults: 'after-vote' as const,
      allowAddOptions: false,
      requireAuth: true
    },
    endsIn: '',
    tags: '',
    isAnonymous: false
  });
  const [isCreating, setIsCreating] = useState(false);

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const removeOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const updateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((option, i) => i === index ? value : option)
    }));
  };

  const createPoll = async () => {
    if (!user?.uid || !db || isCreating) return;
    
    const validOptions = formData.options.filter(opt => opt.trim());
    if (!formData.title.trim() || validOptions.length < 2) return;

    setIsCreating(true);
    try {
      const pollOptions: PollOption[] = validOptions.map((text, index) => ({
        id: `option_${Date.now()}_${index}`,
        text: text.trim(),
        votes: 0,
        voters: []
      }));

      let endsAt: Date | undefined;
      if (formData.endsIn) {
        const hours = parseInt(formData.endsIn);
        endsAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      }

      const pollData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        options: pollOptions,
        createdBy: user.uid,
        creatorName: user.displayName || 'Anonymous',
        creatorPhotoURL: user.photoURL,
        communityId: communityId || undefined,
        type: formData.type,
        settings: formData.settings,
        status: 'active' as const,
        totalVotes: 0,
        uniqueVoters: [],
        createdAt: new Date(),
        endsAt,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        isAnonymous: formData.isAnonymous
      };

      await addDoc(collection(db, 'polls'), pollData);
      
      // Emit real-time event
      emitPoll({
        ...pollData,
        communityId: communityId
      });

      onClose();
    } catch (error) {
      console.error('Error creating poll:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Create New Poll</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Poll Question *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="What would you like to ask?"
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add more context to your poll..."
                rows={3}
                maxLength={500}
              />
            </div>

            {/* Poll Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Poll Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as Poll['type'] }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="single">Single Choice</option>
                <option value="multiple">Multiple Choice</option>
              </select>
            </div>

            {/* Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Options * (minimum 2)
              </label>
              <div className="space-y-2">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Option ${index + 1}`}
                      maxLength={100}
                    />
                    {formData.options.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="px-3 py-2 text-red-600 hover:text-red-800"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {formData.options.length < 8 && (
                <button
                  onClick={addOption}
                  className="mt-2 px-3 py-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Add Option
                </button>
              )}
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Show Results</label>
                <select
                  value={formData.settings.showResults}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, showResults: e.target.value as any }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="always">Always</option>
                  <option value="after-vote">After Voting</option>
                  <option value="after-end">After Poll Ends</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ends In (hours, optional)
                </label>
                <input
                  type="number"
                  value={formData.endsIn}
                  onChange={(e) => setFormData(prev => ({ ...prev, endsIn: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="24"
                  min="1"
                  max="8760"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="technology, feedback, community"
              />
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.settings.allowAddOptions}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, allowAddOptions: e.target.checked }
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Allow users to add options</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isAnonymous}
                  onChange={(e) => setFormData(prev => ({ ...prev, isAnonymous: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Anonymous poll</span>
              </label>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createPoll}
              disabled={
                isCreating || 
                !formData.title.trim() || 
                formData.options.filter(opt => opt.trim()).length < 2
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create Poll'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}