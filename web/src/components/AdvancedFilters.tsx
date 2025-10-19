import { useState, useEffect, useMemo } from 'react';
import { createRecommendationEngine } from '../services/RecommendationEngine';
import { useAuth } from '../features/auth/AuthProvider';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface FilterOptions {
  categories: string[];
  tags: string[];
  sortBy: 'relevance' | 'activity' | 'popularity' | 'newest';
  timeFrame?: '24h' | '7d' | '30d';
  minActivityScore?: number;
  searchQuery?: string;
}

interface AdvancedFiltersProps {
  onFiltersChange: (filters: FilterOptions) => void;
  initialFilters?: Partial<FilterOptions>;
  showPersonalized?: boolean;
  className?: string;
}

const CATEGORIES = [
  'Technology', 'Science', 'Gaming', 'Movies', 'Music', 'Books', 
  'Sports', 'Art', 'Cooking', 'Travel', 'Health', 'Business',
  'Education', 'Politics', 'Nature', 'Fashion', 'Photography'
];

export default function AdvancedFilters({ 
  onFiltersChange, 
  initialFilters = {}, 
  showPersonalized = true,
  className = '' 
}: AdvancedFiltersProps) {
  const { user } = useAuth();
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    tags: [],
    sortBy: 'relevance',
    timeFrame: '7d',
    minActivityScore: 0,
    searchQuery: '',
    ...initialFilters
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [trendingTags, setTrendingTags] = useState<Array<{tag: string, count: number}>>([]);
  const [personalizedTags, setPersonalizedTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  const recommendationEngine = useMemo(() => 
    user ? createRecommendationEngine(user.uid) : null, 
    [user]
  );

  // Load trending and personalized tags
  useEffect(() => {
    const loadTags = async () => {
      if (!recommendationEngine) return;
      
      setIsLoadingTags(true);
      try {
        const [trending, userDoc] = await Promise.all([
          recommendationEngine.getTrendingTags(filters.timeFrame),
          // Get user's interest tags
          user ? getDoc(doc(db, 'users', user.uid)) : Promise.resolve(null)
        ]);

        setTrendingTags(trending);
        
        if (userDoc && userDoc.exists()) {
          const userInterests = userDoc.data()?.userInterests || [];
          const userTags = userInterests.flatMap((interest: any) => interest.tags || []);
          setPersonalizedTags([...new Set(userTags as string[])].slice(0, 10));
        }
      } catch (error) {
        console.error('Error loading tags:', error);
      } finally {
        setIsLoadingTags(false);
      }
    };

    loadTags();
  }, [recommendationEngine, filters.timeFrame, user]);

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    handleFilterChange('categories', newCategories);
  };

  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    handleFilterChange('tags', newTags);
  };

  const clearAllFilters = () => {
    const clearedFilters: FilterOptions = {
      categories: [],
      tags: [],
      sortBy: 'relevance',
      timeFrame: '7d',
      minActivityScore: 0,
      searchQuery: ''
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const activeFiltersCount = filters.categories.length + filters.tags.length + 
    (filters.searchQuery ? 1 : 0) + ((filters.minActivityScore || 0) > 0 ? 1 : 0);

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">Filters</h3>
            {activeFiltersCount > 0 && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                {activeFiltersCount} active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear all
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg 
                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick filters - always visible */}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search communities or posts..."
              value={filters.searchQuery}
              onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Sort */}
          <select
            value={filters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="relevance">Most Relevant</option>
            <option value="activity">Most Active</option>
            <option value="popularity">Most Popular</option>
            <option value="newest">Newest</option>
          </select>

          {/* Time frame */}
          <select
            value={filters.timeFrame}
            onChange={(e) => handleFilterChange('timeFrame', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Categories */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Categories</h4>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    filters.categories.includes(category)
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Personalized Tags */}
          {showPersonalized && personalizedTags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-medium text-gray-900">For You</h4>
                <span className="text-xs text-gray-500 bg-yellow-100 px-2 py-0.5 rounded-full">
                  Based on your interests
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {personalizedTags.map(tag => (
                  <button
                    key={`personal-${tag}`}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      filters.tags.includes(tag)
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                        : 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100'
                    }`}
                  >
                    ⭐ {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trending Tags */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="font-medium text-gray-900">Trending Tags</h4>
              <span className="text-xs text-gray-500 bg-green-100 px-2 py-0.5 rounded-full">
                Popular now
              </span>
            </div>
            {isLoadingTags ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Loading trending tags...
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {trendingTags.slice(0, 15).map(({ tag, count }) => (
                  <button
                    key={`trending-${tag}`}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      filters.tags.includes(tag)
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                    }`}
                  >
                    🔥 {tag} <span className="text-xs opacity-75">({count})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Activity Score Filter */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Minimum Activity Level</h4>
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="100"
                value={filters.minActivityScore}
                onChange={(e) => handleFilterChange('minActivityScore', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>Any activity</span>
                <span className="font-medium">Score: {filters.minActivityScore}</span>
                <span>Very active</span>
              </div>
            </div>
          </div>

          {/* Selected filters summary */}
          {activeFiltersCount > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Active Filters</h4>
              <div className="flex flex-wrap gap-2">
                {filters.categories.map(category => (
                  <span key={category} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                    {category}
                    <button onClick={() => toggleCategory(category)} className="hover:text-blue-900">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                      </svg>
                    </button>
                  </span>
                ))}
                {filters.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                    #{tag}
                    <button onClick={() => toggleTag(tag)} className="hover:text-green-900">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}