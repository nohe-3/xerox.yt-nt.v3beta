import React from 'react';
import { Link } from 'react-router-dom';
import type { Video } from '../types';

interface SearchVideoResultCardProps {
  video: Video;
}

const SearchVideoResultCard: React.FC<SearchVideoResultCardProps> = ({ video }) => {
  return (
    <Link to={`/watch/${video.id}`} className="flex flex-col sm:flex-row gap-4 group mb-4">
      {/* Thumbnail - Increased size */}
      <div className="relative flex-shrink-0 w-full sm:w-[360px] aspect-video rounded-xl overflow-hidden">
        <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <span className="absolute bottom-1 right-1 bg-black bg-opacity-80 text-white text-xs px-1.5 py-0.5 rounded-md">
          {video.duration}
        </span>
      </div>

      {/* Video Details */}
      <div className="flex-1 py-1 min-w-0">
        <h3 className="text-black dark:text-white text-lg sm:text-xl font-normal leading-snug break-words line-clamp-2 mb-1">
          {video.title}
        </h3>
        <p className="text-yt-light-gray text-xs sm:text-sm mb-2">
            {[video.views?.includes('不明') ? null : video.views, video.uploadedAt].filter(Boolean).join(' \u2022 ')}
        </p>

        {/* Channel Info */}
        {video.channelId && (
            <div className="flex items-center mb-2">
                {video.channelAvatarUrl ? (
                    <img src={video.channelAvatarUrl} alt={video.channelName} className="w-6 h-6 rounded-full mr-2" />
                ) : (
                    <div className="w-6 h-6 rounded-full mr-2 bg-yt-gray"></div>
                )}
                <Link to={`/channel/${video.channelId}`} className="text-yt-light-gray text-sm hover:text-black dark:hover:text-white truncate" onClick={e => e.stopPropagation()}>
                    {video.channelName}
                </Link>
            </div>
        )}

        {/* Description Snippet */}
        {video.descriptionSnippet && (
            <p className="text-yt-light-gray text-xs sm:text-sm line-clamp-2 hidden sm:block">
                {video.descriptionSnippet}
            </p>
        )}
      </div>
    </Link>
  );
};

export default SearchVideoResultCard;