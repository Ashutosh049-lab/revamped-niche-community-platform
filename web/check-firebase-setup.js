// Firebase Setup Verification Script
// Run this with: node check-firebase-setup.js

console.log('🔥 Firebase Setup Verification');
console.log('==============================');

const config = {
  apiKey: "AIzaSyDiFLGdPiP9n1UrN7y2k8Q-JfQHAk8HQD0",
  authDomain: "storedata-cdac6.firebaseapp.com", 
  projectId: "storedata-cdac6",
  storageBucket: "storedata-cdac6.firebasestorage.app",
  messagingSenderId: "115311579403",
  appId: "1:115311579403:web:78dae1c1f5d1167b90520e"
};

console.log('📋 Current Configuration:');
console.log('- Project ID:', config.projectId);
console.log('- Auth Domain:', config.authDomain);
console.log('- API Key:', config.apiKey.substring(0, 20) + '...');
console.log('');

console.log('🔍 What to check in Firebase Console:');
console.log('');
console.log('1. Go to: https://console.firebase.google.com');
console.log('2. Select project: storedata-cdac6');
console.log('3. Authentication → Sign-in method');
console.log('4. Check if Google is ENABLED (not just added)');
console.log('5. Check Authorized domains includes:');
console.log('   - localhost');
console.log('   - 127.0.0.1');
console.log('');

console.log('🚨 Common Issues:');
console.log('- Google provider is added but not enabled');
console.log('- Missing authorized domains');
console.log('- OAuth consent screen not configured');
console.log('- Project permissions (need to be owner/editor)');
console.log('');

console.log('✅ If Google Sign-In is properly enabled, you should see:');
console.log('- Green checkmark next to Google in sign-in methods');
console.log('- OAuth client ID configured');
console.log('- Support email set');
console.log('');

console.log('🔧 Quick Test:');
console.log('Try this URL in browser (replace with your domain):');
console.log(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${config.apiKey}&providerId=google.com&continueUri=http://127.0.0.1:5173`);