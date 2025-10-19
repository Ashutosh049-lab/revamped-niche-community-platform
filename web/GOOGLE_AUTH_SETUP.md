# 🔥 Google Sign-In Setup for Firebase

## 🚨 CRITICAL: Google Sign-In is NOT ENABLED in Firebase Console

This is why you're getting authentication errors. Follow these steps to enable it:

## 📋 Step-by-Step Setup

### 1. Open Firebase Console
Go to [Firebase Console](https://console.firebase.google.com)

### 2. Select Your Project
- Click on **`storedata-cdac6`** project
- If you don't see this project, you may need to create it or verify access

### 3. Enable Google Authentication
1. In the left sidebar, click **Authentication**
2. Click the **Sign-in method** tab
3. Find **Google** in the list of providers
4. Click **Google** → **Enable**
5. Enter your **Project support email** (your email)
6. Click **Save**

### 4. Add Authorized Domains
Still in the **Authentication** → **Sign-in method** section:
1. Scroll down to **Authorized domains**
2. Add these domains if not present:
   - `localhost`
   - `127.0.0.1`

### 5. Configure OAuth Consent Screen (if prompted)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project: `storedata-cdac6`
3. Navigate to **APIs & Services** → **OAuth consent screen**
4. Fill in required fields:
   - **App name**: "Revamped Niche Community Platform"
   - **User support email**: Your email
   - **Developer contact information**: Your email
5. Save and continue

## 🧪 Testing Steps

After completing the setup:

1. **Refresh your browser** at http://127.0.0.1:5173
2. Try **"Continue with Google (Popup)"**
3. If popup is blocked, try **"Continue with Google (Redirect)"**

## 🔍 Common Issues & Solutions

### Issue: "This app isn't verified"
- Click **Advanced** → **Go to [app name] (unsafe)**
- This is normal for development apps

### Issue: "Error 400: redirect_uri_mismatch"
- Make sure `127.0.0.1` is in authorized domains
- Check that the redirect URI matches exactly

### Issue: "Popup blocked"
- Allow popups for this site
- Or use the redirect method instead

### Issue: "auth/operation-not-allowed"
- Google Sign-In is not enabled in Firebase Console
- Follow steps 1-3 above

## 🎯 Expected Behavior After Setup

✅ **Working**: Google popup opens with account selection
✅ **Working**: Account selection and permission screen
✅ **Working**: Automatic redirect to main app after authentication
✅ **Working**: User profile creation in Firestore

## 💡 Alternative: Email/Password Sign-Up

If Google Sign-In setup is complex, you can use email/password authentication which works immediately:

1. Enter any valid email address
2. Create a password (6+ characters)
3. Click **"Sign up"**

## 🆘 Still Having Issues?

1. **Check browser console** for specific error codes
2. **Verify Firebase project ownership** - you need admin access
3. **Try incognito mode** to rule out browser cache issues
4. **Use email/password** as immediate alternative

---

## 🚀 Once Setup is Complete

After enabling Google Sign-In in Firebase Console:
- Refresh http://127.0.0.1:5173
- Google authentication should work smoothly
- You'll have access to all community features