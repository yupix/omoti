"use client";

import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FrameDisplay } from './EditorFrameComponents';

export function TransportControls({
    isPlaying,
    onTogglePlay,
    onSeek,
    totalFrames,
}: {
    isPlaying: boolean;
    onTogglePlay: () => void;
    onSeek: (frame: number) => void;
    totalFrames: number;
}) {
    return (
        <div className="h-12 bg-card border-t border-border flex items-center justify-center gap-4 z-20 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => onSeek(0)}>
                <SkipBack size={18} />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-primary/50 bg-primary/10 text-primary hover:bg-primary/20" onClick={onTogglePlay}>
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onSeek(totalFrames)}>
                <SkipForward size={18} />
            </Button>
            <div className="absolute right-4">
                <FrameDisplay totalFrames={totalFrames} />
            </div>
        </div>
    );
}
