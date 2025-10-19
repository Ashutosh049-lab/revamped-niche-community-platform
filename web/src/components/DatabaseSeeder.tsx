import React, { useState } from 'react';
import { collection, doc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SeedingResult {
  success: boolean;
  message: string;
  details?: string[];
}

const DatabaseSeeder: React.FC = () => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [result, setResult] = useState<SeedingResult | null>(null);

  const sampleCommunities = [
    {
      id: "tech-enthusiasts",
      name: "Tech Enthusiasts",
      description: "Discuss the latest in technology, programming, and innovation. Share your projects and learn from others.",
      category: "Technology",
      tags: ["programming", "ai", "web-development", "mobile"],
      public: true,
      isActive: true,
      memberCount: 145,
      postCount: 23,
      activityScore: 0.8,
      createdBy: "seed-user-1",
      admins: ["seed-user-1"],
      moderators: [],
      rules: [
        "Be respectful to all members",
        "No spam or self-promotion",
        "Keep discussions tech-related",
        "Help others learn and grow"
      ]
    },
    {
      id: "fitness-community",
      name: "Fitness & Health Hub",
      description: "Share workout routines, nutrition tips, and motivate each other on our fitness journeys.",
      category: "Health & Fitness",
      tags: ["workout", "nutrition", "wellness", "motivation"],
      public: true,
      isActive: true,
      memberCount: 89,
      postCount: 18,
      activityScore: 0.7,
      createdBy: "seed-user-2",
      admins: ["seed-user-2"],
      moderators: [],
      rules: [
        "Support and encourage each other",
        "No medical advice - consult professionals",
        "Share your progress and tips",
        "Respect different fitness levels"
      ]
    },
    {
      id: "book-lovers",
      name: "Book Lovers Corner",
      description: "Discover new books, discuss your favorites, and connect with fellow readers.",
      category: "Literature",
      tags: ["reading", "fiction", "non-fiction", "reviews"],
      public: true,
      isActive: true,
      memberCount: 67,
      postCount: 15,
      activityScore: 0.6,
      createdBy: "seed-user-3",
      admins: ["seed-user-3"],
      moderators: [],
      rules: [
        "No spoilers without warnings",
        "Respect different reading preferences",
        "Share thoughtful reviews",
        "Recommend books with descriptions"
      ]
    },
    {
      id: "startup-founders",
      name: "Startup Founders Network",
      description: "Connect with fellow entrepreneurs, share challenges, and grow your business together.",
      category: "Business",
      tags: ["entrepreneurship", "startups", "business", "networking"],
      public: false,
      isActive: true,
      memberCount: 34,
      postCount: 12,
      activityScore: 0.9,
      createdBy: "seed-user-1",
      admins: ["seed-user-1"],
      moderators: ["seed-user-2"],
      rules: [
        "Verified entrepreneurs only",
        "Share genuine experiences",
        "Help others succeed",
        "No direct sales pitches"
      ]
    }
  ];

  const samplePosts = [
    {
      communityId: "tech-enthusiasts",
      authorId: "seed-user-1",
      title: "The Future of AI in Web Development",
      content: "I've been experimenting with AI-powered coding assistants and the results are fascinating. What are your thoughts on AI tools for developers? Are they helping or hindering the learning process?",
      tags: ["ai", "web-development", "future-tech"],
      type: "discussion",
      upvotes: 12,
      downvotes: 1,
      commentCount: 8,
      engagementScore: 0.85,
      isPinned: false,
      isLocked: false
    },
    {
      communityId: "fitness-community",
      authorId: "seed-user-2",
      title: "30-Day Morning Routine Challenge",
      content: "Who wants to join me for a 30-day morning routine challenge? We'll focus on consistency rather than intensity. Even 10 minutes counts! Share your goals below.",
      tags: ["challenge", "morning-routine", "consistency"],
      type: "challenge",
      upvotes: 18,
      downvotes: 0,
      commentCount: 15,
      engagementScore: 0.92,
      isPinned: true,
      isLocked: false
    },
    {
      communityId: "book-lovers",
      authorId: "seed-user-3",
      title: "Hidden Gems: Underrated Books of 2024",
      content: "I've compiled a list of amazing books that didn't get the attention they deserved this year. Have you read any of these? What hidden gems would you add to the list?",
      tags: ["recommendations", "2024", "hidden-gems"],
      type: "recommendation",
      upvotes: 9,
      downvotes: 0,
      commentCount: 12,
      engagementScore: 0.78,
      isPinned: false,
      isLocked: false
    }
  ];

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    setResult(null);
    
    const details: string[] = [];
    
    try {
      console.log('🌱 Starting database seeding...');
      details.push('🌱 Starting database seeding...');

      // Seed communities
      console.log('📝 Seeding communities...');
      details.push('📝 Seeding communities...');
      
      for (const community of sampleCommunities) {
        const { id, ...data } = community;
        await setDoc(doc(db, "communities", id), {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`✅ Added community: ${community.name}`);
        details.push(`✅ Added community: ${community.name}`);
      }

      // Seed posts
      console.log('📄 Seeding posts...');
      details.push('📄 Seeding posts...');
      
      for (const post of samplePosts) {
        await addDoc(collection(db, "posts"), {
          ...post,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`✅ Added post: ${post.title}`);
        details.push(`✅ Added post: ${post.title}`);
      }

      console.log('🎉 Database seeding completed successfully!');
      details.push('🎉 Database seeding completed successfully!');
      details.push(`📊 Created ${sampleCommunities.length} communities and ${samplePosts.length} posts`);
      details.push('🔄 Refresh the page to see the new data!');

      setResult({
        success: true,
        message: 'Database seeded successfully!',
        details
      });

    } catch (error: any) {
      console.error('❌ Seeding failed:', error);
      setResult({
        success: false,
        message: `Seeding failed: ${error.message}`,
        details: [...details, `❌ Error: ${error.message}`]
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        🌱 Database Seeder
      </h2>
      
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <h3 className="font-semibold text-blue-800">📋 What this does:</h3>
        <ul className="list-disc list-inside text-blue-700 mt-2">
          <li>Creates 4 sample communities (Tech, Fitness, Books, Startups)</li>
          <li>Adds 3 sample posts with content</li>
          <li>Uses your current authentication session</li>
        </ul>
      </div>

      <div className="text-center mb-6">
        <button
          onClick={handleSeedDatabase}
          disabled={isSeeding}
          className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
            isSeeding 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isSeeding ? '⏳ Seeding...' : '🚀 Seed Database'}
        </button>
      </div>

      {result && (
        <div className={`p-4 rounded-lg ${
          result.success 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <h3 className={`font-semibold ${
            result.success ? 'text-green-800' : 'text-red-800'
          }`}>
            {result.success ? '✅ Success!' : '❌ Error'}
          </h3>
          <p className={`mt-1 ${
            result.success ? 'text-green-700' : 'text-red-700'
          }`}>
            {result.message}
          </p>
          {result.details && (
            <div className="mt-3 text-sm font-mono">
              {result.details.map((detail, index) => (
                <div key={index} className="text-gray-600">{detail}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DatabaseSeeder;