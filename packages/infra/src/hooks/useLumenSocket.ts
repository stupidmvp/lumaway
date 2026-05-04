import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export function useLumenSocket(
    observerSessionId: string | null,
    onProgressUpdate?: (payload: any) => void
) {
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!observerSessionId) return;

        // Initialize socket
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3030';
        const token = typeof window !== 'undefined' ? localStorage.getItem('lumaway_token') : null;
        
        // Remove trailing slash if any and extract origin to support path-based routing later
        const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
        
        const socket = io(baseUrl, {
            auth: { token },
            transports: ['websocket', 'polling']
        });
        
        socketRef.current = socket;

        // Listen for connection
        socket.on('connect', () => {
            console.log('[LumenSocket] Connected');
            // Join the observer session room
            socket.emit('observer-session:join', { observerSessionId });
        });

        // Listen for progress events
        socket.on('observer-session:progress', (payload) => {
            console.log('[LumenSocket] Received progress event:', payload);
            if (onProgressUpdate) {
                onProgressUpdate(payload);
            }
        });

        socket.on('connect_error', (error) => {
            console.warn('[LumenSocket] Connection error:', error);
        });

        // Cleanup
        return () => {
            if (socket.connected) {
                socket.emit('observer-session:leave', { observerSessionId });
                socket.disconnect();
            }
            socketRef.current = null;
        };
    }, [observerSessionId, onProgressUpdate]);

    return socketRef;
}
