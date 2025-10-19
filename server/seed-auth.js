/* eslint-disable no-console */
// Point Admin SDK at the Auth emulator if not already set
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

const admin = require("firebase-admin");
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "demo-niche";

try {
  admin.initializeApp({ projectId });
} catch (e) {
  console.warn("initializeApp warning:", e);
}

async function ensureUser(email, password, displayName) {
  try {
    const existing = await admin.auth().getUserByEmail(email);
    console.log(`User already exists: ${existing.email} (${existing.uid})`);
    return existing;
  } catch (e) {
    if (e && e.code === "auth/user-not-found") {
      const created = await admin.auth().createUser({ email, password, displayName, emailVerified: false, disabled: false });
      console.log(`Created user: ${created.email} (${created.uid})`);
      return created;
    }
    throw e;
  }
}

(async () => {
  const demoUsers = [
    { email: "demo@example.com", password: "password123", displayName: "Demo User" },
    { email: "alex@dev.test", password: "password123", displayName: "Alex Dev" },
  ];

  for (const u of demoUsers) {
    await ensureUser(u.email, u.password, u.displayName);
  }

  console.log("Auth seed complete.");
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
