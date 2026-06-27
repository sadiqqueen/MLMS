import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Real-time collaborative editing for ONE consultant memo.
//
// The frontend (Vercel / Vite) and the backend (Express + Socket.io) are on
// SEPARATE origins, and Vercel can't proxy WebSockets, so we connect the
// socket DIRECTLY to the backend origin via an env var:
//   VITE_SOCKET_URL=http://localhost:5000   (dev)
//   VITE_SOCKET_URL=https://your-backend-url (prod — Railway/VPS)
// If it's unset we fall back to the local dev backend.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// How it works:
// - Joins a room named after the memo id, so only people editing the SAME
//   memo sync with each other.
// - `onRemoteChange(fieldId, value)` is called for edits coming from OTHER
//   users; the caller applies them to React state WITHOUT re-emitting.
// - Returns `emitFieldChange(fieldId, value)`, which you call ONLY from the
//   local field onChange handlers (i.e. on real user typing). Because remote
//   changes never emit, there is no echo loop.
//
// SECURITY NOTE: this socket is OPEN by design — keyed only by memo id and not
// authenticated. See the matching note in backend/server.js.
export function useMemoLiveSync(memoId, onRemoteChange) {
  const socketRef = useRef(null);
  // Keep the latest callback in a ref so the effect doesn't reconnect when the
  // component re-renders with a new closure.
  const onRemoteRef = useRef(onRemoteChange);
  onRemoteRef.current = onRemoteChange;

  useEffect(() => {
    // A brand-new, unsaved memo has no id yet — nothing to sync on.
    if (!memoId) return;

    const socket = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = socket;

    // Join on connect (and re-join automatically after any reconnect).
    socket.on('connect', () => socket.emit('join-memo', memoId));

    socket.on('field-change', (payload) => {
      if (!payload || payload.memoId !== memoId) return;   // extra safety
      onRemoteRef.current?.(payload.fieldId, payload.value);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [memoId]);

  // Broadcast a local edit to the other editors of this memo.
  return (fieldId, value) => {
    socketRef.current?.emit('field-change', { memoId, fieldId, value });
  };
}
