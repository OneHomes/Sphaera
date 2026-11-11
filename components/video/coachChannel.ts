"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";

// The coaching ("whisper") room that sits beside every call: an Admin
// speaks, the agent listens. The client is never given a token for it, so
// nothing said here can reach them. Kept as its own Room connection, apart
// from the call's <LiveKitRoom>, so the two never mix.

// Agent side: play whatever the Admin says and report when they're talking.
export function useCoachListener(url: string | null, token: string | null) {
  const [coachName, setCoachName] = useState<string | null>(null);

  useEffect(() => {
    if (!url || !token) return;
    const room = new Room();
    const elements = new Set<HTMLMediaElement>();

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      el.dataset.sphaeraCoach = "true";
      document.body.appendChild(el);
      elements.add(el);
    });
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach().forEach((el) => {
        elements.delete(el);
        el.remove();
      });
    });
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const speaking = speakers.find((p) => !p.isLocal);
      setCoachName(speaking ? speaking.name || "Your manager" : null);
    });

    room.connect(url, token).catch((err) => console.error("Coaching channel failed to connect:", err));
    return () => {
      elements.forEach((el) => el.remove());
      room.disconnect();
    };
  }, [url, token]);

  return { coachName };
}

// Admin side: push-to-talk to the agent. The microphone is only enabled
// while talking, so nothing is sent otherwise.
export function useCoachTalker(url: string | null, token: string | null) {
  const roomRef = useRef<Room | null>(null);
  const [ready, setReady] = useState(false);
  const [talking, setTalking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url || !token) return;
    const room = new Room();
    roomRef.current = room;
    room
      .connect(url, token)
      .then(() => setReady(true))
      .catch((err) => {
        console.error("Coaching channel failed to connect:", err);
        setError("Couldn't open the coaching channel");
      });
    return () => {
      roomRef.current = null;
      setReady(false);
      room.disconnect();
    };
  }, [url, token]);

  async function setTalk(on: boolean) {
    const room = roomRef.current;
    if (!room || !ready) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(on);
      setTalking(on);
    } catch (err) {
      console.error("Coaching microphone failed:", err);
      setError("Microphone unavailable: allow microphone access to talk to the agent");
      setTalking(false);
    }
  }

  return { ready, talking, error, startTalking: () => setTalk(true), stopTalking: () => setTalk(false) };
}
