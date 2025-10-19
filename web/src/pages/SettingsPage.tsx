import { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthProvider';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../components/ToastProvider';

interface UserSettings {
  notifications: {
    email: boolean;
    push: boolean;
    comments: boolean;
    reactions: boolean;
    follows: boolean;
    mentions: boolean;
    achievements: boolean;
    polls: boolean;
    posts: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private';
    showEmail: boolean;
    showActivity: boolean;
    allowMessages: boolean;
  };
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    showRecommendations: boolean;
    feedSortBy: 'newest' | 'top' | 'relevance';
  };
}

const defaultSettings: UserSettings = {
  notifications: {
    email: false,
    push: true,
    comments: true,
    reactions: true,
    follows: true,
    mentions: true,
    achievements: true,
    polls: true,
    posts: true
  },
  privacy: {
    profileVisibility: 'public',
    showEmail: false,
    showActivity: true,
    allowMessages: true
  },
  preferences: {
    theme: 'light',
    language: 'en',
    timezone: 'UTC',
    showRecommendations: true,
    feedSortBy: 'relevance'
  }
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<'notifications' | 'privacy' | 'preferences' | 'account'>('notifications');

  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.uid || !db) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setSettings({
            notifications: { ...defaultSettings.notifications, ...userData.notificationSettings },
            privacy: { ...defaultSettings.privacy, ...userData.privacySettings },
            preferences: { ...defaultSettings.preferences, ...userData.preferences }
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Failed to load settings', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const saveSettings = async () => {
    if (!user?.uid || !db) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notificationSettings: settings.notifications,
        privacySettings: settings.privacy,
        preferences: settings.preferences,
        updatedAt: new Date()
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      showToast('Settings saved', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (section: keyof UserSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h1>
          <p className="text-gray-600">You need to be signed in to access settings.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="bg-white rounded-lg border p-6">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">⚙️ Settings</h1>
          <p className="text-gray-600">Manage your account preferences and privacy settings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border p-4 sticky top-6">
              <nav className="space-y-1">
                {[
                  { id: 'notifications', label: '🔔 Notifications', description: 'Email and push settings' },
                  { id: 'privacy', label: '🔒 Privacy', description: 'Who can see your content' },
                  { id: 'preferences', label: '🎨 Preferences', description: 'Theme and display options' },
                  { id: 'account', label: '👤 Account', description: 'Profile and security' }
                ].map(section => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id as any)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium">{section.label}</div>
                    <div className="text-sm text-gray-500 mt-1">{section.description}</div>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg border p-6">
              {/* Notifications Settings */}
              {activeSection === 'notifications' && (
                <div>
                  <h2 className="text-xl font-semibold mb-6">Notification Settings</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">Delivery Methods</h3>
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.notifications.push}
                            onChange={(e) => updateSettings('notifications', 'push', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-3 text-sm text-gray-700">Push notifications</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.notifications.email}
                            onChange={(e) => updateSettings('notifications', 'email', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-3 text-sm text-gray-700">Email notifications</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">Activity Types</h3>
                      <div className="space-y-3">
                        {[
                          { key: 'comments', label: 'Comments on my posts', icon: '💬' },
                          { key: 'reactions', label: 'Reactions to my content', icon: '😊' },
                          { key: 'follows', label: 'New followers', icon: '👥' },
                          { key: 'mentions', label: 'Mentions in posts/comments', icon: '📢' },
                          { key: 'achievements', label: 'Achievement unlocked', icon: '🏆' },
                          { key: 'polls', label: 'New polls in communities', icon: '📊' },
                          { key: 'posts', label: 'New posts in followed communities', icon: '📝' }
                        ].map(item => (
                          <label key={item.key} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={settings.notifications[item.key as keyof typeof settings.notifications] as boolean}
                              onChange={(e) => updateSettings('notifications', item.key, e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-3 text-sm text-gray-700 flex items-center">
                              <span className="mr-2">{item.icon}</span>
                              {item.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Privacy Settings */}
              {activeSection === 'privacy' && (
                <div>
                  <h2 className="text-xl font-semibold mb-6">Privacy Settings</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Profile Visibility
                      </label>
                      <select
                        value={settings.privacy.profileVisibility}
                        onChange={(e) => updateSettings('privacy', 'profileVisibility', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="public">Public - Anyone can view your profile</option>
                        <option value="private">Private - Only you can view your profile</option>
                      </select>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-medium text-gray-900">Profile Information</h3>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.privacy.showEmail}
                          onChange={(e) => updateSettings('privacy', 'showEmail', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-3 text-sm text-gray-700">Show email address on profile</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.privacy.showActivity}
                          onChange={(e) => updateSettings('privacy', 'showActivity', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-3 text-sm text-gray-700">Show activity status</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.privacy.allowMessages}
                          onChange={(e) => updateSettings('privacy', 'allowMessages', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-3 text-sm text-gray-700">Allow direct messages</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Preferences Settings */}
              {activeSection === 'preferences' && (
                <div>
                  <h2 className="text-xl font-semibold mb-6">Display Preferences</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Theme
                      </label>
                      <select
                        value={settings.preferences.theme}
                        onChange={(e) => updateSettings('preferences', 'theme', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="auto">Auto (system preference)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Default Feed Sort
                      </label>
                      <select
                        value={settings.preferences.feedSortBy}
                        onChange={(e) => updateSettings('preferences', 'feedSortBy', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="relevance">Most Relevant</option>
                        <option value="newest">Newest First</option>
                        <option value="top">Top Voted</option>
                      </select>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-medium text-gray-900">Content Preferences</h3>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.preferences.showRecommendations}
                          onChange={(e) => updateSettings('preferences', 'showRecommendations', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-3 text-sm text-gray-700">Show personalized recommendations</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Settings */}
              {activeSection === 'account' && (
                <div>
                  <h2 className="text-xl font-semibold mb-6">Account Settings</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">Account Information</h3>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600 mb-1">Email</div>
                        <div className="font-medium">{user.email}</div>
                        <div className="text-sm text-gray-600 mt-2 mb-1">User ID</div>
                        <div className="font-mono text-sm text-gray-700">{user.uid}</div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">Danger Zone</h3>
                      <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                        <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                          Delete Account
                        </button>
                        <p className="text-sm text-gray-600 mt-2">
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    saved
                      ? 'bg-green-600 text-white'
                      : saving
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}