
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import VideoGrid from '../components/VideoGrid';
import ShortsShelf from '../components/ShortsShelf';
import { getRecommendedVideos } from '../utils/api';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSearchHistory } from '../contexts/SearchHistoryContext';
import { useHistory } from '../contexts/HistoryContext';
import { usePreference } from '../contexts/PreferenceContext';
import { getDeeplyAnalyzedRecommendations } from '../utils/recommendation';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import type { Video } from '../types';
import { SearchIcon, SaveIcon, DownloadIcon } from '../components/icons/Icons';
import { v4 as uuidv4 } from 'uuid';

// Helper to parse duration string to seconds
const parseDuration = (iso: string, text: string): number => {
    if (iso) {
        const matches = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (matches) {
            const h = parseInt(matches[1] || '0', 10);
            const m = parseInt(matches[2] || '0', 10);
            const s = parseInt(matches[3] || '0', 10);
            return h * 3600 + m * 60 + s;
        }
    }
    if (text) {
         const parts = text.split(':').map(p => parseInt(p, 10));
         if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
         if (parts.length === 2) return parts[0] * 60 + parts[1];
         if (parts.length === 1) return parts[0];
    }
    return 0;
}

interface HomeSection {
    id: string;
    type: 'grid' | 'shorts';
    items: Video[];
}

