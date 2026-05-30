"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Film,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import Confetti from "@/components/Confetti";
import SwipeDeck from "@/components/SwipeDeck";

/* ── Types ────────────────────────────────────────────────────────────────── */

interface RoomUser {
  id: string;
  name: string;
  role: "host" | "guest";
}

interface Member {
  id: string;
  name: string;
  genres?: string[];
}

interface MovieCard {
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

interface MatchMovie {
  tmdb_id: string;
  title: string;
  overview: string | null;
  poster_path: string | null;
  genres: string | null;
  rating: number | null;
  runtime: number | null;
  streaming_info: string | null;
  yes_count: number;
  is_unanimous: boolean;
}

interface MatchResult {
  total_members: number;
  matches: MatchMovie[];
}

type RoomState = "waiting" | "swiping" | "revealed";

type ProgressMap = Record<
  string,
  { name: string; voted: number; total: number }
>;

const AVAILABLE_GENRES = [
  "Action",
  "Comedy",
  "Romance",
  "Drama",
  "Sci-Fi",
  "Horror",
  "Thriller",
  "Documentary",
  "Animation",
];

/* ── Component ────────────────────────────────────────────────────────────── */

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  /* user identity */
  const [user, setUser] = useState<RoomUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  /* direct-join form (when arriving via invite link) */
  const [directName, setDirectName] = useState("");
  const [directError, setDirectError] = useState("");
  const [joiningDirect, setJoiningDirect] = useState(false);

  /* room state */
  const [roomState, setRoomState] = useState<RoomState>("waiting");
  const [groupType, setGroupType] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [movies, setMovies] = useState<MovieCard[]>([]);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [matches, setMatches] = useState<MatchResult | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  /* ui */
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const moviesLoadedRef = useRef(false);
  const matchesLoadedRef = useRef(false);
  const genresInitializedRef = useRef(false);

