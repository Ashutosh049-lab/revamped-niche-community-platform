/* eslint-disable no-console */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const admin = require("firebase-admin");

// Use demo project to match running emulators
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "demo-niche";

try {
  admin.initializeApp({ projectId });
} catch (e) {
  console.warn("initializeApp warning:", e);
}

const db = admin.firestore();

async function seed() {
  const now = admin.firestore.Timestamp.fromDate(new Date());

  const communities = [
    { id: "tech", name: "Tech", description: "Latest gadgets, dev tools, and trends.", category: "technology", memberCount: 128 },
    { id: "fitness", name: "Fitness", description: "Workouts, nutrition, and recovery.", category: "health", memberCount: 96 },
    { id: "books", name: "Books", description: "Fiction, non-fiction, and recommendations.", category: "reading", memberCount: 54 }
  ];

  const posts = [
    { title: "What's new in React 19?", content: "React 19 brings ...", authorId: "dev_alex", communityId: "tech", createdAt: now },
    { title: "Best 20-min HIIT routine", content: "Try this circuit ...", authorId: "coach_maya", communityId: "fitness", createdAt: now },
    { title: "Top sci-fi reads this month", content: "Dune, Foundation ...", authorId: "reader_jay", communityId: "books", createdAt: now }
  ];

  console.log("Seeding communities...");
  for (const c of communities) {
    await db.collection("communities").doc(c.id).set(c, { merge: true });
  }

  console.log("Seeding posts...");
  const batch = db.batch();
  posts.forEach((p) => {
    const ref = db.collection("posts").doc();
    batch.set(ref, p);
  });
  await batch.commit();

  console.log("Seed complete.");
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
