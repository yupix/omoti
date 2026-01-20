import React, { useRef, useState, useEffect } from 'react';
import { Clip, Track } from '@/types';
import { cn } from '@/lib/utils';
import { useCurrentFrame } from 'remotion';

interface TimelineProps {
    tracks: Track[];
    clips: Clip[];
    currentFrame: number;
    onSeek: (frame: number) => void;
    onClipClick: (clipId: string) => void;
    selectedClipId: string | null;
    totalFrames: number;
}

const FRAME_WIDTH = 2; // px per frame
const TRACK_HEIGHT = 48; // px
const HEADER_HEIGHT = 32; // px

export const Timeline: React.FC<TimelineProps> = ({
    tracks,
    clips,
    currentFrame,
    onSeek,
    onClipClick,
    selectedClipId,
    totalFrames,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollLeft, setScrollLeft] = useState(0);

    // Sync scroll
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollLeft(e.currentTarget.scrollLeft);
    };

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // If clicked on empty space (not clip), verify if header seek interaction
        // This is handled by specific click handlers usually, but here:
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollLeft;
        const frame = Math.max(0, Math.floor((x - 200) / FRAME_WIDTH)); // 200 is sidebar width offset in timeline
        // onSeek(frame); // simplified seeking
    };

    const handleHeaderClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollLeft;
        const frame = Math.max(0, Math.floor(x / FRAME_WIDTH));
        onSeek(frame);
    }

    return (
        <div className="flex flex-col h-full w-full bg-background border-t border-border select-none">
            {/* Tools / Header */}
            <div className="h-10 border-b border-border bg-card flex items-center px-4 justify-between">
                <span className="text-xs text-muted-foreground font-mono">Timeline ({totalFrames} frames)</span>
                <div className="text-xs text-muted-foreground">
                    Scale: {FRAME_WIDTH}px/frame
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Track Headers (Left Sidebar) */}
                <div className="w-48 flex-shrink-0 bg-card border-r border-border z-10 shadow-lg">
                    <div className="h-8 border-b border-border bg-muted/50" /> {/* Ruler data placeholder */}
                    {tracks.map(track => (
                        <div key={track.id} className="h-12 border-b border-border/50 flex items-center px-3 text-xs font-medium text-muted-foreground">
                            {track.name}
                        </div>
                    ))}
                </div>

                {/* Timeline Content */}
                <div
                    className="flex-1 overflow-x-auto overflow-y-hidden relative bg-stone-900/50"
                    ref={containerRef}
                    onScroll={handleScroll}
                >
                    <div style={{ width: `${totalFrames * FRAME_WIDTH}px`, minWidth: '100%' }} className="relative">

                        {/* Ruler */}
                        <div
                            className="h-8 border-b border-border bg-stone-900 cursor-pointer sticky top-0 z-10"
                            onClick={handleHeaderClick}
                        >
                            {/* Ticks generation could be optimized */}
                            {Array.from({ length: Math.ceil(totalFrames / 50) }).map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute h-full border-l border-border/50 text-[10px] text-muted-foreground pl-1 pt-1"
                                    style={{ left: i * 50 * FRAME_WIDTH }}
                                >
                                    {i * 50}
                                </div>
                            ))}
                        </div>

                        {/* Tracks & Clips */}
                        <div className="relative" onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                onClipClick('');
                            }
                        }}>
                            {/* Playhead Line */}
                            <div
                                className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none"
                                style={{ left: currentFrame * FRAME_WIDTH, height: tracks.length * TRACK_HEIGHT }}
                            >
                                <div className="size-2 bg-red-500 rounded-full -ml-[3.5px] -mt-1" />
                            </div>

                            {tracks.map(track => (
                                <div key={track.id} className="h-12 border-b border-border/20 relative w-full">
                                    {/* Grid lines */}
                                    {clips.filter(c => c.trackId === track.id).map(clip => (
                                        <div
                                            key={clip.id}
                                            className={cn(
                                                "absolute top-1 bottom-1 rounded-md border text-xs flex items-center px-2 truncate cursor-pointer transition-all",
                                                clip.type === 'text' ? "bg-blue-500/20 border-blue-500/50 text-blue-100" :
                                                    clip.type === 'image' ? "bg-green-500/20 border-green-500/50 text-green-100" :
                                                        "bg-purple-500/20 border-purple-500/50 text-purple-100",
                                                selectedClipId === clip.id ? "ring-2 ring-white border-transparent z-20" : "hover:brightness-110 opacity-90"
                                            )}
                                            style={{
                                                left: clip.startFrame * FRAME_WIDTH,
                                                width: clip.durationInFrames * FRAME_WIDTH,
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onClipClick(clip.id);
                                            }}
                                        >
                                            {clip.title || clip.content}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
