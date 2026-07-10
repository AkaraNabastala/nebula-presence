import React from 'react';

const SkeletonTable = ({ rows = 5 }) => {
  return (
    <div className="w-full animate-pulse">
      {/* Header Skeleton */}
      <div className="h-10 bg-gray-200 rounded-lg mb-4 w-full"></div>
      
      {/* Rows Skeleton */}
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-12 bg-gray-100 rounded-lg w-16"></div> {/* Avatar/No */}
            <div className="h-12 bg-gray-100 rounded-lg flex-1"></div> {/* Content */}
            <div className="h-12 bg-gray-100 rounded-lg w-24"></div> {/* Action */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonTable;