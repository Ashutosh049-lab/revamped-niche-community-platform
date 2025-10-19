// Client-side Firebase seeding script
// This runs in the browser and uses the same credentials as your web app

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDiFLGdPiP9n1UrN7y2k8Q-JfQHAk8HQD0",
  authDomain: "storedata-cdac6.firebaseapp.com",
  projectId: "storedata-cdac6",
  storageBucket: "storedata-cdac6.firebasestorage.app",
  messagingSenderId: "115311579403",
  appId: "1:115311579403:web:78dae1c1f5d1167b90520e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

window.seedDatabase = async function() {
  try {
    console.log("🌱 Starting to seed Firebase database...");
    
    // Seed communities
    console.log("📝 Seeding communities...");
    for (const community of sampleCommunities) {
      const { id, ...data } = community;
      await setDoc(doc(db, "communities", id), {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`✅ Added community: ${community.name}`);
    }
    
    // Seed posts
    console.log("📄 Seeding posts...");
    for (const post of samplePosts) {
      const docRef = await addDoc(collection(db, "posts"), {
        ...post,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`✅ Added post: ${post.title}`);
    }
    
    console.log("🎉 Database seeding completed successfully!");
    console.log("\n📊 Seeded data:");
    console.log(`   • ${sampleCommunities.length} communities`);
    console.log(`   • ${samplePosts.length} posts`);
    console.log("\n🔄 Refresh your page to see the new data!");
    
    return "✅ Seeding completed successfully!";
    
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    return `❌ Seeding failed: ${error.message}`;
  }
};

console.log("🔧 Seeding script loaded! Run 'seedDatabase()' in the console to populate the database.");
console.log("📋 Make sure you're signed in to your Firebase account first!");