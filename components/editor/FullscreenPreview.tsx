"use client";

import { Player, PlayerRef } from '@remotion/player';
import { useTranslation } from 'react-i18next';
import { Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResultVideo, type ResultVideoProps } from '@/remotion/ResultVideo';
import { FrameSeekBar, FullscreenFrameDisplay } from './EditorFrameComponents';

export function FullscreenPreview({
    playerRef,
    inputProps,
    totalFrames,
    isPlaying,
    onTogglePlay,
    onSeek,
    onClose,
}: {
    playerRef: (ref: PlayerRef | null) => void;
    inputProps: ResultVideoProps;
    totalFrames: number;
    isPlaying: boolean;
    onTogglePlay: () => void;
    onSeek: (frame: number) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black">
            <div className="absolute top-4 right-4 z-50">
                <Button
                    variant="secondary"
                    size="icon"
                    className="h-10 w-10 rounded-md bg-white/10 hover:bg-white/20 border border-white/20"
                    onClick={onClose}
                    title={t('editor.preview.exitFullscreen')}
                >
                    <X size={20} />
                </Button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                <div className="w-full h-full max-w-[calc(100vh*16/9)] max-h-full aspect-video flex justify-center items-center">
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
                </div>
            </div>
            <div className="px-4 py-3 bg-black/80 border-t border-white/10 shrink-0 space-y-2">
                <FrameSeekBar
                    totalFrames={totalFrames}
                    onSeek={onSeek}
                    className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                />
                <div className="flex items-center justify-center gap-4">
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => onSeek(0)}>
                        <SkipBack size={20} />
                    </Button>
                    <Button variant="outline" size="icon" className="rounded-full h-12 w-12 border-primary/50 bg-primary/20 text-primary hover:bg-primary/30" onClick={onTogglePlay}>
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => onSeek(totalFrames)}>
                        <SkipForward size={20} />
                    </Button>
                    <div className="ml-4">
                        <FullscreenFrameDisplay totalFrames={totalFrames} />
                    </div>
                </div>
            </div>
        </div>
    );
}
