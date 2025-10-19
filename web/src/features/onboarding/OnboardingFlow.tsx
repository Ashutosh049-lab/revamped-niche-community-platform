import React, { useState } from 'react';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<StepProps>;
}

interface StepProps {
  onNext: () => void;
  onPrev: () => void;
  onComplete: (data?: any) => void;
  userData: any;
  setUserData: (data: any) => void;
}


// Step 1: Welcome
function WelcomeStep({ onNext }: StepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-6"
    >
      <div className="text-8xl mb-6">👋</div>
      <h2 className="text-3xl font-bold text-gray-900">Welcome to Our Community!</h2>
      <p className="text-lg text-gray-600 max-w-2xl mx-auto">
        Join thousands of passionate members sharing knowledge, ideas, and experiences. 
        Let's get you set up in just a few quick steps.
      </p>
      <div className="flex items-center justify-center gap-8 mt-8">
        <div className="text-center">
          <div className="text-2xl mb-2">💬</div>
          <div className="text-sm font-medium">Rich Discussions</div>
        </div>
        <div className="text-center">
          <div className="text-2xl mb-2">🎯</div>
          <div className="text-sm font-medium">Personalized Feed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl mb-2">🏆</div>
          <div className="text-sm font-medium">Achievements</div>
        </div>
        <div className="text-center">
          <div className="text-2xl mb-2">🚀</div>
          <div className="text-sm font-medium">Real-time Updates</div>
        </div>
      </div>
      <button
        onClick={onNext}
        className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        Get Started
      </button>
    </motion.div>
  );
}

