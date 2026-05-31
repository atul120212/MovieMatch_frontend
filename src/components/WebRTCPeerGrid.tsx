"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Mic, MicOff, Users } from "lucide-react";

interface Participant {
  id: string;
  name: string;
  genres?: string[];
  notified?: boolean;
}

interface WebRTCPeerGridProps {
  roomCode: string;
  userId: string;
  userName: string;
  participants: Participant[];
  ws: WebSocket | null;
}

interface PeerStream {
  userId: string;
  userName: string;
  stream: MediaStream | null;
  cameraEnabled: boolean;
  micEnabled: boolean;
}

export default function WebRTCPeerGrid({
  roomCode,
  userId,
  userName,
  participants,
  ws,
}: WebRTCPeerGridProps) {
  const [localCam, setLocalCam] = useState(false);
  const [localMic, setLocalMic] = useState(false);
  const [peerStreams, setPeerStreams] = useState<Record<string, PeerStream>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // STUN config
  const rtcConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  // Broadcast media toggle state
  const broadcastMediaState = (cam: boolean, mic: boolean) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          event: "webrtc_media_toggle",
          sender_id: userId,
          sender_name: userName,
          cameraEnabled: cam,
          micEnabled: mic,
        })
      );
    }
  };

  // Start local camera stream
  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      
      // Update local video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setLocalCam(true);
      setLocalMic(true);
      broadcastMediaState(true, true);

      // Re-negotiate connections with all peers in room
      participants.forEach((p) => {
        if (p.id !== userId) {
          initiatePeerConnection(p.id, p.name, stream);
        }
      });
    } catch (err) {
      console.warn("Failed to get media devices:", err);
      // Try audio only fallback
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        localStreamRef.current = stream;
        setLocalMic(true);
        broadcastMediaState(false, true);
        participants.forEach((p) => {
          if (p.id !== userId) {
            initiatePeerConnection(p.id, p.name, stream);
          }
        });
      } catch (audioErr) {
        console.error("Camera/Mic permission denied or unavailable:", audioErr);
      }
    }
  };

  // Stop local media tracks
  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setLocalCam(false);
    setLocalMic(false);
    broadcastMediaState(false, false);

    // Clean up peer connections
    Object.keys(peerConnectionsRef.current).forEach((pId) => {
      peerConnectionsRef.current[pId].close();
      delete peerConnectionsRef.current[pId];
    });
    setPeerStreams({});
  };

  // Create P2P RTC Connection
  const initiatePeerConnection = (
    peerId: string,
    peerName: string,
    stream: MediaStream
  ) => {
    // Avoid double connections
    if (peerConnectionsRef.current[peerId]) {
      peerConnectionsRef.current[peerId].close();
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionsRef.current[peerId] = pc;

    // Add local tracks
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle remote tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setPeerStreams((prev) => ({
        ...prev,
        [peerId]: {
          userId: peerId,
          userName: peerName,
          stream: remoteStream,
          cameraEnabled: prev[peerId]?.cameraEnabled ?? true,
          micEnabled: prev[peerId]?.micEnabled ?? true,
        },
      }));
    };

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            event: "webrtc_signal",
            target_id: peerId,
            sender_id: userId,
            signal: {
              type: "candidate",
              candidate: event.candidate,
            },
          })
        );
      }
    };

    // Create SDP Offer
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              event: "webrtc_signal",
              target_id: peerId,
              sender_id: userId,
              signal: {
                type: "offer",
                sdp: pc.localDescription?.sdp,
              },
            })
          );
        }
      })
      .catch((err) => console.error("Error creating SDP Offer:", err));
  };

  // Set up remote SDP negotiation
  const handleRemoteOffer = async (
    senderId: string,
    senderName: string,
    sdp: string
  ) => {
    let pc = peerConnectionsRef.current[senderId];
    if (!pc) {
      pc = new RTCPeerConnection(rtcConfig);
      peerConnectionsRef.current[senderId] = pc;

      // Add local stream if we are actively sharing
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setPeerStreams((prev) => ({
          ...prev,
          [senderId]: {
            userId: senderId,
            userName: senderName,
            stream: remoteStream,
            cameraEnabled: prev[senderId]?.cameraEnabled ?? true,
            micEnabled: prev[senderId]?.micEnabled ?? true,
          },
        }));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              event: "webrtc_signal",
              target_id: senderId,
              sender_id: userId,
              signal: {
                type: "candidate",
                candidate: event.candidate,
              },
            })
          );
        }
      };
    }

    try {
      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: "offer", sdp })
      );
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            event: "webrtc_signal",
            target_id: senderId,
            sender_id: userId,
            signal: {
              type: "answer",
              sdp: answer.sdp,
            },
          })
        );
      }
    } catch (err) {
      console.error("Error setting remote description:", err);
    }
  };

  const handleRemoteAnswer = async (senderId: string, sdp: string) => {
    const pc = peerConnectionsRef.current[senderId];
    if (pc) {
      try {
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp })
        );
      } catch (err) {
        console.error("Error setting remote answer:", err);
      }
    }
  };

  const handleRemoteCandidate = async (senderId: string, candidate: any) => {
    const pc = peerConnectionsRef.current[senderId];
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding remote ICE Candidate:", err);
      }
    }
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const nextState = !videoTrack.enabled;
        videoTrack.enabled = nextState;
        setLocalCam(nextState);
        broadcastMediaState(nextState, localMic);
      }
    } else {
      startLocalStream();
    }
  };

  // Toggle Mic
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const nextState = !audioTrack.enabled;
        audioTrack.enabled = nextState;
        setLocalMic(nextState);
        broadcastMediaState(localCam, nextState);
      }
    } else {
      startLocalStream();
    }
  };

  // Listen to WebRTC signals from WebSockets
  useEffect(() => {
    if (!ws) return;

    const handleSignal = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === "webrtc_signal") {
          const { sender_id, signal } = payload;
          const peer = participants.find((p) => p.id === sender_id);
          const peerName = peer?.name || "Viewer";

          if (signal.type === "offer") {
            handleRemoteOffer(sender_id, peerName, signal.sdp);
          } else if (signal.type === "answer") {
            handleRemoteAnswer(sender_id, signal.sdp);
          } else if (signal.type === "candidate") {
            handleRemoteCandidate(sender_id, signal.candidate);
          }
        } else if (payload.event === "webrtc_media_toggle") {
          const { sender_id, cameraEnabled, micEnabled } = payload;
          setPeerStreams((prev) => {
            if (!prev[sender_id]) return prev;
            return {
              ...prev,
              [sender_id]: {
                ...prev[sender_id],
                cameraEnabled,
                micEnabled,
              },
            };
          });
        } else if (payload.event === "participant_left") {
          const { user_id } = payload;
          // Clear closed connection
          if (peerConnectionsRef.current[user_id]) {
            peerConnectionsRef.current[user_id].close();
            delete peerConnectionsRef.current[user_id];
          }
          setPeerStreams((prev) => {
            const copy = { ...prev };
            delete copy[user_id];
            return copy;
          });
        }
      } catch (err) {
        console.error("WebRTC WS Event parse error:", err);
      }
    };

    ws.addEventListener("message", handleSignal);
    return () => {
      ws.removeEventListener("message", handleSignal);
    };
  }, [ws, participants]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopLocalStream();
    };
  }, []);

  // Sync local camera feed to video element once mounted
  useEffect(() => {
    if (localCam && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [localCam]);

  return (
    <div className="space-y-4">
      {/* Faces header */}
      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2 mb-2">
        <Users className="w-3.5 h-3.5 text-indigo-400" />
        Faces in Room ({participants.length})
      </h3>

      {/* Peer Camera Grid */}
      <div className="grid grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
        {/* Local Stream tile */}
        <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-950/80 border border-zinc-800 flex items-center justify-center group shadow-md">
          {localCam ? (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-zinc-500">
              <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-white text-xs select-none">
                {userName[0].toUpperCase()}
              </div>
              <span className="text-[10px] font-bold text-zinc-600 truncate max-w-[80px]">
                {userName}
              </span>
            </div>
          )}
          
          {/* Controls indicators */}
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between items-center pointer-events-none">
            <span className="bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-bold text-zinc-200 truncate max-w-[70px]">
              You
            </span>
            <div className="flex gap-1">
              <span className={`p-1 rounded bg-black/60 backdrop-blur-sm ${localMic ? "text-emerald-400" : "text-rose-500"}`}>
                {localMic ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
              </span>
            </div>
          </div>
        </div>

        {/* Remote peer streams */}
        {participants
          .filter((p) => p.id !== userId)
          .map((p) => {
            const peerStream = peerStreams[p.id];
            const isCamOn = peerStream?.cameraEnabled && peerStream?.stream;
            const isMicOn = peerStream?.micEnabled;

            return (
              <div
                key={p.id}
                className="relative aspect-video rounded-xl overflow-hidden bg-zinc-950/80 border border-zinc-800 flex items-center justify-center shadow-md"
              >
                {isCamOn ? (
                  <video
                    ref={(el) => {
                      if (el && peerStream.stream) {
                        el.srcObject = peerStream.stream;
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-zinc-500">
                    <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-zinc-400 text-xs select-none">
                      {p.name[0].toUpperCase()}
                    </div>
                    <span className="text-[10px] font-semibold text-zinc-600 truncate max-w-[80px]">
                      {p.name}
                    </span>
                  </div>
                )}

                {/* Remote labels */}
                <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between items-center pointer-events-none">
                  <span className="bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-bold text-zinc-200 truncate max-w-[70px]">
                    {p.name}
                  </span>
                  <div className="flex gap-1">
                    <span className={`p-1 rounded bg-black/60 backdrop-blur-sm ${isMicOn ? "text-emerald-400" : "text-rose-500"}`}>
                      {isMicOn ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Local Camera/Mic Media Toggles */}
      <div className="flex gap-2">
        <button
          onClick={toggleCamera}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
            localCam
              ? "bg-indigo-500/20 border-indigo-500/30 hover:bg-indigo-500/30 text-indigo-300"
              : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400"
          }`}
        >
          {localCam ? (
            <>
              <Camera className="w-4 h-4 text-indigo-400" /> Cam On
            </>
          ) : (
            <>
              <CameraOff className="w-4 h-4 text-zinc-500" /> Cam Off
            </>
          )}
        </button>

        <button
          onClick={toggleMic}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
            localMic
              ? "bg-purple-500/20 border-purple-500/30 hover:bg-purple-500/30 text-purple-300"
              : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400"
          }`}
        >
          {localMic ? (
            <>
              <Mic className="w-4 h-4 text-purple-400" /> Mic On
            </>
          ) : (
            <>
              <MicOff className="w-4 h-4 text-zinc-500" /> Mic Off
            </>
          )}
        </button>
      </div>
    </div>
  );
}
