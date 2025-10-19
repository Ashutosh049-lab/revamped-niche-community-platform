import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Use production Firebase project
const PROJECT_ID = "storedata-cdac6";

// Initialize Firebase Admin (for production, you'd need a service account key)
// For now, we'll use the Firebase CLI authenticated session
if (!getApps().length) {
  initializeApp({ 
    projectId: PROJECT_ID,
    // Note: This assumes you're authenticated with Firebase CLI
    // Run: firebase login first
  });
}

const db = getFirestore();

// Sample data
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

const sampleUsers = [
  {
    id: "seed-user-1",
    displayName: "Alex Chen",
    email: "alex@example.com",
    bio: "Full-stack developer and startup founder passionate about creating meaningful technology solutions.",
    interests: ["Technology", "Entrepreneurship", "AI", "Web Development"],
    profileImage: null,
    stats: {
      totalPosts: 12,
      totalComments: 45,
      totalVotes: 23,
      reputation: 156
    },
    achievements: ["Early Adopter", "Community Builder"],
    followedCommunities: ["tech-enthusiasts", "startup-founders"],
    createdAt: new Date("2025-01-15T10:00:00Z"),
    lastActiveAt: new Date()
  },
  {
    id: "seed-user-2",
    displayName: "Sarah Johnson",
    email: "sarah@example.com",
    bio: "Fitness coach and wellness advocate. Helping people achieve their health goals through sustainable lifestyle changes.",
    interests: ["Fitness", "Nutrition", "Wellness", "Mental Health"],
    profileImage: null,
    stats: {
      totalPosts: 8,
      totalComments: 32,
      totalVotes: 18,
      reputation: 124
    },
    achievements: ["Fitness Guru", "Motivator"],
    followedCommunities: ["fitness-community", "startup-founders"],
    createdAt: new Date("2025-01-16T14:30:00Z"),
    lastActiveAt: new Date()
  },
  {
    id: "seed-user-3",
    displayName: "Marcus Rivera",
    email: "marcus@example.com",
    bio: "Avid reader and literature professor. Always on the hunt for the next great book to devour.",
    interests: ["Literature", "Writing", "Philosophy", "History"],
    profileImage: null,
    stats: {
      totalPosts: 6,
      totalComments: 28,
      totalVotes: 15,
      reputation: 98
    },
    achievements: ["Bookworm", "Thoughtful Reviewer"],
    followedCommunities: ["book-lovers"],
    createdAt: new Date("2025-01-17T09:15:00Z"),
    lastActiveAt: new Date()
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
    isLocked: false,
    createdAt: new Date("2025-01-18T16:45:00Z")
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
    isLocked: false,
    createdAt: new Date("2025-01-19T07:30:00Z")
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
    isLocked: false,
    createdAt: new Date("2025-01-19T20:15:00Z")
  }
];

async function seedDatabase() {
  try {
    console.log(`🌱 Starting to seed Firebase project: ${PROJECT_ID}`);
    
    const batch = db.batch();
    
    // Seed communities
    console.log("📝 Seeding communities...");
    for (const community of sampleCommunities) {
      const { id, ...data } = community;
      const docRef = db.collection("communities").doc(id);
      batch.set(docRef, {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Seed users
    console.log("👥 Seeding users...");
    for (const user of sampleUsers) {
      const { id, ...data } = user;
      const docRef = db.collection("users").doc(id);
      batch.set(docRef, data);
    }
    
    // Commit the batch
    await batch.commit();
    console.log("✅ Communities and users seeded!");
    
    // Seed posts (separate batch due to size limits)
    console.log("📄 Seeding posts...");
    const postBatch = db.batch();
    
    for (const post of samplePosts) {
      const docRef = db.collection("posts").doc(); // Auto-generate ID
      postBatch.set(docRef, {
        ...post,
        id: docRef.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    await postBatch.commit();
    console.log("✅ Posts seeded!");
    
    console.log("🎉 Database seeding completed successfully!");
    console.log("\n📊 Seeded data:");
    console.log(`   • ${sampleCommunities.length} communities`);
    console.log(`   • ${sampleUsers.length} users`);
    console.log(`   • ${samplePosts.length} posts`);
    console.log("\n🌐 Check your app at: http://127.0.0.1:5173");
    
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

// Run the seeding
seedDatabase();