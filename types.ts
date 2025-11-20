export interface Video {
  id: string;
  thumbnailUrl: string;
  duration: string;
  isoDuration: string;
  title: string;
  channelName: string;
  channelId: string;
  channelAvatarUrl: string;
  views: string;
  uploadedAt: string;
  descriptionSnippet?: string;
}

export interface ChannelBadge {
    type: string;
    tooltip: string;
}

export interface Channel {
  id: string;
  name: string;
  avatarUrl: string;
  subscriberCount: string;
  badges?: ChannelBadge[];
}

export interface VideoDetails extends Video {
  description: string;
  likes: string;
  dislikes: string;
  channel: Channel;
  relatedVideos: Video[];
}

export interface ChannelDetails {
  id:string;
  name: string;
  avatarUrl?: string;
  subscriberCount: string;
  bannerUrl?: string;
  description: string;
  videoCount: number;
  handle?: string;
}

export interface ApiPlaylist {
  id: string;
  title: string;
  thumbnailUrl?: string;
  videoCount: number;
  author?: string;
  authorId?: string;
}

export interface PlaylistDetails {
  title: string;
  author: string;
  authorId: string;
  description: string;
  videos: Video[];
}

export interface Playlist {
  id: string;
  name: string;
  videoIds: string[];
  createdAt: string;
  authorName?: string;
  authorId?: string;
}

export interface Notification {
  id: string;
  channel: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  video: {
    id: string;
    title: string;
    thumbnailUrl: string;
    uploadedAt: string;
  };
  publishedAt: string;
}

export interface CommentAuthor {
  id: string;
  name: string;
  thumbnails: { url: string }[];
}

export interface Comment {
  comment_id: string;
  text: string;
  published_time: string;
  author: CommentAuthor;
  like_count: string;
  reply_count: string;
  is_pinned: boolean;
}

export interface SearchResults {
    videos: Video[];
    shorts: Video[];
    channels: Channel[];
    playlists: ApiPlaylist[];
    nextPageToken?: string;
}