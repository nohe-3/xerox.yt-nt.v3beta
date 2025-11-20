import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchVideos } from '../utils/api';
import type { Video, Channel, ApiPlaylist } from '../types';
import SearchVideoResultCard from '../components/SearchVideoResultCard';
import SearchChannelResultCard from '../components/SearchChannelResultCard';
import SearchPlaylistResultCard from '../components/SearchPlaylistResultCard';
import ShortsShelf from '../components/ShortsShelf';

const SearchResultsPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('search_query');
    
    const [videos, setVideos] = useState<Video[]>([]);
    const [shorts, setShorts] = useState<Video[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
    
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery) return;
        
        setError(null);
        setIsLoading(true);
        
        try {
            const results = await searchVideos(searchQuery);
            setVideos(results.videos);
            setShorts(results.shorts);
            setChannels(results.channels);
            setPlaylists(results.playlists);
        } catch (err: any) {
            setError(err.message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        setVideos([]);
        setShorts([]);
        setChannels([]);
        setPlaylists([]);
        if (query) {
            performSearch(query);
        } else {
            setIsLoading(false);
        }
    }, [query, performSearch]);

    if (isLoading) {
        return (
             <div className="flex flex-col space-y-6 max-w-6xl mx-auto p-4">
                {/* Skeleton */}
                {Array.from({ length: 5 }).map((_, index) => (
                   <div key={index} className="flex flex-col sm:flex-row gap-4 animate-pulse">
                        <div className="w-full sm:w-[360px] aspect-video bg-yt-light dark:bg-yt-dark-gray rounded-xl"></div>
                        <div className="flex-1 space-y-3 py-2">
                            <div className="h-5 bg-yt-light dark:bg-yt-dark-gray rounded w-3/4"></div>
                            <div className="h-4 bg-yt-light dark:bg-yt-dark-gray rounded w-1/3"></div>
                            <div className="h-8 w-8 rounded-full bg-yt-light dark:bg-yt-dark-gray"></div>
                        </div>
                   </div>
                ))}
            </div>
        );
    }
    
    if (error) {
        return <div className="text-center text-red-500 bg-red-100 dark:bg-red-900/50 p-4 rounded-lg">{error}</div>;
    }

    if (videos.length === 0 && channels.length === 0 && playlists.length === 0 && shorts.length === 0 && query) {
        return <div className="text-center mt-10">「{query}」の検索結果はありません。</div>
    }

    return (
        <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4">
            {/* Channels Section */}
            {channels.length > 0 && (
                <div className="mb-6 space-y-4">
                    {channels.map(channel => (
                        <SearchChannelResultCard key={channel.id} channel={channel} />
                    ))}
                </div>
            )}

            {/* Shorts Section */}
            {shorts.length > 0 && (
                <div className="mb-8 border-b border-yt-spec-light-20 dark:border-yt-spec-20 pb-8">
                    <ShortsShelf shorts={shorts} isLoading={false} />
                </div>
            )}
            
            {/* Playlists Section */}
            {playlists.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-xl font-bold mb-4">プレイリスト</h2>
                    <div className="space-y-4">
                        {playlists.map(playlist => (
                            <SearchPlaylistResultCard key={playlist.id} playlist={playlist} />
                        ))}
                    </div>
                     <hr className="my-6 border-yt-spec-light-20 dark:border-yt-spec-20" />
                </div>
            )}

            {/* Videos Section */}
            <div className="flex flex-col space-y-2">
                <h2 className="text-xl font-bold mb-2">動画</h2>
                {videos.map((video, index) => (
                    <SearchVideoResultCard key={`${video.id}-${index}`} video={video} />
                ))}
            </div>
        </div>
    );
};

export default SearchResultsPage;