import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useAuth } from '../auth/AuthProvider';

interface ProfileData {
  displayName: string;
  bio: string;
  location: string;
  website: string;
  interests: string[];
  experience: string;
  profileTheme: string;
  privacy: {
    showEmail: boolean;
    showLocation: boolean;
    allowMessages: boolean;
    showActivity: boolean;
  };
  notifications: {
    email: boolean;
    push: boolean;
    comments: boolean;
    votes: boolean;
    mentions: boolean;
    achievements: boolean;
    newsletters: boolean;
  };
}

const defaultProfile: ProfileData = {
  displayName: '',
  bio: '',
  location: '',
  website: '',
  interests: [],
  experience: 'beginner',
  profileTheme: 'default',
  privacy: {
    showEmail: false,
    showLocation: true,
    allowMessages: true,
    showActivity: true,
  },
  notifications: {
    email: true,
    push: true,
    comments: true,
    votes: false,
    mentions: true,
    achievements: true,
    newsletters: false,
  },
};

export default function ProfileCustomization() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const availableInterests = [
    'Technology', 'Science', 'Arts & Design', 'Business', 'Health & Fitness',
    'Education', 'Lifestyle', 'Gaming', 'Sports', 'Travel', 'Food & Cooking', 'Music'
  ];

  const profileThemes = [
    { id: 'default', name: 'Default', colors: ['bg-blue-500', 'bg-blue-600'] },
    { id: 'nature', name: 'Nature', colors: ['bg-green-500', 'bg-green-600'] },
    { id: 'sunset', name: 'Sunset', colors: ['bg-orange-500', 'bg-red-500'] },
    { id: 'ocean', name: 'Ocean', colors: ['bg-cyan-500', 'bg-blue-500'] },
    { id: 'purple', name: 'Purple', colors: ['bg-purple-500', 'bg-indigo-500'] },
    { id: 'dark', name: 'Dark', colors: ['bg-gray-800', 'bg-gray-900'] },
  ];

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user?.uid || !db) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setProfileData({
          displayName: userData.displayName || '',
          bio: userData.bio || '',
          location: userData.location || '',
          website: userData.website || '',
          interests: userData.interests || [],
          experience: userData.experience || 'beginner',
          profileTheme: userData.profileTheme || 'default',
          privacy: { ...defaultProfile.privacy, ...userData.privacy },
          notifications: { ...defaultProfile.notifications, ...userData.notifications },
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.uid || !db || saving) return;

    setSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...profileData,
        updatedAt: new Date(),
      });
      
      // Show success message (you could use a toast library)
      console.log('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile || !user?.uid || !storage) return;

    setUploadingAvatar(true);
    try {
      const avatarRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(avatarRef, avatarFile);
      const downloadURL = await getDownloadURL(avatarRef);
      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { photoURL: downloadURL });
      
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (error) {
      console.error('Error uploading avatar:', error);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setProfileData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-gray-600 mt-1">Customize your profile and preferences</p>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-gray-200">
          <nav className="flex space-x-8">
            {[
              { id: 'basic', label: 'Basic Info', icon: '👤' },
              { id: 'interests', label: 'Interests', icon: '🎯' },
              { id: 'appearance', label: 'Appearance', icon: '🎨' },
              { id: 'privacy', label: 'Privacy', icon: '🔒' },
              { id: 'notifications', label: 'Notifications', icon: '🔔' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Current avatar"
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                      {profileData.displayName[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    Change Avatar
                  </label>
                  {avatarFile && (
                    <button
                      onClick={uploadAvatar}
                      disabled={uploadingAvatar}
                      className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {uploadingAvatar ? 'Uploading...' : 'Upload'}
                    </button>
                  )}
                </div>
              </div>

              {/* Basic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                  <input
                    type="text"
                    value={profileData.displayName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={50}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={profileData.location}
                    onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="City, Country"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                  <input
                    type="url"
                    value={profileData.website}
                    onChange={(e) => setProfileData(prev => ({ ...prev, website: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://yourwebsite.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                  <textarea
                    value={profileData.bio}
                    onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    maxLength={500}
                    placeholder="Tell others about yourself..."
                  />
                  <div className="text-sm text-gray-500 mt-1">{profileData.bio.length}/500</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Experience Level</label>
                  <select
                    value={profileData.experience}
                    onChange={(e) => setProfileData(prev => ({ ...prev, experience: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'interests' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Interests</h3>
                <p className="text-gray-600 mb-4">Select topics you're interested in to personalize your feed</p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {availableInterests.map(interest => (
                    <button
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        profileData.interests.includes(interest)
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
                
                <div className="mt-4 text-sm text-gray-600">
                  Selected: {profileData.interests.length} interests
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Theme</h3>
                <p className="text-gray-600 mb-4">Choose a color theme for your profile</p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {profileThemes.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => setProfileData(prev => ({ ...prev, profileTheme: theme.id }))}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        profileData.profileTheme === theme.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-full h-8 rounded mb-2 bg-gradient-to-r ${theme.colors.join(' ')}`}></div>
                      <div className="text-sm font-medium text-gray-900">{theme.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy Settings</h3>
                <div className="space-y-4">
                  {Object.entries({
                    showEmail: 'Show email address on profile',
                    showLocation: 'Show location on profile',
                    allowMessages: 'Allow other users to message me',
                    showActivity: 'Show my activity status',
                  }).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{label}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profileData.privacy[key as keyof typeof profileData.privacy]}
                          onChange={(e) => setProfileData(prev => ({
                            ...prev,
                            privacy: { ...prev.privacy, [key]: e.target.checked }
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
                <div className="space-y-4">
                  {Object.entries({
                    email: 'Email notifications',
                    push: 'Push notifications',
                    comments: 'New comments on my posts',
                    votes: 'Votes on my posts and comments',
                    mentions: 'When someone mentions me',
                    achievements: 'New achievements and badges',
                    newsletters: 'Weekly community newsletter',
                  }).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{label}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profileData.notifications[key as keyof typeof profileData.notifications]}
                          onChange={(e) => setProfileData(prev => ({
                            ...prev,
                            notifications: { ...prev.notifications, [key]: e.target.checked }
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}