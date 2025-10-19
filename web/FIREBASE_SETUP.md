# Firebase Setup Guide

## 🔥 Firestore Database Setup

The errors you're seeing are due to Firestore security rules blocking access. Here's how to fix them:

### 1. Deploy Firestore Security Rules

**Option A: Using Firebase CLI (Recommended)**
```bash
# Install Firebase CLI if you haven't already
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not done)
firebase init firestore

# Deploy the security rules
firebase deploy --only firestore:rules
```

**Option B: Using Firebase Console (Quick Fix)**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`storedata-cdac6`)
3. Go to **Firestore Database**
4. Click on the **Rules** tab
5. Replace the existing rules with the content from `firestore.rules`
6. Click **Publish**

### 2. Current Security Rules

The `firestore.rules` file contains:
- ✅ Authentication required for all operations
- ✅ Users can manage their own profiles
- ✅ Read access to communities and posts
- ✅ Proper permission controls

### 3. For Development (Temporary Fix)

If you want to quickly test without authentication, you can temporarily use these permissive rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **Warning**: Only use permissive rules for development! Never in production.

### 4. Database Collections Setup

Make sure these collections exist in your Firestore:
- `users` - User profiles and settings
- `communities` - Community information
- `posts` - Community posts
- `comments` - Post comments
- `notifications` - User notifications
- `polls` - Community polls
- `votes` - Voting records
- `reactions` - Post/comment reactions

### 5. Test User Document

Create a test user document in the `users` collection:
```json
{
  "displayName": "Test User",
  "email": "test@example.com",
  "bio": "This is a test user",
  "interests": ["Technology", "Gaming"],
  "followedCommunities": [],
  "achievements": [],
  "stats": {
    "totalPosts": 0,
    "totalComments": 0,
    "totalVotes": 0,
    "reputation": 0
  },
  "createdAt": "2025-01-11T20:00:00.000Z",
  "lastActiveAt": "2025-01-11T20:00:00.000Z"
}
```

### 6. Common Issues & Solutions

**Permission Denied Errors:**
- Make sure you're signed in
- Check that security rules are deployed
- Verify your user has proper permissions

**Internal Assertion Failed:**
- Usually caused by permission issues
- Try refreshing the page after fixing rules
- Clear browser cache if needed

**Connection Issues:**
- Check your internet connection
- Verify Firebase project configuration
- Make sure API keys are correct

### 7. Environment Variables

Make sure these are set in your `.env` file:
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=storedata-cdac6
# ... other Firebase config
```

---

## 🚀 After Setup

Once you've deployed the security rules:
1. Refresh your browser
2. Sign in with a Google account
3. The app should work without permission errors
4. You'll see all navigation sections working properly

## 💡 Need Help?

If you're still having issues:
1. Check the browser console for specific errors
2. Verify your Firebase project settings
3. Make sure authentication is working
4. Test with a simple read operation first