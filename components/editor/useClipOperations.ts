"use client";

import { useCallback } from 'react';
import { Clip, Track, ClipType } from '@/types';
import { getSnapshot as getEditorFrame } from './editorFrameStore';

const generateId = () => Math.random().toString(36).substring(2, 11);

export function useClipOperations({
    clips,
    setClips,
    tracks,
    setTracks,
    selectedClipId,
    setSelectedClipId,
    currentFrameRef,
    totalFrames,
}: {
    clips: Clip[];
    setClips: React.Dispatch<React.SetStateAction<Clip[]>>;
    tracks: Track[];
    setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
    selectedClipId: string | null;
    setSelectedClipId: React.Dispatch<React.SetStateAction<string | null>>;
    currentFrameRef: React.RefObject<number>;
    totalFrames: number;
}) {
    const updateClip = useCallback(<K extends keyof Clip>(key: K, value: Clip[K]) => {
        if (!selectedClipId) return;
        setClips(prev => prev.map(c => c.id === selectedClipId ? { ...c, [key]: value } : c));
    }, [selectedClipId, setClips]);

    const batchUpdateClip = useCallback((updates: Partial<Clip>) => {
        if (!selectedClipId) return;
        setClips(prev => prev.map(c => c.id === selectedClipId ? { ...c, ...updates } : c));
    }, [selectedClipId, setClips]);

    const updateStyle = useCallback((key: string, value: unknown) => {
        if (!selectedClipId) return;
        setClips(prev => prev.map(c =>
            c.id === selectedClipId
                ? { ...c, style: { ...c.style, [key]: value } as React.CSSProperties }
                : c
        ));
    }, [selectedClipId, setClips]);

    const updateAnimation = useCallback((key: string, value: unknown) => {
        if (!selectedClipId) return;
        setClips(prev => prev.map(c => {
            if (c.id === selectedClipId) {
                const currentAnim = c.animation || { type: 'none' as const, duration: 0 };
                const newAnimation = {
                    ...currentAnim,
                    [key]: value
                } as Clip['animation'];
                return { ...c, animation: newAnimation };
            }
            return c;
        }));
    }, [selectedClipId, setClips]);

    const checkCollision = useCallback((id: string, start: number, duration: number, track: number) => {
        const end = start + duration;
        return clips.some(c =>
            c.id !== id &&
            c.trackId === track &&
            start < (c.startFrame + c.durationInFrames) &&
            end > c.startFrame
        );
    }, [clips]);

    const addClip = useCallback((type: ClipType, contentOverride?: string, durationOverride?: number, startFrameOverride?: number, trackIdOverride?: number, widthOverride?: number, heightOverride?: number) => {
        const duration = durationOverride ? Math.ceil(durationOverride * 30) : 60;
        let start = startFrameOverride ?? currentFrameRef.current;
        let trackId = trackIdOverride ?? (type === 'text' || type === 'code' ? 1 : type === 'audio' ? 3 : 2);

        // Find next available slot if collision
        // If we have a specific start frame but it collides, try to find ANY track that fits
        if (startFrameOverride !== undefined && trackIdOverride === undefined) {
            if (checkCollision('new', start, duration, trackId)) {
                // Try tracks 1-10 to see if any have space
                let found = false;
                for (let tId = 1; tId <= 10; tId++) {
                    if (!checkCollision('new', start, duration, tId)) {
                        trackId = tId;
                        found = true;
                        break;
                    }
                }

                // If we found a track that wasn't previously in tracks, add it
                if (found && !tracks.find(t => t.id === trackId)) {
                    setTracks(prev => [...prev, { id: trackId, name: `Track ${trackId}` }]);
                }

                // If still not found after checking 10 tracks, we'll try to shift it slightly (auto-resolve)
                // instead of strictly failing
                if (!found) {
                    while (checkCollision('new', start, duration, trackId)) {
                        start += 5;
                        if (start > totalFrames) break;
                    }
                }
            }
        }

        if (startFrameOverride === undefined) {
            let attempts = 0;
            while (checkCollision('new', start, duration, trackId) && attempts < 100) {
                // Move to end of the colliding clip
                const collidingClip = clips.find(c =>
                    c.trackId === trackId &&
                    start < (c.startFrame + c.durationInFrames) &&
                    (start + duration) > c.startFrame
                );
                if (collidingClip) {
                    start = collidingClip.startFrame + collidingClip.durationInFrames;
                } else {
                    start += 10; // Fallback
                }
                attempts++;
            }
        } else {
            // Check collision for explicit drop/placement
            if (checkCollision('new', start, duration, trackId)) {
                // Last ditch effort: try to shift it
                let currentStart = start;
                let shifted = false;
                for (let i = 0; i < 50; i++) {
                    currentStart += 1;
                    if (!checkCollision('new', currentStart, duration, trackId)) {
                        start = currentStart;
                        shifted = true;
                        break;
                    }
                }

                if (!shifted) {
                    alert("Notice: Could not find a perfectly free spot, placing with potential overlap.");
                }
            }
        }

        let finalW = widthOverride ?? ((type === 'text') ? 800 : (type === 'code' || type === 'flow') ? 600 : (type === 'image' || type === 'tachie' || type === 'video') ? 600 : (type === 'icon') ? 100 : undefined);
        let finalH = heightOverride ?? ((type === 'text') ? 200 : (type === 'code' || type === 'flow') ? 400 : (type === 'image' || type === 'tachie' || type === 'video') ? 600 : (type === 'icon') ? 100 : undefined);

        if (finalW !== undefined && finalH !== undefined && (type === 'image' || type === 'video' || type === 'tachie')) {
            const FIT_W = 1200; // Leave some margin
            const FIT_H = 650;
            if (finalW > FIT_W || finalH > FIT_H) {
                const ratio = Math.min(FIT_W / finalW, FIT_H / finalH);
                finalW = Math.round(finalW * ratio);
                finalH = Math.round(finalH * ratio);
            }
        }

        const newClip: Clip = {
            id: generateId(),
            type,
            trackId,
            startFrame: start, // Place at valid spot
            durationInFrames: duration,
            width: finalW,
            height: finalH,
            x: (type === 'text') ? 240 : (type === 'code' || type === 'flow') ? 340 : (type === 'image' || type === 'tachie' || type === 'video') ? Math.max(0, (1280 - (finalW ?? 600)) / 2) : (type === 'icon') ? Math.max(0, (1280 - (finalW ?? 100)) / 2) : undefined,
            y: (type === 'text') ? 500 : (type === 'code' || type === 'flow') ? 160 : (type === 'image' || type === 'tachie' || type === 'video') ? Math.max(0, (720 - (finalH ?? 600)) / 2) : (type === 'icon') ? Math.max(0, (720 - (finalH ?? 100)) / 2) : undefined,
            content: contentOverride || (
                type === 'text' ? 'New Text' :
                    type === 'audio' ? 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' :
                        type === 'shape' ? 'rect' :
                            type === 'code' ? 'console.log("Hello World");' :
                                type === 'flow' ? 'New Flow' :
                                    type === 'icon' ? 'lucide:star' :
                                        'https://picsum.photos/seed/picsum/800/450'
            ),
            title: `New ${contentOverride || type}`,
            style: type === 'shape' ? { backgroundColor: '#ffffff' } : type === 'icon' ? { color: '#ffffff' } : {},
            animation: { type: 'none', duration: 0 }, // Default animation
            language: type === 'code' ? 'typescript' : undefined,
            steps: type === 'code' ? [{ code: 'console.log("Hello World");', frameOffset: 0 }] : undefined,
            nodes: type === 'flow' ? [
                { id: '1', data: { label: 'Node 1' }, position: { x: 50, y: 50 } },
                { id: '2', data: { label: 'Node 2' }, position: { x: 200, y: 150 } },
            ] : undefined,
            edges: type === 'flow' ? [
                { id: 'e1-2', source: '1', target: '2' },
            ] : undefined,
            facing: type === 'tachie' ? 'right' : undefined,
            mirror: false,
        };
        setClips(prev => [...prev, newClip]);
        setSelectedClipId(newClip.id);
    }, [checkCollision, clips, tracks, setTracks, currentFrameRef, totalFrames, setClips, setSelectedClipId]);

    const removeClip = useCallback(() => {
        if (!selectedClipId) return;
        setClips(prev => prev.filter(c => c.id !== selectedClipId));
        setSelectedClipId(null);
    }, [selectedClipId, setClips, setSelectedClipId]);

    const deleteClip = useCallback((clipId: string) => {
        setClips(prev => prev.filter(c => c.id !== clipId));
    }, [setClips]);

    const moveClip = useCallback((clipId: string, newStartFrame: number, newTrackId: number) => {
        const clip = clips.find(c => c.id === clipId);
        if (!clip) return;

        const start = Math.max(0, newStartFrame);

        // Check collision
        if (checkCollision(clipId, start, clip.durationInFrames, newTrackId)) {
            return;
        }

        setClips(prev => prev.map(c => {
            if (c.id === clipId) {
                return {
                    ...c,
                    startFrame: start,
                    trackId: newTrackId
                };
            }
            return c;
        }));
    }, [clips, checkCollision, setClips]);

    const resizeClip = useCallback((clipId: string, newStartFrame: number, newDuration: number) => {
        const clip = clips.find(c => c.id === clipId);
        if (!clip) return;

        const start = Math.max(0, newStartFrame);
        const duration = Math.max(1, newDuration);

        // Check collision
        if (checkCollision(clipId, start, duration, clip.trackId)) {
            return;
        }

        setClips(prev => prev.map(c => (c.id === clipId ? { ...c, startFrame: start, durationInFrames: duration } : c)));
    }, [clips, checkCollision, setClips]);

    const splitClip = useCallback((clipId: string) => {
        const clip = clips.find(c => c.id === clipId);
        if (!clip) return;

        // Check if playhead is within clip
        const frame = getEditorFrame();
        if (frame <= clip.startFrame || frame >= clip.startFrame + clip.durationInFrames) {
            alert("Playhead must be inside the clip to split.");
            return;
        }

        const splitOffset = frame - clip.startFrame;
        const firstPartDuration = splitOffset;
        const secondPartDuration = clip.durationInFrames - splitOffset;
        const secondPartStart = frame;

        // Validate min duration (e.g., 1 frame)
        if (firstPartDuration < 1 || secondPartDuration < 1) return;

        // Create second clip
        const newClip: Clip = {
            ...clip,
            id: generateId(),
            startFrame: secondPartStart,
            durationInFrames: secondPartDuration,
            mediaStartOffset: (clip.mediaStartOffset || 0) + splitOffset,
            title: `${clip.title} (Part 2)`
        };

        // Update first clip
        setClips(prev => {
            const updated = prev.map(c =>
                c.id === clipId
                    ? { ...c, durationInFrames: firstPartDuration, title: `${clip.title} (Part 1)` }
                    : c
            );
            return [...updated, newClip];
        });
        setSelectedClipId(newClip.id);
    }, [clips, setClips, setSelectedClipId]);

    const duplicateClip = useCallback((clipId: string) => {
        const clip = clips.find(c => c.id === clipId);
        if (!clip) return;

        const newClip = {
            ...clip,
            id: generateId(),
            startFrame: clip.startFrame + clip.durationInFrames, // Place right after
            title: `${clip.title} (Copy)`
        };

        // Simple collision check for duplicate
        let start = newClip.startFrame;
        let attempts = 0;
        while (checkCollision('duplicate', start, newClip.durationInFrames, newClip.trackId) && attempts < 100) {
            start += 10;
            attempts++;
        }
        newClip.startFrame = start;

        setClips(prev => [...prev, newClip]);
    }, [clips, checkCollision, setClips]);

    return {
        updateClip,
        batchUpdateClip,
        updateStyle,
        updateAnimation,
        checkCollision,
        addClip,
        removeClip,
        deleteClip,
        moveClip,
        resizeClip,
        splitClip,
        duplicateClip,
    };
}
