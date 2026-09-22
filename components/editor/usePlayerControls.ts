"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { PlayerRef } from '@remotion/player';
import { setFrame as setEditorFrame, getSnapshot as getEditorFrame } from './editorFrameStore';

export function usePlayerControls({ isPreviewFullscreen }: { isPreviewFullscreen: boolean }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [player, setPlayer] = useState<PlayerRef | null>(null);

    const currentFrameRef = useRef(0);
    const mainPlayerRef = useRef<PlayerRef | null>(null);
    const wasFullscreenRef = useRef(false);

    // Use callback ref to ensure we capture the player instance once it's available
    const onMainPlayerRef = useCallback((ref: PlayerRef | null) => {
        mainPlayerRef.current = ref;
        if (!isPreviewFullscreen && ref) setPlayer(ref);
    }, [isPreviewFullscreen]);

    const onFullscreenPlayerRef = useCallback((ref: PlayerRef | null) => {
        const frame = getEditorFrame();
        if (ref) {
            ref.seekTo(frame);
            setPlayer(ref);
        } else {
            setPlayer(mainPlayerRef.current);
            if (mainPlayerRef.current && wasFullscreenRef.current) {
                mainPlayerRef.current.seekTo(frame);
            }
        }
        wasFullscreenRef.current = !!ref;
    }, []);

    // Sync frame to external store (no Editor re-renders) - throttled every 3 frames
    const lastFrameRef = useRef(-1);
    useEffect(() => {
        if (!player) return;

        const handleFrameUpdate = (e: { detail?: { frame?: number } }) => {
            const frame = e.detail?.frame ?? 0;
            currentFrameRef.current = frame;
            if (Math.abs(frame - lastFrameRef.current) >= 3) {
                lastFrameRef.current = frame;
                setEditorFrame(frame);
            }
        };

        const handlePlay = () => { lastFrameRef.current = -1; setIsPlaying(true); };
        const handlePause = () => {
            setIsPlaying(false);
            const f = player.getCurrentFrame?.() ?? lastFrameRef.current;
            if (f >= 0) { setEditorFrame(f); lastFrameRef.current = f; currentFrameRef.current = f; }
        };

        player.addEventListener('frameupdate', handleFrameUpdate);
        player.addEventListener('play', handlePlay);
        player.addEventListener('pause', handlePause);

        return () => {
            player.removeEventListener('frameupdate', handleFrameUpdate);
            player.removeEventListener('play', handlePlay);
            player.removeEventListener('pause', handlePause);
        };
    }, [player]);

    const seek = useCallback((frame: number) => {
        setEditorFrame(frame);
        currentFrameRef.current = frame;
        if (player) player.seekTo(frame);
    }, [player]);

    const togglePlay = useCallback(() => {
        if (player) {
            if (isPlaying) {
                player.pause();
            } else {
                player.play();
            }
            // Let event listener handle state
        }
    }, [player, isPlaying]);

    return {
        player,
        isPlaying,
        currentFrameRef,
        onMainPlayerRef,
        onFullscreenPlayerRef,
        seek,
        togglePlay,
    };
}