const HomePage: React.FC = () => {
    const [sections, setSections] = useState<HomeSection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    const { subscribedChannels } = useSubscription();
    const { searchHistory } = useSearchHistory();
    const { history: watchHistory } = useHistory();
    const { preferredGenres, preferredChannels, exportUserData, importUserData } = usePreference();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ユーザーが「新規（データなし）」かどうかを判定
    const isNewUser = useMemo(() => {
        const hasSubscriptions = subscribedChannels.length > 1;
        const hasSearchHistory = searchHistory.length > 0;
        const hasWatchHistory = watchHistory.length > 0;
        const hasPreferences = preferredGenres.length > 0 || preferredChannels.length > 0;

        return !(hasSubscriptions || hasSearchHistory || hasWatchHistory || hasPreferences);
    }, [subscribedChannels, searchHistory, watchHistory, preferredGenres, preferredChannels]);

    const loadRecommendations = useCallback(async (pageNum: number) => {
        const isInitial = pageNum === 1;
        if (isInitial) {
            setIsLoading(true);
        } else {
            setIsFetchingMore(true);
        }
        
        try {
            let fetchedVideos: Video[] = [];

            // 深い分析に基づくレコメンデーションを取得
            const analyzedVideos = await getDeeplyAnalyzedRecommendations({
                searchHistory,
                watchHistory,
                subscribedChannels,
                preferredGenres,
                preferredChannels,
                page: pageNum
            });

            fetchedVideos = [...analyzedVideos];

            // フォールバック: 分析結果が少ない場合のみ急上昇を取得（初回のみ）
            if (fetchedVideos.length < 10 && isInitial) {
                try {
                    const { videos: trendingVideos } = await getRecommendedVideos();
                    fetchedVideos = [...fetchedVideos, ...trendingVideos];
                } catch (trendingError) {
                    console.warn("Failed to load trending videos", trendingError);
                }
            }
            
            // Separate Shorts (<= 60s) vs Regular Videos for this batch
            const nextVideos: Video[] = [];
            const nextShorts: Video[] = [];

            fetchedVideos.forEach(v => {
                const seconds = parseDuration(v.isoDuration, v.duration);
                if (seconds > 0 && seconds <= 60) {
                    nextShorts.push(v);
                } else {
                    nextVideos.push(v);
                }
            });

            setSections(prev => {
                const currentSections = isInitial ? [] : prev;
                
                // 重複排除用のIDセット作成
                const existingIds = new Set<string>();
                currentSections.forEach(s => s.items.forEach(v => existingIds.add(v.id)));

                // このバッチ内の新しい動画のみ抽出
                const uniqueNewShorts = nextShorts.filter(v => !existingIds.has(v.id));
                const uniqueNewVideos = nextVideos.filter(v => !existingIds.has(v.id));

                const newSections: HomeSection[] = [];

                // Shortsがあればセクション追加
                if (uniqueNewShorts.length > 0) {
                    newSections.push({
                        id: uuidv4(),
                        type: 'shorts',
                        items: uniqueNewShorts
                    });
                }

                // 通常動画があればセクション追加
                if (uniqueNewVideos.length > 0) {
                    newSections.push({
                        id: uuidv4(),
                        type: 'grid',
                        items: uniqueNewVideos
                    });
                }

                return [...currentSections, ...newSections];
            });

        } catch (err: any) {
            if (isInitial) {
                setError(err.message || '動画の読み込みに失敗しました。');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [subscribedChannels, searchHistory, watchHistory, preferredGenres, preferredChannels]);

    useEffect(() => {
        setPage(1);
        setSections([]);
        setError(null);
        
        if (isNewUser) {
            setIsLoading(false);
        } else {
            loadRecommendations(1);
        }
    }, [isNewUser, preferredGenres, preferredChannels, loadRecommendations]);

    const loadMore = () => {
        if (!isFetchingMore && !isLoading && !isNewUser) {
            const nextPage = page + 1;
            setPage(nextPage);
            loadRecommendations(nextPage);
        }
    };

    const lastElementRef = useInfiniteScroll(loadMore, true, isFetchingMore || isLoading);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await importUserData(file);
        }
    };

    // 新規ユーザー、または動画がない場合のガイド表示
    if ((isNewUser || (sections.length === 0 && !isLoading))) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in">
                <div className="bg-yt-light dark:bg-yt-spec-10 p-6 rounded-full mb-6">
                    <SearchIcon />
                </div>
                <h2 className="text-2xl font-bold mb-4 text-black dark:text-white">まずは動画を探してみましょう</h2>
                <p className="text-yt-light-gray text-base max-w-lg mb-8 leading-relaxed">
                    検索してチャンネル登録したり、動画を閲覧すると、<br />
                    ここにあなたへのおすすめ動画が表示されるようになります。<br />
                    <br />
                    上の検索バーから、好きなキーワードで検索してみてください！
                </p>

                <div className="flex gap-4">
                    <button 
                        onClick={exportUserData}
                        className="flex items-center gap-2 px-4 py-2 bg-yt-light dark:bg-yt-spec-10 rounded-lg hover:bg-gray-200 dark:hover:bg-yt-spec-20 transition-colors text-sm font-medium"
                    >
                        <DownloadIcon />
                        設定をエクスポート
                    </button>
                    <button 
                        onClick={handleImportClick}
                        className="flex items-center gap-2 px-4 py-2 bg-yt-light dark:bg-yt-spec-10 rounded-lg hover:bg-gray-200 dark:hover:bg-yt-spec-20 transition-colors text-sm font-medium"
                    >
                        <SaveIcon />
                        データを復元 (インポート)
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".json" 
                        onChange={handleFileChange} 
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {error && <div className="text-red-500 text-center mb-4">{error}</div>}
            
            {sections.map((section, index) => (
                <div key={section.id}>
                    {section.type === 'shorts' ? (
                         <div className="mb-2">
                            {/* 2つ目以降のセクションなら区切り線を入れる */}
                            {index > 0 && <hr className="border-yt-spec-light-20 dark:border-yt-spec-20 mb-6" />}
                            <ShortsShelf shorts={section.items} isLoading={false} />
                            <hr className="border-yt-spec-light-20 dark:border-yt-spec-20 mt-6" />
                        </div>
                    ) : (
                        <VideoGrid videos={section.items} isLoading={false} />
                    )}
                </div>
            ))}
            
            {isLoading && sections.length === 0 && (
                 <VideoGrid videos={[]} isLoading={true} />
            )}

            {!isLoading && sections.length > 0 && (
                <div ref={lastElementRef} className="h-20 flex justify-center items-center">
                    {isFetchingMore && <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yt-blue"></div>}
                </div>
            )}
        </div>
    );
};

export default HomePage;
