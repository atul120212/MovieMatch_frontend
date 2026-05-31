"use client";

import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Send, Smile, Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, AlertCircle, Copy, Share2, Check } from "lucide-react";
import WebRTCPeerGrid from "./WebRTCPeerGrid";
import VideoLoader from "./VideoLoader";

interface Participant {
  id: string;
  name: string;
  genres?: string[];
  notified?: boolean;
}

interface WatchRoomViewProps {
  roomCode: string;
  userId: string;
  userName: string;
  isHost: boolean;
  participants: Participant[];
  ws: WebSocket | null;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
}

export default function WatchRoomView({
  roomCode,
  userId,
  userName,
  isHost,
  participants,
  ws,
}: WatchRoomViewProps) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  // Watch room states
  const [movieTitle, setMovieTitle] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [transcodeStatus, setTranscodeStatus] = useState("uploading");
  const [transcodeProgress, setTranscodeProgress] = useState(0);

  // Playback sync states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(!isHost);
  const [volume, setVolume] = useState(0.8);
  const [bufferState, setBufferState] = useState<string | null>(null);

  // Copy helper states
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Late joiner initial synchronization states
  const [initialPosition, setInitialPosition] = useState<number | null>(null);
  const [initialState, setInitialState] = useState<string | null>(null);
  const initialSyncRef = useRef(false);

  // Interactive states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const ignoreSyncEventsRef = useRef(false);

  // Fetch watch status on mount and poll if processing
  const fetchWatchStatus = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/rooms/${roomCode}/watch_status`);
      if (res.ok) {
        const data = await res.json();
        setMovieTitle(data.movie_title || "Group Watch Party");
        setStreamUrl(data.stream_url || "");
        setTranscodeStatus(data.transcode_status || "ready");
        setTranscodeProgress(data.transcode_progress ?? 100);
        
        if (data.position_ms !== undefined) {
          setInitialPosition(data.position_ms / 1000);
        }
        if (data.state) {
          setInitialState(data.state);
        }
      }
    } catch (err) {
      console.error("Failed to load watch room status:", err);
    }
  };

  useEffect(() => {
    fetchWatchStatus();
    // If transcoding, poll status every 3 seconds
    const interval = setInterval(() => {
      if (transcodeStatus === "processing" || transcodeStatus === "uploading") {
        fetchWatchStatus();
      }
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcodeStatus]);

  // Perform late joiner initial sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video || transcodeStatus !== "ready" || initialPosition === null || initialSyncRef.current) return;

    const performInitialSync = () => {
      console.log(`Performing initial watch room sync. Time: ${initialPosition}s, State: ${initialState}`);
      video.currentTime = initialPosition;
      if (initialState === "playing") {
        video.play().catch((err) => {
          console.log("Autoplay blocked on initial sync. User must interact to play sound.");
        });
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
      initialSyncRef.current = true;
    };

    if (video.readyState >= 1) {
      performInitialSync();
    } else {
      video.addEventListener("loadedmetadata", performInitialSync);
      return () => {
        video.removeEventListener("loadedmetadata", performInitialSync);
      };
    }
  }, [transcodeStatus, initialPosition, initialState]);

  // Video source loading (HLS or raw MP4)
  useEffect(() => {
    if (!videoRef.current || !streamUrl || transcodeStatus !== "ready") return;

    const video = videoRef.current;
    
    // Check if stream is HLS
    if (streamUrl.endsWith(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // Ready
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS (Safari/iOS)
        video.src = streamUrl;
      }
    } else {
      // Standard MP4 direct streaming
      video.src = streamUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, transcodeStatus]);

  // WebSocket message handlers for sync, chat, and reactions
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        const video = videoRef.current;

        switch (payload.event) {
          case "movie_status":
            if (payload.status === "ready") {
              setStreamUrl(payload.stream_url);
              setTranscodeStatus("ready");
            }
            setTranscodeProgress(payload.progress);
            break;

          case "video_play":
            setBufferState(null);
            if (video && !isHost) {
              ignoreSyncEventsRef.current = true;
              video.currentTime = payload.time;
              video.play().catch(() => {});
              setIsPlaying(true);
              setTimeout(() => { ignoreSyncEventsRef.current = false; }, 200);
            }
            break;

          case "video_pause":
            setBufferState(null);
            if (video && !isHost) {
              ignoreSyncEventsRef.current = true;
              video.currentTime = payload.time;
              video.pause();
              setIsPlaying(false);
              setTimeout(() => { ignoreSyncEventsRef.current = false; }, 200);
            }
            break;

          case "video_seek":
            setBufferState(null);
            if (video && !isHost) {
              ignoreSyncEventsRef.current = true;
              video.currentTime = payload.time;
              setTimeout(() => { ignoreSyncEventsRef.current = false; }, 200);
            }
            break;

          case "video_heartbeat":
            // Silent drift correction
            if (video && !isHost) {
              const diff = Math.abs(video.currentTime - payload.time);
              if (diff > 1.5) {
                console.log(`Playback drifted by ${diff.toFixed(2)}s. Re-syncing to host.`);
                ignoreSyncEventsRef.current = true;
                video.currentTime = payload.time;
                setTimeout(() => { ignoreSyncEventsRef.current = false; }, 200);
              }
            }
            break;

          case "video_waiting":
            setBufferState(payload.name);
            break;

          case "video_ready":
            setBufferState(null);
            break;

          case "chat_message":
            setChatMessages((prev) => [
              ...prev,
              {
                id: Math.random().toString(),
                sender: payload.sender_name,
                text: payload.text,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ]);
            break;

          case "emoji_reaction":
            // Trigger floating emoji animation
            const newEmoji: FloatingEmoji = {
              id: Math.random().toString(),
              emoji: payload.emoji,
              x: Math.random() * 80 + 10, // random left percentage
            };
            setFloatingEmojis((prev) => [...prev, newEmoji]);
            break;

          default:
            break;
        }
      } catch (err) {
        console.error("WS Watch Room Event parse error:", err);
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => {
      ws.removeEventListener("message", handleMessage);
    };
  }, [ws, isHost, isPlaying]);

  // Clean up floating emojis
  useEffect(() => {
    if (floatingEmojis.length === 0) return;
    const timer = setTimeout(() => {
      setFloatingEmojis((prev) => prev.slice(1));
    }, 3000);
    return () => clearTimeout(timer);
  }, [floatingEmojis]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Broadcast host commands
  const onPlay = () => {
    if (!isHost || !videoRef.current) return;
    setIsPlaying(true);
    videoRef.current.play().catch((err) => {
      console.error("Host failed to play video:", err);
    });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "video_play", time: videoRef.current.currentTime }));
    }
  };

  const onPause = () => {
    if (!isHost || !videoRef.current) return;
    setIsPlaying(false);
    videoRef.current.pause();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "video_pause", time: videoRef.current.currentTime }));
    }
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost || !videoRef.current) return;
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "video_seek", time }));
    }
  };

  // Host heartbeat synchronization
  useEffect(() => {
    if (!isHost || !isPlaying) return;
    const interval = setInterval(() => {
      if (videoRef.current && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            event: "video_heartbeat",
            time: videoRef.current.currentTime,
          })
        );
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isHost, isPlaying, ws]);

  // Player handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleWaiting = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "video_waiting", user_id: userId, name: userName }));
    }
  };

  const handlePlaying = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "video_ready", user_id: userId }));
    }
  };

  const handleJoinAudioAndSync = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
      if (isPlaying || initialState === "playing") {
        videoRef.current.play().catch((err) => {
          console.error("Autoplay failed after click:", err);
        });
      }
    }
  };

  // Mute toggle
  const toggleMute = () => {
    if (videoRef.current) {
      const next = !isMuted;
      videoRef.current.muted = next;
      setIsMuted(next);
    }
  };

  // Volume slider
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  // Format timestamp (hh:mm:ss)
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const mStr = m < 10 ? `0${m}` : m;
    const sStr = s < 10 ? `0${s}` : s;
    return h > 0 ? `${h}:${mStr}:${sStr}` : `${mStr}:${sStr}`;
  };

  // Fullscreen trigger
  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  // Chat message submission
  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        event: "chat_message",
        sender_id: userId,
        sender_name: userName,
        text: chatInput.trim(),
      })
    );
    setChatInput("");
  };

  // Broadcast emoji reactions
  const sendEmojiReaction = (emoji: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        event: "emoji_reaction",
        sender_id: userId,
        emoji,
      })
    );
  };

  // Rendering Loader screen for transcoding states
  if (transcodeStatus === "processing" || transcodeStatus === "uploading") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#050508] min-h-[500px]">
        <VideoLoader text={`Preparing Movie Stream... ${transcodeProgress}%`} />
        <p className="text-zinc-500 text-xs mt-3 max-w-sm text-center leading-relaxed">
          FFmpeg is transcoding segments and creating adaptive stream configurations. Viewers will connect automatically when ready.
        </p>
      </div>
    );
  }

  if (transcodeStatus === "error") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#050508] min-h-[500px] text-zinc-400 text-center gap-4">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <div>
          <h2 className="text-xl font-bold text-white">Streaming Error</h2>
          <p className="text-sm text-zinc-500 max-w-xs mt-1">
            An error occurred while uploading or segmenting the movie. Please try uploading another format.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-4 gap-6 items-start w-full">
      {/* ── Left Column: Video Player & Host Controls (75% width) ── */}
      <div className="lg:col-span-3 space-y-4">
        <div className="glass rounded-3xl overflow-hidden border border-zinc-800/80 bg-zinc-950 shadow-[0_12px_40px_rgba(0,0,0,0.7)] relative group">
          
          {/* Main Video element */}
          <video
            ref={videoRef}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onSeeked={handlePlaying}
            onCanPlay={handlePlaying}
            playsInline
            muted={isMuted}
            controls={false} // Disable native browser controls for all users; everyone uses the custom control bar
            className="w-full aspect-video bg-black block relative z-10"
            onClick={isHost ? (isPlaying ? onPause : onPlay) : undefined}
          />

          {/* Buffer stalling overlay (non-blocking top-right pill) */}
          {bufferState && (
            <div className="absolute top-4 right-4 z-20 pointer-events-none bg-black/80 backdrop-blur-sm border border-indigo-500/30 px-3.5 py-2 rounded-full flex items-center gap-2.5 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
              <div className="w-3.5 h-3.5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <span className="text-[10px] font-bold text-indigo-300 tracking-wider">
                {bufferState} is buffering...
              </span>
            </div>
          )}

          {/* Viewer Info overlay (if controls hidden) */}
          {!isHost && (
            <div className="absolute top-4 left-4 z-20 pointer-events-none">
              <span className="bg-black/60 backdrop-blur-sm border border-zinc-800 text-[10px] text-zinc-400 px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">
                Sync Room • Host Controls Playback
              </span>
            </div>
          )}

          {/* Autoplay mute warning overlay */}
          {!isHost && isMuted && (
            <button
              onClick={handleJoinAudioAndSync}
              className="absolute inset-0 bg-black/60 hover:bg-black/70 backdrop-blur-xs z-30 flex flex-col items-center justify-center gap-3 select-none cursor-pointer transition-all border-none outline-none"
            >
              <div className="w-16 h-16 rounded-full bg-indigo-500/25 border border-indigo-500/40 flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.55)] animate-pulse">
                <VolumeX className="w-8 h-8 text-indigo-200" />
              </div>
              <p className="text-sm font-bold text-white tracking-wider bg-indigo-500 hover:bg-indigo-600 px-4 py-2.5 rounded-full shadow-[0_4px_15px_rgba(99,102,241,0.4)] transition-all">
                Click to Join Audio & Sync
              </p>
            </button>
          )}

          {/* Floating Emoji animations viewport */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
            {floatingEmojis.map((e) => (
              <span
                key={e.id}
                style={{ left: `${e.x}%` }}
                className="absolute bottom-4 text-4xl select-none animate-float-emoji opacity-0"
              >
                {e.emoji}
              </span>
            ))}
          </div>
        </div>

        {/* Custom Controls Bar */}
        {videoRef.current && (
          <div className="glass rounded-2xl p-4 border border-zinc-800/80 flex flex-col gap-3 shadow-lg">
            {/* Timeline Seeker */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-zinc-500 select-none">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={isHost ? onSeek : undefined}
                disabled={!isHost}
                className={`flex-1 h-1 bg-zinc-800 accent-indigo-500 rounded-lg outline-none ${isHost ? "cursor-pointer" : "cursor-default opacity-80"}`}
              />
              <span className="text-[10px] font-bold text-zinc-500 select-none">
                {formatTime(duration)}
              </span>
            </div>

            {/* Audio & Status buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isHost && (
                  <button
                    onClick={isPlaying ? onPause : onPlay}
                    className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white flex items-center justify-center shadow-[0_4px_15px_rgba(99,102,241,0.3)] transition-all cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                  </button>
                )}

                <div className="flex items-center gap-2 bg-zinc-900/60 px-3 py-1.5 rounded-xl border border-zinc-800">
                  <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-zinc-800 accent-zinc-400 rounded-lg outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-500 font-bold bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full select-none">
                  {isHost ? "Host Console" : "Sync Lobby"}
                </span>
                <button
                  onClick={handleFullscreen}
                  className="p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer active:scale-95"
                >
                  <Maximize className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Movie Title Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-zinc-950/40 p-4 border border-zinc-900 rounded-2xl shadow-md">
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">{movieTitle}</h1>
            <p className="text-zinc-500 text-[10px] font-semibold mt-1 flex items-center gap-1.5 select-none">
              Sync watch session code: <span className="text-indigo-400 font-bold tracking-wider">{roomCode}</span>
            </p>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            {/* Copy Code */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(roomCode);
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2000);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copy Code</span>
                </>
              )}
            </button>

            {/* Copy Invite Link */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/room/${roomCode}`);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right Column: Camera Mesh Grid, Chat, Reactions (25% width) ── */}
      <div className="space-y-6">
        {/* Subsystem 3: Face Cameras Grid */}
        <div className="glass rounded-3xl p-5 border border-zinc-800/80 shadow-md">
          <WebRTCPeerGrid
            roomCode={roomCode}
            userId={userId}
            userName={userName}
            participants={participants}
            ws={ws}
          />
        </div>

        {/* Reactions floating panel */}
        <div className="glass rounded-2xl p-4 border border-zinc-800/80 shadow-md flex items-center justify-between gap-1 select-none">
          <Smile className="w-4 h-4 text-zinc-500 shrink-0" />
          <div className="flex justify-around items-center flex-1">
            {["😂", "😮", "❤️", "👏", "🔥", "😢"].map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendEmojiReaction(emoji)}
                className="text-2xl hover:scale-125 transition-transform duration-200 cursor-pointer active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Live Chat Panel */}
        <div className="glass rounded-3xl border border-zinc-800/80 shadow-md flex flex-col h-[320px] overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-zinc-800 bg-zinc-950/40">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Room Chat
            </h4>
          </div>

          {/* Message scroll container */}
          <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin">
            {chatMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-600 text-xs italic">
                Send a message to start chatting!
              </div>
            ) : (
              chatMessages.map((m) => (
                <div key={m.id} className="space-y-0.5">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="text-xs font-extrabold text-indigo-400">
                      {m.sender}
                    </span>
                    <span className="text-[8px] text-zinc-600 font-semibold select-none">
                      {m.time}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 break-words leading-relaxed">
                    {m.text}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Input form */}
          <form onSubmit={sendChatMessage} className="p-3 border-t border-zinc-800 bg-zinc-950/40 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Chat..."
              className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-indigo-500/50 text-white rounded-xl px-3.5 py-2 text-xs outline-none transition-colors"
            />
            <button
              type="submit"
              className="p-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white shadow-md cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
