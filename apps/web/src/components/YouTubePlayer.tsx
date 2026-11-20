import { useEffect, useRef, useState } from "preact/hooks";

type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
};
type YTApi = {
  Player: new (el: HTMLElement, options: unknown) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
};
declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<YTApi> | null = null;

function loadYouTubeApi(): Promise<YTApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiReady ??= new Promise<YTApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => reject(new Error("youtube_api_unavailable"));
    document.head.appendChild(script);
    setTimeout(() => reject(new Error("youtube_api_timeout")), 8000);
  }).catch((error) => {
    apiReady = null;
    throw error;
  });
  return apiReady;
}

export type PlayerEvent = { position: number; duration: number; ended: boolean; force: boolean };

// Plays a lecture from where the student stopped and reports progress: every
// five seconds while playing, and straight away on pause, end, or leaving.
// If YouTube's player script cannot load, a plain embed is used instead and
// progress is simply not tracked (the student can still mark it complete).
export function YouTubePlayer({
  videoId,
  title,
  startSec,
  onEvent,
}: {
  videoId: string;
  title: string;
  startSec: number;
  onEvent: (event: PlayerEvent) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let player: YTPlayer | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let alive = true;

    const report = (ended: boolean, force: boolean) => {
      if (!player) return;
      try {
        handler.current({ position: player.getCurrentTime(), duration: player.getDuration(), ended, force });
      } catch {
        /* player is gone */
      }
    };

    loadYouTubeApi()
      .then((YT) => {
        if (!alive || !host.current) return;
        const mount = document.createElement("div");
        host.current.appendChild(mount);
        player = new YT.Player(mount, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, start: Math.floor(startSec) },
          events: {
            onStateChange: (e: { data: number }) => {
              if (e.data === YT.PlayerState.PLAYING) {
                clearInterval(timer);
                timer = setInterval(() => report(false, false), 5000);
              } else {
                clearInterval(timer);
                if (e.data === YT.PlayerState.PAUSED) report(false, true);
                if (e.data === YT.PlayerState.ENDED) report(true, true);
              }
            },
          },
        });
      })
      .catch(() => alive && setFallback(true));

    return () => {
      alive = false;
      clearInterval(timer);
      report(false, true);
      try {
        player?.destroy();
      } catch {
        /* already torn down */
      }
    };
  }, [videoId]);

  if (fallback) {
    return (
      <div class="player">
        <iframe
          title={title}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&start=${Math.floor(startSec)}`}
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return <div class="player" ref={host} aria-label={title} />;
}