  /* ── 2. Load user from localStorage ──────────────────────────────────── */
  useEffect(() => {
    const saved = localStorage.getItem(`room_${code}_user`);
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        /* ignore corrupt data */
      }
    }
    setLoadingUser(false);
  }, [code]);

  /* ── 3. Fetch room details ────────────────────────────────────────────── */
  const fetchRoom = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/rooms/${code}`);
      if (!res.ok) throw new Error("Room not found");
      const data = await res.json();
      setGroupType(data.group_type);
      setRoomState(data.state as RoomState);
      setMembers(data.members);
      setErrorMsg(""); // Clear errors on success
      
      // Initialize progress mapping from database values
      if (data.state === "swiping" || data.state === "revealed") {
        const initProgress: ProgressMap = {};
        data.members.forEach((m: any) => {
          if (m.voted_count !== undefined && m.voted_count !== null) {
            initProgress[m.id] = {
              name: m.name,
              voted: m.voted_count,
              total: 20,
            };
          }
        });
        setProgress(initProgress);
      }

      // Initialize selected genres for this user from room details response (ONLY ONCE)
      if (user && !genresInitializedRef.current) {
        const me = data.members.find((m: any) => m.id === user.id);
        if (me && me.genres) {
          setSelectedGenres(me.genres);
          genresInitializedRef.current = true;
        }
      }

      if (data.state === "swiping" && !moviesLoadedRef.current) {
        fetchDeck();
      }
      if (data.state === "revealed" && !matchesLoadedRef.current) {
        fetchMatches();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load room");
    }
  };

  const fetchDeck = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/rooms/${code}/recs`);
      if (res.ok) {
        setMovies(await res.json());
        moviesLoadedRef.current = true;
      }
    } catch (err) {
      console.error("Failed to fetch deck:", err);
    }
  };

  const fetchMatches = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/rooms/${code}/matches`);
      if (res.ok) {
        setMatches(await res.json());
        matchesLoadedRef.current = true;
      }
    } catch (err) {
      console.error("Failed to fetch matches:", err);
    }
  };

  /* ── 4. Short Polling ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (loadingUser || !user) return;

    // Initial fetch
    fetchRoom();

    // Poll every 2 seconds
    const interval = setInterval(() => {
      fetchRoom();
    }, 2000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUser, user]);

  /* ── 4. Actions ───────────────────────────────────────────────────────── */
  const startSession = async () => {
    const res = await fetch(`${backendUrl}/api/rooms/${code}/start`, {
      method: "POST",
    });
    if (!res.ok)
      setErrorMsg((await res.json()).detail || "Could not start session");
  };

  const castVote = async (tmdbId: string, choice: boolean) => {
    if (!user) return;
    await fetch(`${backendUrl}/api/rooms/${code}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, tmdb_id: tmdbId, choice }),
    });
  };

  const forceReveal = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/rooms/${code}/reveal`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error((await res.json()).detail || "Could not reveal matches");
      }
      const data = await res.json();
      setMatches(data);
      setRoomState("revealed");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to force reveal matches");
    }
  };

  const toggleGenre = async (genre: string) => {
    if (!user) return;
    const updated = selectedGenres.includes(genre)
      ? selectedGenres.filter((g) => g !== genre)
      : [...selectedGenres, genre];

    setSelectedGenres(updated);

    try {
      const res = await fetch(`${backendUrl}/api/users/${user.id}/genres`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genres: updated }),
      });
      if (!res.ok) {
        console.error("Failed to save genres to backend");
      }
    } catch (err) {
      console.error("Failed to save genres:", err);
    }
  };

  const joinDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directName.trim()) return setDirectError("Name is required");
    setDirectError("");
    setJoiningDirect(true);
    try {
      const res = await fetch(`${backendUrl}/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: directName.trim() }),
      });
      if (!res.ok)
        throw new Error((await res.json()).detail || "Could not join room");
      const data = await res.json();
      const newUser: RoomUser = {
        id: data.user_id,
        name: data.user_name,
        role: "guest",
      };
      localStorage.setItem(`room_${code}_user`, JSON.stringify(newUser));
      setUser(newUser);
    } catch (err: unknown) {
      setDirectError(err instanceof Error ? err.message : "Failed to join");
      setJoiningDirect(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${code}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  /* ── Loading ──────────────────────────────────────────────────────────── */
  if (loadingUser) {
    return (
      <div className="flex-1 min-h-screen flex flex-col items-center justify-center gap-4 text-zinc-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm font-semibold">Loading session…</p>
      </div>
    );
  }

  /* ── Direct join gate ─────────────────────────────────────────────────── */
  if (!user) {
    return (
      <div className="flex-1 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="glass glass-glow rounded-3xl p-8 w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-black text-white mb-1">Join Session</h1>
            <p className="text-xs text-zinc-400">
              Room Code:{" "}
              <span className="text-indigo-400 font-bold tracking-widest">
                {code}
              </span>
            </p>
          </div>
          <form onSubmit={joinDirect} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="directName"
                className="text-xs font-semibold text-zinc-300"
              >
                Your Name
              </label>
              <input
                id="directName"
                type="text"
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                placeholder="e.g. Atul"
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-indigo-500/50 text-white rounded-xl px-4 py-3 text-sm outline-none"
              />
            </div>
            {directError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                {directError}
              </p>
            )}
            <button
              type="submit"
              disabled={joiningDirect}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-3 font-semibold text-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {joiningDirect ? "Joining…" : "Join Room"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ── Main room layout ─────────────────────────────────────────────────── */
  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 min-h-screen max-w-5xl mx-auto w-full">
      {/* Header */}
      <header className="flex justify-between items-center py-4 border-b border-zinc-800/80 mb-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Film className="w-5 h-5 text-indigo-400" />
          <span className="font-black text-lg text-white">MovieMatch</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white">{user.name}</p>
            <p className="text-[10px] text-zinc-500 capitalize">
              {user.role} · {groupType}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
            {user.name[0].toUpperCase()}
          </div>
        </div>
      </header>

      {/* Error banner */}
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2 mb-6">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── WAITING ────────────────────────────────────────────────────── */}
      {roomState === "waiting" && (
        <div className="flex-1 grid md:grid-cols-5 gap-8 items-start">
          {/* Left: room info */}
          <div className="md:col-span-3 space-y-5">
            <div className="glass rounded-3xl p-6 md:p-8 space-y-6">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">
                  Lobby
                </span>
                <h1 className="text-3xl font-black text-white">
                  Room is ready!
                </h1>
                <p className="text-zinc-400 text-sm mt-1">
                  Share the code or invite link. Once everyone's in, the host
                  starts swiping.
                </p>
              </div>

              {/* Room code */}
              <div className="bg-zinc-950 rounded-2xl border border-zinc-900 p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                    Room Code
                  </span>
                  <span className="text-3xl font-black tracking-widest text-white">
                    {code}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Code
                      </>
                    )}
                  </button>
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Start button (host only) */}
              {user.role === "host" ? (
                <button
                  onClick={startSession}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl py-4 font-bold text-sm shadow-[0_4px_25px_rgba(99,102,241,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Start Swiping
                </button>
              ) : (
                <div className="w-full bg-zinc-900/30 border border-zinc-800 text-zinc-400 text-xs text-center py-4 rounded-2xl">
                  Waiting for the host to start…
                </div>
              )}
            </div>

            {/* Vibe Selection */}
            <div className="glass rounded-3xl p-6 md:p-8 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">Your Movie Vibe</h2>
                <p className="text-zinc-400 text-xs mt-0.5">
                  Select genres you feel like watching. We will combine everyone's choices to shape the deck!
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {AVAILABLE_GENRES.map((g) => {
                  const selected = selectedGenres.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() => toggleGenre(g)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none active:scale-95 ${
                        selected
                          ? "bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: member list */}
          <div className="md:col-span-2 glass rounded-3xl p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4" /> Players ({members.length})
            </h2>
            <div className="space-y-2.5">
              {members.map((m) => {
                const isMe = m.id === user.id;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isMe
                        ? "border-indigo-500/30 bg-indigo-500/5"
                        : "border-zinc-800 bg-zinc-900/10"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs">
                      {m.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-zinc-200 truncate">
                          {m.name}
                        </span>
                        {isMe && (
                          <span className="text-indigo-400 text-[10px] font-normal shrink-0">
                            (You)
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                        {m.genres && m.genres.length > 0 ? m.genres.join(", ") : "No preferences"}
                      </p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── SWIPING ────────────────────────────────────────────────────── */}
      {roomState === "swiping" &&
        (movies.length > 0 ? (
          <SwipeDeck
            movies={movies}
            onVote={castVote}
            participantName={user.name}
            progressUpdates={progress}
            participants={members}
            isHost={user.role === "host"}
            onForceReveal={forceReveal}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-sm text-zinc-400 font-semibold">
              Generating your movie deck…
            </p>
          </div>
        ))}

      {/* ── REVEALED ───────────────────────────────────────────────────── */}
      {roomState === "revealed" && matches && (
        <div className="flex-1 flex flex-col space-y-8 pb-10">
          <Confetti />

          {matches.matches.length > 0 ? (
            <div className="space-y-8">
              {/* Title */}
              <div className="text-center space-y-3 max-w-xl mx-auto">
                {matches.matches[0].is_unanimous ? (
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <Sparkles className="w-3.5 h-3.5" /> Unanimous Match!
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider">
                    <Film className="w-3.5 h-3.5" /> Top Picks
                  </div>
                )}
                <h1 className="text-4xl md:text-5xl font-black text-white">
                  {matches.matches[0].is_unanimous
                    ? "We found a winner! 🎉"
                    : "Close Choices"}
                </h1>
                <p className="text-zinc-400 text-sm">
                  {matches.matches[0].is_unanimous
                    ? "Everyone voted YES. Grab the popcorn!"
                    : "No unanimous hit — here are the most-liked films. Let the group decide!"}
                </p>
              </div>

              {/* Hero movie */}
              {(() => {
                const hero = matches.matches[0];
                return (
                  <div className="glass glass-glow rounded-3xl p-6 md:p-8 max-w-2xl mx-auto grid md:grid-cols-5 gap-6 border border-zinc-800/80">
                    {/* Poster */}
                    <div className="md:col-span-2 aspect-[2/3] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800">
                      {hero.poster_path ? (
                        <>
                          <img
                            src={hero.poster_path}
                            alt={hero.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                              const fb = document.getElementById("hero-fallback");
                              if (fb) fb.classList.remove("hidden");
                            }}
                          />
                          <div
                            id="hero-fallback"
                            className="hidden absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 bg-zinc-900"
                          >
                            <Film className="w-10 h-10 text-zinc-700" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700">
                          <Film className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="md:col-span-3 flex flex-col justify-between space-y-4 py-1">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full ${
                              hero.is_unanimous
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                            }`}
                          >
                            {hero.is_unanimous
                              ? "Unanimous"
                              : `${hero.yes_count} / ${matches.total_members} Votes`}
                          </span>
                          {hero.rating && (
                            <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                              <Star className="w-3.5 h-3.5 fill-amber-400" />
                              {hero.rating}
                            </span>
                          )}
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
                          {hero.title}
                        </h2>
                        <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                          {hero.runtime && (
                            <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md">
                              {hero.runtime} min
                            </span>
                          )}
                          {hero.genres
                            ?.split(",")
                            .map((g) => (
                              <span
                                key={g}
                                className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md"
                              >
                                {g.trim()}
                              </span>
                            ))}
                        </div>
                        <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
                          {hero.overview}
                        </p>
                      </div>
                      {hero.streaming_info && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                            Watch On
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {hero.streaming_info.split(",").map((p) => (
                              <span
                                key={p}
                                className="text-[10px] font-semibold bg-indigo-950/20 border border-indigo-900/30 text-indigo-300 px-2.5 py-1 rounded-full"
                              >
                                {p.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Runner-ups */}
              {matches.matches.length > 1 && (
                <div className="max-w-2xl mx-auto space-y-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Runner-Ups
                  </h3>
                  {matches.matches.slice(1, 4).map((m) => (
                    <div
                      key={m.tmdb_id}
                      className="glass rounded-2xl p-4 flex items-center gap-4 border border-zinc-900"
                    >
                      <div className="w-14 aspect-[2/3] bg-zinc-950 rounded-lg overflow-hidden shrink-0 border border-zinc-800">
                        {m.poster_path ? (
                          <>
                            <img
                              src={m.poster_path}
                              alt={m.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                                const fb = document.getElementById(`runner-fallback-${m.tmdb_id}`);
                                if (fb) fb.classList.remove("hidden");
                              }}
                            />
                            <div
                              id={`runner-fallback-${m.tmdb_id}`}
                              className="hidden absolute inset-0 flex items-center justify-center bg-zinc-900 text-zinc-700"
                            >
                              <Film className="w-5 h-5" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-700">
                            <Film className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="font-bold text-white text-sm truncate">
                            {m.title}
                          </h4>
                          <span className="text-xs font-bold text-zinc-400 shrink-0">
                            {m.yes_count} yes
                          </span>
                        </div>
                        <p className="text-zinc-500 text-xs line-clamp-1">
                          {m.overview}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-400">
                          {m.rating && (
                            <>
                              <span className="flex items-center gap-0.5 text-amber-500">
                                <Star className="w-3 h-3 fill-amber-500" />
                                {m.rating}
                              </span>
                              <span>·</span>
                            </>
                          )}
                          {m.runtime && <span>{m.runtime}m</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-center pt-4">
                <button
                  onClick={() => router.push("/")}
                  className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 px-6 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Home
                </button>
              </div>
            </div>
          ) : (
            /* No matches */
            <div className="max-w-md mx-auto glass rounded-3xl p-10 text-center space-y-5">
              <div className="inline-block p-4 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-full">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">No matches found</h2>
              <p className="text-zinc-400 text-sm">
                Nobody voted YES on any movie. Try a different group type!
              </p>
              <button
                onClick={() => router.push("/")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 py-3 font-semibold text-sm transition-all cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
