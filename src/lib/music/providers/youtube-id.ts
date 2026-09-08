export const YOUTUBE_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

export function isYouTubeVideoId(value: string) {
  return YOUTUBE_VIDEO_ID.test(value);
}

export function youtubeWatchUrl(videoId: string) {
  if (!isYouTubeVideoId(videoId)) {
    throw new Error("invalid_youtube_id");
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeEmbedUrl(videoId: string, origin?: string) {
  if (!isYouTubeVideoId(videoId)) {
    throw new Error("invalid_youtube_id");
  }
  const url = new URL(`https://www.youtube.com/embed/${videoId}`);
  url.searchParams.set("enablejsapi", "1");
  url.searchParams.set("playsinline", "1");
  url.searchParams.set("rel", "0");
  url.searchParams.set("modestbranding", "1");
  url.searchParams.set("controls", "0");
  url.searchParams.set("fs", "0");
  if (origin) url.searchParams.set("origin", origin);
  return url.toString();
}
