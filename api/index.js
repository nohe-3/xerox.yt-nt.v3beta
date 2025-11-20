import express from "express";
import { Innertube } from "youtubei.js";

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// 動画詳細 API (/api/video)
app.get('/api/video', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing video id" });

    const info = await youtube.getInfo(id);

    // ★★★ Next.jsの例を参考に、関連動画を深掘りして最大100件取得するロジックに修正 ★★★

    // 関連動画取得（100件まで、深掘り）
    let relatedVideos = [];
    const MAX_VIDEOS = 100;

    // 1. 初期の関連動画ソースを特定（複数のプロパティから優先順位に従って探す）
    let initialRelated = info.related || [];
    if (!initialRelated.length && Array.isArray(info.related_videos)) {
      initialRelated = info.related_videos;
    } else if (!initialRelated.length && Array.isArray(info.watch_next_feed)) {
      initialRelated = info.watch_next_feed;
    } else if (!initialRelated.length && Array.isArray(info.secondary_info?.watch_next_feed)) {
      initialRelated = info.secondary_info.watch_next_feed;
    }
    
    // 追加: player_overlays内のエンドスクリーンから関連動画を取得 (Login Required時などの対策)
    if (!initialRelated.length && info.player_overlays?.end_screen?.results) {
      initialRelated = info.player_overlays.end_screen.results;
    }
    
    // 2. キューと処理済みIDセットの準備
    const queue = [...initialRelated]; 
    const seen = new Set();
    
    // 3. キューベースの深掘り処理
    while (queue.length > 0 && relatedVideos.length < MAX_VIDEOS) {
      const video = queue.shift();
      
      // 動画アイテムとしての最小限の検証（IDが11桁の文字列であること）と重複チェック
      // エンドスクリーンのプレイリスト等は除外される
      if (!video || typeof video.id !== 'string' || video.id.length !== 11 || seen.has(video.id)) {
        continue;
      }
      seen.add(video.id);

      // 元の動画オブジェクトを追加
      relatedVideos.push(video);

      // youtubei.js でさらに関連動画が提供されていれば、それをキューに追加して深掘り
      if (Array.isArray(video.related) && video.related.length > 0) {
        queue.push(...video.related);
      }
    }

    // 4. `info`オブジェクトの関連動画部分を、深掘りして集めたリストで置き換える
    //    元のコードの慣習に従い、watch_next_feed に格納します。
    info.watch_next_feed = relatedVideos.slice(0, MAX_VIDEOS);
    
    // (念のため、他の可能性のあったプロパティをクリアし、データの重複を防ぎます)
    if (info.related_videos) info.related_videos = [];
    if (info.secondary_info?.watch_next_feed) info.secondary_info.watch_next_feed = [];
    if (info.related) info.related = []; // info.related もクリアしておくと安全

    res.status(200).json(info);
    
  } catch (err) {
    console.error('Error in /api/video:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------
// 以下のAPIエンドポイントは、前回のコードから一切変更ありません。
// -------------------------------------------------------------------
app.get('/api/search', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { q: query, limit = '50' } = req.query;
    if (!query) return res.status(400).json({ error: "Missing search query" });
    const limitNumber = parseInt(limit);
    let search = await youtube.search(query, { type: "video" });
    let videos = search.videos || [];
    while (videos.length < limitNumber && search.has_continuation) {
        search = await search.getContinuation();
        videos = videos.concat(search.videos);
    }
    res.status(200).json(videos.slice(0, limitNumber));
  } catch (err) { console.error('Error in /api/search:', err); res.status(500).json({ error: err.message }); }
});
app.get('/api/comments', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing video id" });
    const limit = 300;
    let commentsSection = await youtube.getComments(id);
    let allComments = commentsSection.contents || [];
    while (allComments.length < limit && commentsSection.has_continuation) {
      commentsSection = await commentsSection.getContinuation();
      allComments = allComments.concat(commentsSection.contents);
    }
    res.status(200).json({
      comments: allComments.slice(0, limit).map(c => ({
        text: c.comment?.content?.text ?? null, comment_id: c.comment?.comment_id ?? null, published_time: c.comment?.published_time ?? null,
        author: { id: c.comment?.author?.id ?? null, name: c.comment?.author?.name ?? null, thumbnails: c.comment?.author?.thumbnails ?? [] },
        like_count: c.comment?.like_count?.toString() ?? '0', reply_count: c.comment?.reply_count?.toString() ?? '0', is_pinned: c.comment?.is_pinned ?? false
      }))
    });
  } catch (err) { console.error('Error in /api/comments:', err); res.status(500).json({ error: err.message }); }
});
app.get('/api/channel', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { id, page = '1' } = req.query;
    if (!id) return res.status(400).json({ error: "Missing channel id" });
    const channel = await youtube.getChannel(id);
    let videosFeed = await channel.getVideos();
    for (let i = 1; i < parseInt(page); i++) {
      if (videosFeed.has_continuation) {
        videosFeed = await videosFeed.getContinuation();
      } else {
        videosFeed.videos = [];
        break;
      }
    }
    res.status(200).json({
      channel: {
        id: channel.id, name: channel.metadata?.title || null, description: channel.metadata?.description || null,
        avatar: channel.metadata?.avatar || null, banner: channel.metadata?.banner || null,
        subscriberCount: channel.metadata?.subscriber_count?.pretty || '非公開', videoCount: channel.metadata?.videos_count?.text ?? channel.metadata?.videos_count ?? '0'
      },
      page: parseInt(page), videos: videosFeed.videos || []
    });
  } catch (err) { console.error('Error in /api/channel:', err); res.status(500).json({ error: err.message }); }
});
app.get('/api/channel-shorts', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing channel id" });
    const channel = await youtube.getChannel(id);
    const shorts = await channel.getShorts();
    res.status(200).json(shorts.videos);
  } catch (err) { console.error('Error in /api/channel-shorts:', err); res.status(500).json({ error: err.message }); }
});
app.get('/api/channel-playlists', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing channel id" });
    const channel = await youtube.getChannel(id);
    const playlists = await channel.getPlaylists();
    res.status(200).json(playlists);
  } catch (err) { console.error('Error in /api/channel-playlists:', err); res.status(500).json({ error: err.message }); }
});
app.get('/api/playlist', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { id: playlistId } = req.query;
    if (!playlistId) return res.status(400).json({ error: "Missing playlist id" });
    const playlist = await youtube.getPlaylist(playlistId);
    if (!playlist.info?.id) return res.status(404).json({ error: "Playlist not found"});
    res.status(200).json(playlist);
  } catch (err) { console.error('Error in /api/playlist:', err); res.status(500).json({ error: err.message }); }
});
app.get('/api/fvideo', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const trending = await youtube.getTrending("Music");
    res.status(200).json(trending);
  } catch (err) { console.error('Error in /api/fvideo:', err); res.status(500).json({ error: err.message }); }
});

export default app;