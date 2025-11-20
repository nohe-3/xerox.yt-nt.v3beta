import React from 'react';
import { Link } from 'react-router-dom';
import type { ApiPlaylist } from '../types';
import { PlaylistIcon } from './icons/Icons';

interface SearchPlaylistResultCardProps {
  playlist: ApiPlaylist;
}

const SearchPlaylistResultCard: React.FC<SearchPlaylistResultCardProps> = ({ playlist }) => {
  return (
    <Link to={`/playlist/${playlist.id}`} className="flex flex-col sm:flex-row gap-4 group mb-4">
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-full sm:w-[360px] aspect-video rounded-xl overflow-hidden bg-yt-dark-gray">
        {playlist.thumbnailUrl ? (
            <img src={playlist.thumbnailUrl} alt={playlist.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
            <div className="w-full h-full flex items-center justify-center">
                <PlaylistIcon className="w-12 h-12 text-yt-light-gray" />
            </div>
        )}
        <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
             <span className="text-white font-semibold">すべて再生</span>
        </div>
        <div className="absolute bottom-0 right-0 bg-black/80 text-white px-2 py-1 text-xs font-semibold flex items-center rounded-tl-md">
            <PlaylistIcon className="w-4 h-4 mr-1" />
            <span>{playlist.videoCount}</span>
        </div>
      </div>

      {/* Playlist Details */}
      <div className="flex-1 py-1 min-w-0">
        <h3 className="text-black dark:text-white text-lg sm:text-xl font-normal leading-snug break-words line-clamp-2 mb-1">
          {playlist.title}
        </h3>
        <p className="text-yt-light-gray text-xs sm:text-sm mb-2">
            {playlist.author} • プレイリスト
        </p>
        <p className="text-yt-light-gray text-xs sm:text-sm">
            動画 {playlist.videoCount} 本を表示
        </p>
      </div>
    </Link>
  );
};

export default SearchPlaylistResultCard;