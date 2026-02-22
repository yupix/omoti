"use client";

import React from 'react';
import { useEditorFrame } from './useEditorFrame';
import { Clip } from '@/types';

/** Frame display - only this re-renders when frame changes */
export function FrameDisplay({ totalFrames }: { totalFrames: number }) {
    const currentFrame = useEditorFrame();
    return (
        <span className="text-xs font-mono text-muted-foreground">
            {currentFrame} / {totalFrames} F
        </span>
    );
}

/** Fullscreen frame display */
export function FullscreenFrameDisplay({ totalFrames }: { totalFrames: number }) {
    const currentFrame = useEditorFrame();
    return (
        <span className="text-sm font-mono text-white/70">
            {currentFrame} / {totalFrames} F
        </span>
    );
}

/** Seek bar - only this re-renders when frame changes */
export function FrameSeekBar({
    totalFrames,
    onSeek,
    className,
}: {
    totalFrames: number;
    onSeek: (frame: number) => void;
    className?: string;
}) {
    const currentFrame = useEditorFrame();
    return (
        <input
            type="range"
            min={0}
            max={totalFrames}
            value={currentFrame}
            onChange={(e) => onSeek(Number(e.target.value))}
            className={className}
        />
    );
}

/** Preview clip overlays - only this re-renders when frame changes */
export function PreviewClipOverlays({
    clips,
    selectedClipId,
    onClipClick,
}: {
    clips: Clip[];
    selectedClipId: string | null;
    onClipClick: (id: string) => void;
}) {
    const currentFrame = useEditorFrame();
    return (
        <>
            {clips
                .filter(
                    (c) =>
                        currentFrame >= c.startFrame &&
                        currentFrame < c.startFrame + c.durationInFrames &&
                        c.id !== selectedClipId &&
                        ['text', 'image', 'shape', 'code', 'tachie', 'flow', 'video'].includes(c.type)
                )
                .map((clip) => {
                    const isPositioned =
                        typeof clip.x === 'number' ||
                        typeof clip.y === 'number' ||
                        typeof clip.width === 'number' ||
                        typeof clip.height === 'number';
                    const x = isPositioned ? (clip.x || 0) : 0;
                    const y = isPositioned ? (clip.y || 0) : 0;
                    let width = 1280;
                    let height = 720;

                    if (isPositioned) {
                        width = clip.width || 400;
                        height = clip.height || 400;
                    } else if (clip.type === 'text') {
                        width = 800;
                        height = 200;
                    } else if (clip.type === 'image' || clip.type === 'tachie' || clip.type === 'video') {
                        width = 600;
                        height = 600;
                    }

                    return (
                        <div
                            key={clip.id}
                            style={{
                                position: 'absolute',
                                left: `${(x / 1280) * 100}%`,
                                top: `${(y / 720) * 100}%`,
                                width: `${(width / 1280) * 100}%`,
                                height: `${(height / 720) * 100}%`,
                                zIndex: 40,
                                cursor: 'pointer',
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onClipClick(clip.id);
                            }}
                            className="hover:ring-2 hover:ring-blue-500/30 transition-all rounded-sm"
                        />
                    );
                })}
        </>
    );
}
