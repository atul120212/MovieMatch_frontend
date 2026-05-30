"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Film,
  Heart,
  HelpCircle,
  Sparkles,
  Star,
  X,
} from "lucide-react";

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface MovieCard {
  tmdb_id: string;
  position: number;
  title: string;
  overview: string | null;
  poster_path: string | null;
  genres: string | null;
  rating: number | null;
  runtime: number | null;
  streaming_info: string | null;
}

interface Member {
  id: string;
  name: string;
}

interface ProgressEntry {
  name: string;
  voted: number;
  total: number;
}

interface SwipeDeckProps {
  movies: MovieCard[];
  /** choice: true = yes/like, false = no/dislike */
  onVote: (tmdbId: string, choice: boolean) => void;
  participantName: string;
  progressUpdates: Record<string, ProgressEntry>;
  participants: Member[];
  isHost: boolean;
  onForceReveal: () => void;
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function SwipeDeck({
  movies,
  onVote,
  participantName,
  progressUpdates,
  participants,
  isHost,
  onForceReveal,
}: SwipeDeckProps) {
  const [index, setIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const [swiping, setSwiping] = useState(false);
  const [revealing, setRevealing] = useState(false);

  /* Keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (index >= movies.length || swiping) return;
      if (e.key === "ArrowLeft") vote(false);
      if (e.key === "ArrowRight") vote(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, swiping]);

  const vote = (choice: boolean) => {
    if (index >= movies.length || swiping) return;
    setSwipeDir(choice ? "right" : "left");
    setSwiping(true);
    setTimeout(() => {
      onVote(movies[index].tmdb_id, choice);
      setIndex((i) => i + 1);
      setSwipeDir(null);
      setSwiping(false);
    }, 300);
  };

  const finished = index >= movies.length;

  /* ── Finished screen ──────────────────────────────────────────────────── */
  if (finished) {
    return (
      <div className="w-full max-w-md mx-auto glass rounded-3xl p-8 text-center flex flex-col items-center space-y-6 min-h-[480px] justify-center">
        <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 animate-bounce">
          <Film className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">All Done!</h2>
          <p className="text-zinc-400 text-sm">
            You've swiped all {movies.length} movies. Waiting for the rest of
            the group…
          </p>
        </div>

        {/* Live progress */}
        <div className="w-full space-y-4 pt-4 border-t border-zinc-800">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest text-left">
            Group Progress
          </h3>
          <div className="space-y-3">
            {participants.map((p) => {
              const prog = progressUpdates[p.id] ?? {
                name: p.name,
                voted: 0,
                total: movies.length,
              };
              const pct = Math.round((prog.voted / movies.length) * 100);
              const isMe = p.name === participantName;
              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-zinc-200">
                      {prog.name}
                      {isMe && (
                        <span className="ml-1 text-indigo-400 font-normal text-[10px]">
                          (You)
                        </span>
                      )}
                    </span>
                    <span
                      className={
                        pct === 100 ? "text-emerald-400 font-bold" : "text-zinc-500"
                      }
                    >
                      {pct === 100 ? "✓ Ready" : `${prog.voted} / ${movies.length}`}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-950 rounded-full h-2 border border-zinc-900 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct === 100
                          ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                          : "bg-gradient-to-r from-indigo-500 to-purple-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isHost && (
          <button
            onClick={async () => {
              setRevealing(true);
              try {
                await onForceReveal();
              } finally {
                setRevealing(false);
              }
            }}
            disabled={revealing}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl py-3 text-xs font-bold shadow-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {revealing ? "Revealing Matches..." : "Reveal Matches Now"}
          </button>
        )}

        <p className="text-[10px] text-zinc-600 flex items-center gap-1 italic">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          Match reveals automatically once everyone finishes.
        </p>
      </div>
    );
  }

  const movie = movies[index];

  /* ── Swipe card deck ──────────────────────────────────────────────────── */
  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between w-full text-xs px-1">
        <span className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-3 py-1 rounded-full font-medium">
          {index + 1} / {movies.length}
        </span>
        <span className="flex items-center gap-1 bg-indigo-950/20 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full font-medium">
          <HelpCircle className="w-3 h-3" />← dislike · like →
        </span>
      </div>

      {/* Card stack */}
      <div className="relative w-full" style={{ aspectRatio: "2/3", maxHeight: 520 }}>
        {/* Peek card behind */}
        {index + 1 < movies.length && (
          <div className="absolute inset-0 scale-[0.96] translate-y-3 opacity-40 glass rounded-3xl pointer-events-none -z-10" />
        )}

        {/* Active card */}
        <div
          className={`absolute inset-0 glass rounded-3xl overflow-hidden flex flex-col border border-zinc-800/80 shadow-2xl transition-all duration-300 ease-out ${
            swipeDir === "left"
              ? "-translate-x-[160%] -rotate-12 opacity-0"
              : swipeDir === "right"
              ? "translate-x-[160%] rotate-12 opacity-0"
              : "translate-x-0 rotate-0 scale-100"
          }`}
        >
          {/* Poster */}
          <div className="relative flex-1 bg-zinc-950 overflow-hidden">
            {movie.poster_path ? (
              <>
                <img
                  src={movie.poster_path}
                  alt={movie.title}
                  className="w-full h-full object-cover select-none"
                  draggable={false}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    const fb = document.getElementById(`fallback-${movie.tmdb_id}`);
                    if (fb) fb.classList.remove("hidden");
                  }}
                />
                <div
                  id={`fallback-${movie.tmdb_id}`}
                  className="hidden absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 bg-gradient-to-br from-zinc-900 to-zinc-950"
                >
                  <Film className="w-12 h-12 text-zinc-700 animate-pulse" />
                  <span className="text-xs text-zinc-500 font-bold">{movie.title}</span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2 bg-zinc-900">
                <Film className="w-12 h-12" />
                <span className="text-xs">No Poster</span>
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent pointer-events-none" />

            {/* Floating metadata */}
            <div className="absolute bottom-4 left-4 right-4 space-y-2">
              <h2 className="text-xl font-black text-white leading-tight drop-shadow-lg">
                {movie.title}
              </h2>
              <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
                {movie.rating && (
                  <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md">
                    <Star className="w-3 h-3 fill-amber-400" />
                    {movie.rating}
                  </span>
                )}
                {movie.runtime && (
                  <span className="flex items-center gap-1 bg-zinc-900/80 text-zinc-300 border border-zinc-800 px-2 py-0.5 rounded-md">
                    <Clock className="w-3 h-3" />
                    {movie.runtime}m
                  </span>
                )}
                {movie.genres && (
                  <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                    {movie.genres.split(",")[0].trim()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bottom info */}
          <div className="p-4 bg-zinc-950 border-t border-zinc-900 space-y-3">
            <div>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                Synopsis
              </span>
              <p className="text-zinc-400 text-[11px] leading-relaxed line-clamp-2 mt-0.5">
                {movie.overview || "No description available."}
              </p>
            </div>
            {movie.streaming_info && (
              <div>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                  Where to Watch
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {movie.streaming_info.split(",").map((p) => (
                    <span
                      key={p}
                      className="text-[9px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full"
                    >
                      {p.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-6 pt-1 select-none">
        {/* Dislike */}
        <button
          onClick={() => vote(false)}
          disabled={swiping}
          title="Dislike (← Arrow)"
          className="p-4 bg-zinc-900 border border-zinc-800 hover:border-rose-500/40 text-rose-400 hover:bg-rose-500/5 rounded-full transition-all active:scale-90 cursor-pointer shadow-lg"
        >
          <X className="w-7 h-7" />
        </button>

        {/* Like */}
        <button
          onClick={() => vote(true)}
          disabled={swiping}
          title="Like (→ Arrow)"
          className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-full transition-all active:scale-90 cursor-pointer shadow-[0_4px_20px_rgba(99,102,241,0.3)]"
        >
          <Heart className="w-7 h-7 fill-white" />
        </button>
      </div>
    </div>
  );
}
