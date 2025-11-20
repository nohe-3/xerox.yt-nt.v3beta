
import React, { useState, useEffect, useCallback } from 'react';
import VideoGrid from '../components/VideoGrid';
import { searchVideos, getChannelVideos, getRecommendedVideos } from '../utils/api';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSearchHistory } from '../contexts/SearchHistoryContext';
import { useHistory } from '../contexts/HistoryContext';
import type { Video } from '../types';

const HomePage: React.FC = () => {
    const [recommendedVideos, setRecommendedVideos] = useState<Video[]>([]);
    const [isLoadingRecommended, setIsLoadingRecommended] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { subscribedChannels } = useSubscription();
    const { searchHistory } = useSearchHistory();
    const { history: watchHistory } = useHistory();

    const parseISODuration = (isoDuration: string): number => {
        if (!isoDuration) return 0;
        // This regex handles PT#H#M#S format
        const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
        const matches = isoDuration.match(regex);
        if (!matches) return 0;
        const hours = parseInt(matches[1] || '0', 10);
        const minutes = parseInt(matches[2] || '0', 10);
        const seconds = parseInt(matches[3] || '0', 10);
        return hours * 3600 + minutes * 60 + seconds;
    };

    const shuffleArray = <T,>(array: T[]): T[] => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    };

    const loadRecommended = useCallback(async () => {
        setIsLoadingRecommended(true);
        try {
            // 1. Intent-based: Videos based on recent search terms (Limit 3 terms)
            const searchPromises = searchHistory.slice(0, 3).map(term => 
                searchVideos(term).then(res => res.videos.slice(0, 5))
            );

            // 2. Personalized: Videos from subscribed channels (Limit 5 channels)
            // Explicitly populate channel info since API might miss it in partial feeds
            const shuffledSubs = shuffleArray(subscribedChannels);
            const channelPromises = shuffledSubs.slice(0, 5).map(channel => 
                getChannelVideos(channel.id).then(res => 
                    res.videos.slice(0, 5).map(video => ({
                        ...video,
                        channelName: channel.name,
                        channelAvatarUrl: channel.avatarUrl,
                        channelId: channel.id
                    }))
                )
            );
            
            // 3. Contextual: Videos related to recently watched videos (Limit 3)
            // We use the title of the last few watched videos to find similar content
            const historyPromises = watchHistory.slice(0, 3).map(video => 
                 searchVideos(video.title.replace(/[^a-zA-Z0-9\s\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g, '')).then(res => res.videos.slice(0, 5))
            );

            // 4. Discovery: Trending/Popular videos (Baseline)
            const trendingPromise = getRecommendedVideos();

            // Execute all requests in parallel
            const results = await Promise.allSettled([
                trendingPromise,
                ...searchPromises,
                ...channelPromises,
                ...historyPromises
            ]);
            
            // Flatten results
            let combinedVideos: Video[] = [];
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    if (Array.isArray(result.value)) {
                        combinedVideos.push(...result.value); // From search/history promises
                    } else if (result.value && Array.isArray((result.value as any).videos)) {
                        combinedVideos.push(...(result.value as any).videos); // From trendingPromise
                    }
                }
            });

            // Fallback if algo didn't return enough
            if (combinedVideos.length < 10) {
                const { videos: trendingVideos } = await getRecommendedVideos();
                combinedVideos = [...combinedVideos, ...trendingVideos];
            }
            
            // Deduplicate by ID
            const uniqueVideos = Array.from(new Map(combinedVideos.map(v => [v.id, v])).values());
            
            // Filter out very short clips if they aren't explicit shorts (heuristic > 60s)
            const regularVideos = uniqueVideos.filter(v => {
                 const duration = parseISODuration(v.isoDuration);
                 return duration === 0 || duration > 60; // Keep if unknown duration or > 60s
            });

            setRecommendedVideos(shuffleArray(regularVideos));
        } catch (err: any) {
            setError(err.message || '動画の読み込みに失敗しました。');
            console.error(err);
        } finally {
            setIsLoadingRecommended(false);
        }
    }, [subscribedChannels, searchHistory, watchHistory]);


    useEffect(() => {
        setError(null);
        loadRecommended();
    }, [loadRecommended]);
    

    if (error) {
        return <div className="text-center text-red-500 bg-red-100 dark:bg-red-900/50 p-4 rounded-lg">{error}</div>;
    }

    return (
        <div className="space-y-8">
            <VideoGrid videos={recommendedVideos} isLoading={isLoadingRecommended} />
        </div>
    );
};

export default HomePage;
