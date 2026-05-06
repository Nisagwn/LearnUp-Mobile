import React from 'react';

const Loading = ({ size = 'md', fullscreen = false }) => {
  const sizeConfig = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10'
  };

  const spinner = (
    <div className={`${sizeConfig[size]} border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin`} />
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-[#0B1120]/80 backdrop-blur-sm flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default Loading;
