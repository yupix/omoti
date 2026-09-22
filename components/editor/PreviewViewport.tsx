"use client";

import { Player, PlayerRef } from '@remotion/player';
import { useTranslation } from 'react-i18next';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Clip } from '@/types';
import { ResultVideo, type ResultVideoProps } from '@/remotion/ResultVideo';
import { PreviewClipOverlays } from './EditorFrameComponents';
import { InteractOverlay } from './InteractOverlay';

export function PreviewViewport({
    playerRef,
    showPlayer,
    inputProps,
    totalFrames,
    clips,
    selectedClip,
    selectedClipId,
    onClipClick,
    onBackgroundClick,
    onUpdateClip,
    onFullscreen,
}: {
    playerRef: (ref: PlayerRef | null) => void;
    showPlayer: boolean;
    inputProps: ResultVideoProps;
    totalFrames: number;
    clips: Clip[];
    selectedClip: Clip | undefined;
    selectedClipId: string | null;
    onClipClick: (id: string) => void;
    onBackgroundClick: () => void;
    onUpdateClip: (updates: Partial<Clip>) => void;
    onFullscreen: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex-1 flex items-center justify-center bg-stone-950/20 p-8 overflow-hidden relative" onClick={onBackgroundClick}>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
            {/* Grid pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] pointer-events-none" />
            {/* Fullscreen toggle */}
            <Button
                variant="secondary"
                size="icon"
                className="absolute top-4 right-4 z-30 h-9 w-9 rounded-md bg-black/60 hover:bg-black/80 border border-white/10"
                onClick={(e) => { e.stopPropagation(); onFullscreen(); }}
                title={t('editor.preview.fullscreen')}
            >
                <Maximize2 size={16} />
            </Button>
            {/* Video Player - skip when fullscreen to avoid double Player render */}
            <div className="relative shadow-2xl rounded-sm overflow-hidden border border-white/10 bg-black h-full max-w-full aspect-video flex justify-center items-center">
                {showPlayer && (
                    <Player
                        ref={playerRef}
                        component={ResultVideo}
                        inputProps={inputProps}
                        durationInFrames={totalFrames}
                        compositionWidth={1280}
                        compositionHeight={720}
                        fps={30}
                        controls={false}
                        style={{
                            width: '100%',
                            height: '100%',
                        }}
                    />
                )}
                <PreviewClipOverlays
                    clips={clips}
                    selectedClipId={selectedClipId}
                    onClipClick={onClipClick}
                />
                <InteractOverlay
                    clip={selectedClip}
                    onUpdate={onUpdateClip}
                    width={1280}
                    height={720}
                />
            </div>
        </div>
    );
}
