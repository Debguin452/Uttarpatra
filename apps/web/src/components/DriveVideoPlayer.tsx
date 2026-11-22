import { driveEmbedUrl } from "../lib/drive";

// Google Drive's preview iframe has no JS API like YouTube's (no postMessage
// progress events, no seek-to-start param), so unlike YouTubePlayer this
// can't report position/duration or resume where the student left off —
// they use the existing "mark complete" button instead.
export function DriveVideoPlayer({ fileId, title }: { fileId: string; title: string }) {
  return (
    <div class="player">
      <iframe title={title} src={driveEmbedUrl(fileId)} allow="autoplay" allowFullScreen />
    </div>
  );
}
