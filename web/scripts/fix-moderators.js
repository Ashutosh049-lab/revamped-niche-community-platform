import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Point to emulators
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8081";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";

const PROJECT_ID = process.env.FB_PROJECT_ID || "niche-platform-2025";

if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID });
}

const db = getFirestore();

async function fixModerators() {
  console.log("🔧 Fixing moderators arrays...");
  
  try {
    // Get all communities
    const snapshot = await db.collection('communities').get();
    const batch = db.batch();
    let fixedCount = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const moderators = data.moderators || [];
      
      // Filter out empty strings
      const cleanModerators = moderators.filter(mod => mod && mod.trim());
      
      // Only update if there were empty strings
      if (moderators.length !== cleanModerators.length) {
        console.log(`Fixing ${doc.id}: ${moderators.length} -> ${cleanModerators.length} moderators`);
        batch.update(doc.ref, { moderators: cleanModerators });
        fixedCount++;
      }
    });
    
    if (fixedCount > 0) {
      await batch.commit();
      console.log(`✅ Fixed ${fixedCount} communities`);
    } else {
      console.log("✅ No communities needed fixing");
    }
    
  } catch (error) {
    console.error("❌ Error fixing moderators:", error);
    process.exit(1);
  }
}

fixModerators().then(() => {
  console.log("🎉 Moderators cleanup complete!");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});