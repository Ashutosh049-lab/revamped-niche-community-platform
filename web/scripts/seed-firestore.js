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

async function main() {
  const uid = process.env.SEED_UID || "KnMTCecfMo90gcjZKMsLbf6qY5Tt";
  
  // Only add to moderators if uid is not empty
  const moderators = uid && uid.trim() ? [uid] : [];

  const publicRef = db.doc("communities/public-demo");
  await publicRef.set({
    name: "Public Demo",
    description: "A public community used for local testing.",
    public: true,
    admins: [],
    moderators,
    createdAt: new Date("2025-01-01T00:00:00Z"),
  }, { merge: true });

  const privateRef = db.doc("communities/private-demo");
  await privateRef.set({
    name: "Private Demo",
    description: "A private community (membership required).",
    public: false,
    admins: [],
    moderators,
    createdAt: new Date("2025-01-01T00:00:00Z"),
  }, { merge: true });

  await privateRef.collection("members").doc(uid).set({
    role: "member",
    since: new Date("2025-01-02T00:00:00Z"),
  }, { merge: true });

  console.log(`Seeded: communities/public-demo, communities/private-demo (+ members/${uid}) with ${moderators.length > 0 ? 'moderators: ' + moderators.join(', ') : 'no moderators'}`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
