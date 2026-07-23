import React from 'react';

const SkeletonTable = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="w-full animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center gap-4 py-3 px-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <div
              key={cIdx}
              className={`h-4 bg-slate-200 dark:bg-slate-700/60 rounded ${
                cIdx === 0 ? 'w-1/4' : cIdx === 1 ? 'w-1/3' : 'w-1/6'
              }`}
            ></div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default SkeletonTable;
