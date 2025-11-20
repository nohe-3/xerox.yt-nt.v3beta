import React, { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import SearchResultsPage from './pages/SearchResultsPage';
import ChannelPage from './pages/ChannelPage';
import YouPage from './pages/YouPage';
import PlaylistPage from './pages/PlaylistPage';
import ShortsPage from './pages/ShortsPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import HistoryPage from './pages/HistoryPage';
import VideoPlayerPage from './pages/VideoPlayerPage';
import { useTheme } from './hooks/useTheme';

const App: React.FC = () => {
  const [theme, toggleTheme] = useTheme();
  const location = useLocation();
  const isPlayerPage = location.pathname.startsWith('/watch');
  const isShortsPage = location.pathname === '/shorts';

  // 初期状態：プレイヤーページなら閉じる、それ以外は開く
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(!isPlayerPage);

  // ページ遷移時にプレイヤーページならサイドバーを閉じる
  useEffect(() => {
    if (isPlayerPage) {
        setIsSidebarOpen(false);
    } else if (!isShortsPage) {
        // ホーム等に戻った時はデフォルトで開く（好みに応じて変更可）
        setIsSidebarOpen(true);
    }
  }, [location.pathname, isPlayerPage, isShortsPage]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const getMargin = () => {
    if (isShortsPage) return ''; // ショートは全画面
    
    // プレイヤーページでもサイドバーが開いているときはマージンを取る（右に寄せる/リサイズ）
    if (isSidebarOpen) return 'ml-56'; 
    
    // プレイヤーページで閉じているときはマージンなし（またはミニサイドバーがないので0）
    if (isPlayerPage && !isSidebarOpen) return ''; 

    // 通常ページで閉じているときはミニサイドバー分
    return 'ml-[72px]';
  };

  const mainContentMargin = getMargin();
  // プレイヤーページのパディング調整
  const mainContentPadding = isShortsPage ? '' : isPlayerPage ? 'p-6' : 'p-6';
  
  // プレイヤーページでサイドバーが開いているときは、通常のサイドバーを表示
  // 閉じているときは何も表示しない（オーバーレイではなく、完全に隠す仕様にするため）
  // 通常ページでは常に表示（Sidebarコンポーネント内でミニ/フルを切り替え）
  const shouldShowSidebar = () => {
    if (isShortsPage) return false;
    // プレイヤーページの場合、開いている時だけ表示（SidebarコンポーネントはfixedなのでApp側で制御が必要）
    // ただしSidebarコンポーネント自体が固定配置なので、条件分岐はSidebarに渡すisOpenだけで制御できるが、
    // 閉じた時のミニバー表示を消したい場合は条件が必要
    if (isPlayerPage && !isSidebarOpen) return false; 
    return true;
  };

  return (
    <div className="min-h-screen bg-yt-white dark:bg-yt-black">
      <Header 
        toggleSidebar={toggleSidebar} 
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <div className="flex">
        {shouldShowSidebar() && <Sidebar isOpen={isSidebarOpen} />}
        <main className={`flex-1 mt-14 ${mainContentMargin} ${mainContentPadding} transition-all duration-300 ease-in-out`}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/watch/:videoId" element={<VideoPlayerPage />} />
            <Route path="/results" element={<SearchResultsPage />} />
            <Route path="/channel/:channelId" element={<ChannelPage />} />
            <Route path="/you" element={<YouPage />} />
            <Route path="/playlist/:playlistId" element={<PlaylistPage />} />
            <Route path="/shorts" element={<ShortsPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            {/* Redirect any other path to home */}
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default App;