// Step 2: Basic Profile Setup
function ProfileStep({ onNext, userData, setUserData }: StepProps) {
  const [displayName, setDisplayName] = useState(userData.displayName || '');
  const [bio, setBio] = useState(userData.bio || '');

  const handleNext = () => {
    if (displayName.trim()) {
      setUserData({ ...userData, displayName, bio });
      onNext();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto space-y-6"
    >
      <div className="text-center">
        <div className="text-6xl mb-4">👤</div>
        <h2 className="text-2xl font-bold text-gray-900">Set Up Your Profile</h2>
        <p className="text-gray-600 mt-2">Help others get to know you</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Display Name *
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="How should others address you?"
            maxLength={50}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bio (Optional)
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Tell us a bit about yourself..."
            rows={3}
            maxLength={200}
          />
          <div className="text-sm text-gray-500 mt-1">{bio.length}/200</div>
        </div>
      </div>

      <button
        onClick={handleNext}
        disabled={!displayName.trim()}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        Continue
      </button>
    </motion.div>
  );
}

// Step 3: Interest Selection
function InterestsStep({ onNext, userData, setUserData }: StepProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(userData.categories || []);
  const [experience, setExperience] = useState(userData.experience || '');

  const categories = [
    { id: 'technology', label: 'Technology', icon: '💻' },
    { id: 'science', label: 'Science', icon: '🔬' },
    { id: 'arts', label: 'Arts & Design', icon: '🎨' },
    { id: 'business', label: 'Business', icon: '💼' },
    { id: 'health', label: 'Health & Fitness', icon: '💪' },
    { id: 'education', label: 'Education', icon: '📚' },
    { id: 'lifestyle', label: 'Lifestyle', icon: '🌟' },
    { id: 'gaming', label: 'Gaming', icon: '🎮' },
    { id: 'sports', label: 'Sports', icon: '⚽' },
    { id: 'travel', label: 'Travel', icon: '✈️' },
    { id: 'food', label: 'Food & Cooking', icon: '🍳' },
    { id: 'music', label: 'Music', icon: '🎵' }
  ];

  const experienceLevels = [
    { id: 'beginner', label: 'Beginner', description: 'New to most topics' },
    { id: 'intermediate', label: 'Intermediate', description: 'Some experience in my interests' },
    { id: 'advanced', label: 'Advanced', description: 'Experienced and knowledgeable' },
    { id: 'expert', label: 'Expert', description: 'Highly experienced, love to share knowledge' }
  ];

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleNext = () => {
    if (selectedCategories.length > 0 && experience) {
      setUserData({ 
        ...userData, 
        categories: selectedCategories, 
        experience 
      });
      onNext();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="text-center">
        <div className="text-6xl mb-4">🎯</div>
        <h2 className="text-2xl font-bold text-gray-900">What Interests You?</h2>
        <p className="text-gray-600 mt-2">Choose your areas of interest to personalize your experience</p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Categories (select at least 1)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => toggleCategory(category.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedCategories.includes(category.id)
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="text-2xl mb-1">{category.icon}</div>
              <div className="text-sm font-medium">{category.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Experience Level</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {experienceLevels.map(level => (
            <button
              key={level.id}
              onClick={() => setExperience(level.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                experience === level.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="font-semibold text-gray-900">{level.label}</div>
              <div className="text-sm text-gray-600">{level.description}</div>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleNext}
        disabled={selectedCategories.length === 0 || !experience}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        Continue ({selectedCategories.length} selected)
      </button>
    </motion.div>
  );
}

// Step 4: Community Suggestions
function CommunitiesStep({ onNext, userData, setUserData }: StepProps) {
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [communities] = useState([
    {
      id: 'general',
      name: 'General Discussion',
      description: 'Open discussions on any topic',
      members: 1250,
      icon: '💬'
    },
    {
      id: 'tech-news',
      name: 'Tech News',
      description: 'Latest technology updates and trends',
      members: 890,
      icon: '📱'
    },
    {
      id: 'science-research',
      name: 'Science & Research',
      description: 'Scientific discoveries and research papers',
      members: 567,
      icon: '🔬'
    },
    {
      id: 'creative-showcase',
      name: 'Creative Showcase',
      description: 'Share your artwork, designs, and creative projects',
      members: 432,
      icon: '🎨'
    },
    {
      id: 'learning-together',
      name: 'Learning Together',
      description: 'Study groups and educational resources',
      members: 678,
      icon: '📚'
    },
    {
      id: 'career-advice',
      name: 'Career Advice',
      description: 'Professional development and career guidance',
      members: 789,
      icon: '💼'
    }
  ]);

  const toggleCommunity = (communityId: string) => {
    setSelectedCommunities(prev => 
      prev.includes(communityId) 
        ? prev.filter(id => id !== communityId)
        : [...prev, communityId]
    );
  };

  const handleNext = () => {
    setUserData({ 
      ...userData, 
      communities: selectedCommunities 
    });
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="text-center">
        <div className="text-6xl mb-4">🏘️</div>
        <h2 className="text-2xl font-bold text-gray-900">Join Communities</h2>
        <p className="text-gray-600 mt-2">Start following communities that match your interests</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {communities.map(community => (
          <div
            key={community.id}
            className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
              selectedCommunities.includes(community.id)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
            onClick={() => toggleCommunity(community.id)}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">{community.icon}</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{community.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{community.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>{community.members.toLocaleString()} members</span>
                </div>
              </div>
              {selectedCommunities.includes(community.id) && (
                <div className="text-blue-500">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-500 mb-4">
          You can always join or leave communities later from your profile
        </p>
        <button
          onClick={handleNext}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Continue ({selectedCommunities.length} selected)
        </button>
      </div>
    </motion.div>
  );
}

// Step 5: Completion
function CompletionStep({ onComplete, userData }: StepProps) {
  const handleComplete = () => {
    onComplete(userData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-6 max-w-2xl mx-auto"
    >
      <div className="text-8xl mb-6">🎉</div>
      <h2 className="text-3xl font-bold text-gray-900">You're All Set!</h2>
      <p className="text-lg text-gray-600">
        Welcome to our community! Your personalized experience is ready.
      </p>

      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">What's Next?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl mb-2">✏️</div>
            <div className="font-medium">Create Your First Post</div>
            <div className="text-gray-600">Share your thoughts with the community</div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">🔍</div>
            <div className="font-medium">Explore Communities</div>
            <div className="text-gray-600">Discover interesting discussions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">🏆</div>
            <div className="font-medium">Earn Achievements</div>
            <div className="text-gray-600">Level up by participating</div>
          </div>
        </div>
      </div>

      <button
        onClick={handleComplete}
        className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        Start Exploring
      </button>
    </motion.div>
  );
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Get started with our community',
    component: WelcomeStep
  },
  {
    id: 'profile',
    title: 'Profile Setup',
    description: 'Create your profile',
    component: ProfileStep
  },
  {
    id: 'interests',
    title: 'Your Interests',
    description: 'Tell us what you like',
    component: InterestsStep
  },
  {
    id: 'communities',
    title: 'Join Communities',
    description: 'Find your tribes',
    component: CommunitiesStep
  },
  {
    id: 'completion',
    title: 'All Done!',
    description: 'Welcome to the community',
    component: CompletionStep
  }
];

interface OnboardingFlowProps {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [userData, setUserData] = useState({});
  const [isCompleting, setIsCompleting] = useState(false);

  const currentStepData = onboardingSteps[currentStep];
  const StepComponent = currentStepData.component;

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = async (finalUserData: any) => {
    if (!user?.uid || !db || isCompleting) return;

    setIsCompleting(true);
    
    try {
      // Update user profile
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: finalUserData.displayName,
        bio: finalUserData.bio || '',
        interests: finalUserData.categories || [],
        experience: finalUserData.experience,
        followedCommunities: finalUserData.communities || [],
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        level: 1,
        points: 100, // Welcome bonus
        achievements: ['welcome'],
        currentStreak: 1
      });

      // Join selected communities
      if (finalUserData.communities) {
        for (const communityId of finalUserData.communities) {
          const communityRef = doc(db, 'communities', communityId);
          await updateDoc(communityRef, {
            members: arrayUnion(user.uid),
            memberCount: increment(1)
          });
        }
      }

      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="container mx-auto px-4">
        {/* Progress Bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Getting Started</h1>
            <span className="text-sm text-gray-600">
              Step {currentStep + 1} of {onboardingSteps.length}
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="bg-blue-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / onboardingSteps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          
          <div className="flex justify-between mt-2">
            {onboardingSteps.map((step, index) => (
              <div
                key={step.id}
                className={`text-xs ${
                  index <= currentStep ? 'text-blue-600 font-medium' : 'text-gray-400'
                }`}
              >
                {step.title}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 min-h-[600px]">
            <AnimatePresence mode="wait">
              <StepComponent
                key={currentStep}
                onNext={handleNext}
                onPrev={handlePrev}
                onComplete={handleComplete}
                userData={userData}
                setUserData={setUserData}
              />
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation */}
        {currentStep > 0 && currentStep < onboardingSteps.length - 1 && (
          <div className="max-w-4xl mx-auto mt-6 flex justify-between">
            <button
              onClick={handlePrev}
              className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← Back
            </button>
            <div /> {/* Spacer */}
          </div>
        )}
      </div>
    </div>
  );
}