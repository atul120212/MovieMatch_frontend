"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Film,
  Heart,
  LogIn,
  Plus,
  Sparkles,
  Users,
  Users2,
} from "lucide-react";

const GROUP_TYPES = [
  {
    id: "couple",
    name: "Couple",
    icon: Heart,
    desc: "Romance, drama, comedies",
  },
  {
    id: "family",
    name: "Family",
    icon: Users,
    desc: "Animation, adventure, PG rating",
  },
  {
    id: "friends",
    name: "Friends",
    icon: Users2,
    desc: "Action, comedy, horror, sci-fi",
  },
  {
    id: "coworkers",
    name: "Coworkers",
    icon: Briefcase,
    desc: "Documentary, biopic, lighter fare",
  },
];

export default function Home() {
  const router = useRouter();
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  /* ── Create state ─────────────────────────────────────────────────────── */
  const [hostName, setHostName] = useState("");
  const [groupType, setGroupType] = useState("friends");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  /* ── Join state ───────────────────────────────────────────────────────── */
  const [guestName, setGuestName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  /* ── Handlers ─────────────────────────────────────────────────────────── */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) return setCreateError("Name is required");
    setCreateError("");
    setIsCreating(true);

    try {
      const res = await fetch(`${backendUrl}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host_name: hostName.trim(),
          group_type: groupType,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to create room");

      const data = await res.json();
      // Store session identity in localStorage
      localStorage.setItem(
        `room_${data.room_code}_user`,
        JSON.stringify({ id: data.user_id, name: data.user_name, role: "host" })
      );
      router.push(`/room/${data.room_code}`);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Unknown error");
      setIsCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return setJoinError("Name is required");
    if (roomCode.length < 4) return setJoinError("Enter a valid room code");
    setJoinError("");
    setIsJoining(true);

    const code = roomCode.trim().toUpperCase();
    try {
      const res = await fetch(`${backendUrl}/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: guestName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Could not join room");

      const data = await res.json();
      localStorage.setItem(
        `room_${data.room_code}_user`,
        JSON.stringify({ id: data.user_id, name: data.user_name, role: "guest" })
      );
      router.push(`/room/${data.room_code}`);
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : "Unknown error");
      setIsJoining(false);
    }
  };

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-[10%] left-[15%] w-[40rem] h-[40rem] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-[10%] right-[15%] w-[40rem] h-[40rem] bg-pink-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Hero */}
      <div className="text-center mb-10 max-w-lg">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-5 animate-pulse-slow">
          <Sparkles className="w-3.5 h-3.5" />
          Real-time Group Swiping
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white mb-3">
          Movie
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            Match
          </span>
        </h1>
        <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
          Create a room, invite your people, swipe movies independently, and
          discover your perfect match in real time.
        </p>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* ── Create ── */}
        <div className="glass glass-glow rounded-2xl p-6 md:p-8">
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Create a Session</h2>
                <p className="text-xs text-zinc-500">Start a new group matching deck</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="hostName" className="text-xs font-semibold text-zinc-300">
                Your Name
              </label>
              <input
                id="hostName"
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="e.g. Atul"
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-indigo-500/60 text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300">
                Group Type
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {GROUP_TYPES.map((t) => {
                  const Icon = t.icon;
                  const sel = groupType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setGroupType(t.id)}
                      className={`flex flex-col items-start text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        sel
                          ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_18px_rgba(99,102,241,0.2)]"
                          : "border-zinc-800 bg-zinc-900/20 hover:border-zinc-700"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 mb-2 ${sel ? "text-indigo-400" : "text-zinc-500"}`}
                      />
                      <span className="text-xs font-bold text-zinc-200 block mb-0.5">
                        {t.name}
                      </span>
                      <span className="text-[10px] text-zinc-500 leading-tight">
                        {t.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {createError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                {createError}
              </p>
            )}

            <button
              type="submit"
              disabled={isCreating}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl py-3 font-semibold text-sm shadow-[0_4px_20px_rgba(99,102,241,0.3)] transition-all active:scale-[0.98] cursor-pointer"
            >
              {isCreating ? "Creating…" : "Create Room"}
            </button>
          </form>
        </div>

        {/* ── Join ── */}
        <div className="glass rounded-2xl p-6 md:p-8">
          <form onSubmit={handleJoin} className="space-y-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 bg-pink-500/10 text-pink-400 rounded-xl border border-pink-500/20">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Join a Session</h2>
                <p className="text-xs text-zinc-500">Enter a code from a friend</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="guestName" className="text-xs font-semibold text-zinc-300">
                Your Name
              </label>
              <input
                id="guestName"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Priya"
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-pink-500/60 text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="roomCode" className="text-xs font-semibold text-zinc-300">
                Room Code
              </label>
              <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="LION42"
                maxLength={8}
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-pink-500/60 text-white rounded-xl px-4 py-3 text-sm outline-none tracking-[0.3em] text-center font-bold transition-colors placeholder:tracking-normal placeholder:font-normal placeholder:text-zinc-600"
              />
            </div>

            {joinError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                {joinError}
              </p>
            )}

            <button
              type="submit"
              disabled={isJoining}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:opacity-50 text-white rounded-xl py-3 font-semibold text-sm shadow-[0_4px_20px_rgba(219,39,119,0.3)] transition-all active:scale-[0.98] cursor-pointer"
            >
              {isJoining ? "Joining…" : "Join Room"}
            </button>
          </form>
        </div>
      </div>

      {/* Footer hint */}
      <p className="mt-10 text-xs text-zinc-600 flex items-center gap-1.5">
        <Film className="w-3.5 h-3.5" />
        No account needed — just a name and a vibe.
      </p>
    </div>
  );
}
