// Console Seeding Script
// Copy and paste this into your browser console while on http://127.0.0.1:5173

const seedData = async () => {
  console.log("🌱 Starting manual database seeding...");
  
  // Import Firebase functions from your app's context
  const { collection, doc, setDoc, addDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
  
  // Get the db instance from your app (assuming it's available globally)
  const db = window.firebase?.db || window.db;
  
  if (!db) {
    console.error("❌ Firebase database not found. Make sure you're on the main app page.");
    return;
  }

  try {
    // Sample communities data
    const communities = [
      {
        id: "tech-enthusiasts",
        name: "Tech Enthusiasts", 
        description: "Discuss the latest in technology, programming, and innovation.",
        category: "Technology",
        public: true,
        isActive: true,
        memberCount: 145,
        activityScore: 0.8,
        tags: ["programming", "ai", "web-development"]
      },
      {
        id: "fitness-community",
        name: "Fitness & Health Hub",
        description: "Share workout routines and motivate each other on fitness journeys.",
        category: "Health & Fitness", 
        public: true,
        isActive: true,
        memberCount: 89,
        activityScore: 0.7,
        tags: ["workout", "nutrition", "wellness"]
      }
    ];

    // Seed communities
    for (const community of communities) {
      const { id, ...data } = community;
      await setDoc(doc(db, "communities", id), {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "console-seed",
        admins: ["console-seed"],
        moderators: [],
        rules: ["Be respectful", "No spam", "Stay on topic"]
      });
      console.log(`✅ Created community: ${community.name}`);
    }

    console.log("🎉 Seeding completed! Refresh your page to see the communities.");
    
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  }
};

// Run the seeding
seedData();