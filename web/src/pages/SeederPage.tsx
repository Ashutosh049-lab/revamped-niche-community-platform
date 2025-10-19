import React from 'react';
import DatabaseSeeder from '../components/DatabaseSeeder';

const SeederPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <DatabaseSeeder />
        
        <div className="max-w-2xl mx-auto mt-8 text-center">
          <a 
            href="/"
            className="inline-block bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            ← Back to Communities
          </a>
        </div>
      </div>
    </div>
  );
};

export default SeederPage;