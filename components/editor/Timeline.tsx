import React, { useRef, useState, useEffect } from 'react';
import { Clip, Track } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

interface TimelineProps {
    tracks: Track[];
    clips: Clip[];
    currentFrame: number;
    onSeek: (frame: number) => void;
    onClipClick: (clipId: string) => void;
    onClipMove: (clipId: string, newStartFrame: number, newTrackId: number) => void;
    onAddTrack: () => void;
    onUpdateTrackName: (id: number, newName: string) => void;
    onRemoveTrack: (id: number) => void;
    selectedClipId: string | null;
    totalFrames: number;
}

const FRAME_WIDTH = 2; // px per frame
const TRACK_HEIGHT = 48; // px
const HEADER_WIDTH = 192; // w-48 = 192px
const RULER_HEIGHT = 32; // px

export const Timeline: React.FC<TimelineProps> = ({
    tracks,
    clips,
    currentFrame,
    onSeek,
    onClipClick,
    onClipMove,
    onAddTrack,
    onUpdateTrackName,
    onRemoveTrack,
    selectedClipId,
    totalFrames,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [dragState, setDragState] = useState<{ id: string; startX: number; startFrame: number; } | null>(null);

    // Global Mouse Handlers for Dragging
    useEffect(() => {
        if (!dragState) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current || !contentRef.current) return;

            // 1. Calculate Frame Delta
            const deltaX = e.clientX - dragState.startX;
            const deltaFrames = Math.round(deltaX / FRAME_WIDTH);
            const newStartFrame = Math.max(0, dragState.startFrame + deltaFrames);

            // 2. Calculate Track Drop (Vertical)
            const containerRect = containerRef.current.getBoundingClientRect();
            // e.clientY is relative to viewport.
            // containerRect.top is the top of the scrollable container in viewport.
            // containerRef.current.scrollTop is how much the container has scrolled.
            // RULER_HEIGHT is the fixed height of the ruler at the top.
            const relativeYInScrollableArea = e.clientY - containerRect.top + containerRef.current.scrollTop;
            const trackIndex = Math.floor((relativeYInScrollableArea - RULER_HEIGHT) / TRACK_HEIGHT);

            if (trackIndex >= 0 && trackIndex < tracks.length) {
                const targetTrack = tracks[trackIndex];
                onClipMove(dragState.id, newStartFrame, targetTrack.id);
            } else {
                // If outside valid track area, keep clip on its original track (or closest?)
                // For now, keep visual feedback consistent with logic: update StartFrame but keep TrackId
                const clip = clips.find(c => c.id === dragState.id);
                if (clip) onClipMove(dragState.id, newStartFrame, clip.trackId);
            }
        };

        const handleMouseUp = () => {
            setDragState(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, clips, onClipMove, tracks]);


    const handleHeaderClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left; // x relative to ruler start
        const frame = Math.max(0, Math.floor(x / FRAME_WIDTH));
        onSeek(frame);
    }

    return (
        <div
            className="flex flex-col h-full w-full bg-background border-t border-border select-none overflow-hidden"
        >
            {/* Toolbar */}
            <div className="h-10 border-b border-border bg-card flex items-center px-4 justify-between flex-shrink-0 z-30 relative">
                <span className="text-xs text-muted-foreground font-mono">Timeline ({totalFrames} frames)</span>
                <div className="text-xs text-muted-foreground">
                    Scale: {FRAME_WIDTH}px/frame
                </div>
            </div>

            {/* Scrollable Area */}
            <div
                className="flex-1 overflow-auto relative bg-stone-900/50"
                ref={containerRef}
            >
                <div style={{ width: Math.max(1000, totalFrames * FRAME_WIDTH + HEADER_WIDTH) }} className="min-w-full relative flex flex-col">

                    {/* Ruler Row (Sticky Top) */}
                    <div className="h-8 border-b border-border bg-stone-900 sticky top-0 z-20 flex">
                        <div className="w-48 flex-shrink-0 border-r border-border bg-muted/20 sticky left-0 z-30" />
                        <div
                            className="flex-1 relative cursor-pointer"
                            onClick={handleHeaderClick}
                        >
                            {Array.from({ length: Math.ceil(totalFrames / 50) }).map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute h-full border-l border-border/50 text-[10px] text-muted-foreground pl-1 pt-1 pointer-events-none"
                                    style={{ left: i * 50 * FRAME_WIDTH }}
                                >
                                    {i * 50}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tracks Container */}
                    <div className="flex flex-col relative" ref={contentRef}>
                        {/* Playhead Line (Absolute overlay over tracks) */}
                        <div
                            className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
                            style={{ left: HEADER_WIDTH + (currentFrame * FRAME_WIDTH) }}
                        >
                            <div className="size-2 bg-red-500 rounded-full -ml-[3.5px] -mt-1" />
                        </div>

                        {tracks.map(track => (
                            <div key={track.id} className="h-12 border-b border-border/20 flex relative group hover:bg-white/5 transition-colors">
                                {/* Track Header (Sticky Left) */}
                                <div className="w-48 flex-shrink-0 bg-card border-r border-border sticky left-0 z-10 flex items-center px-2 gap-2 group/header">
                                    <input
                                        className="bg-transparent border-none text-xs font-medium text-muted-foreground w-full focus:text-foreground focus:outline-none"
                                        value={track.name}
                                        onChange={(e) => onUpdateTrackName(track.id, e.target.value)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover/header:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                                        onClick={() => onRemoveTrack(track.id)}
                                    >
                                        <X size={12} />
                                    </Button>
                                </div>

                                {/* Track Lane Content */}
                                <div className="flex-1 relative">
                                    {/* Grid Lines/Background for track */}
                                    <div className="absolute inset-0 pointer-events-none" />

                                    {/* Clips */}
                                    {clips.filter(c => c.trackId === track.id).map(clip => (
                                        <div
                                            key={clip.id}
                                            className={cn(
                                                "absolute top-1 bottom-1 rounded-md border text-xs flex items-center px-2 truncate cursor-pointer transition-all",
                                                clip.type === 'text' ? "bg-blue-500/20 border-blue-500/50 text-blue-100" :
                                                    clip.type === 'image' ? "bg-green-500/20 border-green-500/50 text-green-100" :
                                                        clip.type === 'audio' ? "bg-amber-500/20 border-amber-500/50 text-amber-100" :
                                                            clip.type === 'shape' ? "bg-pink-500/20 border-pink-500/50 text-pink-100" :
                                                                "bg-purple-500/20 border-purple-500/50 text-purple-100",
                                                selectedClipId === clip.id ? "ring-2 ring-white border-transparent z-20" : "hover:brightness-110 opacity-90",
                                                dragState?.id === clip.id ? "opacity-70 cursor-grabbing shadow-xl ring-2 ring-primary scale-[1.02] z-50" : ""
                                            )}
                                            style={{
                                                left: clip.startFrame * FRAME_WIDTH,
                                                width: clip.durationInFrames * FRAME_WIDTH,
                                            }}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                onClipClick(clip.id);
                                                setDragState({ id: clip.id, startX: e.clientX, startFrame: clip.startFrame });
                                            }}
                                        >
                                            {clip.title || clip.content}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Add Track Button Row */}
                        <div className="h-12 border-b border-border/20 flex relative">
                            <div className="w-48 flex-shrink-0 bg-card/50 border-r border-border sticky left-0 z-10 flex items-center px-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-xs text-muted-foreground hover:text-foreground pl-0 h-8"
                                    onClick={onAddTrack}
                                >
                                    <Plus className="size-3 mr-2" />
                                    Add Track
                                </Button>
                            </div>
                            <div className="flex-1 bg-transparent" />
                        </div>

                        {/* Extra space at bottom */}
                        <div className="h-24 w-full" />
                    </div>
                </div>
            </div>
        </div>
    );
};
