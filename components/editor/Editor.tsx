"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { ResultVideo } from '@/remotion/ResultVideo';
import { Card, CardContent, CardHeader, CardTitle, CardTitle as CTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download, Layers, Box, Plus, Trash2, Calendar, FileText, Video as VideoIcon, Image as ImageIcon, Play, Pause, SkipBack, SkipForward, Volume2, Square, Circle, Code2, Smile } from 'lucide-react';
import { Clip, Track, ClipType } from '@/types';
import { Timeline } from './Timeline';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const INITIAL_TRACKS: Track[] = [
    { id: 1, name: 'Overlay Text' },
    { id: 2, name: 'Main Video' },
    { id: 3, name: 'Background' },
];

const INITIAL_CLIPS: Clip[] = [
    { id: 'c1', type: 'text', trackId: 1, startFrame: 0, durationInFrames: 60, content: 'Hello World', title: 'Intro Text' },
    { id: 'c2', type: 'text', trackId: 1, startFrame: 70, durationInFrames: 50, content: 'Omoti Editor', title: 'Brand Text' },
];

export default function Editor() {
    const [primaryColor, setPrimaryColor] = useState('#6d28d9');
    const [tracks] = useState<Track[]>(INITIAL_TRACKS); // Static tracks for now
    const [clips, setClips] = useState<Clip[]>(INITIAL_CLIPS);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

    const [currentFrame, setCurrentFrame] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [player, setPlayer] = useState<PlayerRef | null>(null);

    const totalFrames = 300; // 10 seconds at 30fps

    const selectedClip = clips.find(c => c.id === selectedClipId);

    // Use callback ref to ensure we capture the player instance once it's available
    const onPlayerRef = React.useCallback((ref: PlayerRef) => {
        setPlayer(ref);
    }, []);

    // Sync frame from player
    useEffect(() => {
        if (!player) return;

        const handleFrameUpdate = (e: any) => {
            // @ts-ignore
            setCurrentFrame(e.detail.frame);
        };

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        player.addEventListener('frameupdate', handleFrameUpdate);
        player.addEventListener('play', handlePlay);
        player.addEventListener('pause', handlePause);

        return () => {
            player.removeEventListener('frameupdate', handleFrameUpdate);
            player.removeEventListener('play', handlePlay);
            player.removeEventListener('pause', handlePause);
        }
    }, [player]);

    const handleUpdateClip = (key: keyof Clip, value: any) => {
        if (!selectedClipId) return;
        setClips(clips.map(c => c.id === selectedClipId ? { ...c, [key]: value } : c));
    };

    const handleUpdateStyle = (key: string, value: any) => {
        if (!selectedClip) return;
        const newStyle = { ...selectedClip.style, [key]: value };
        handleUpdateClip('style', newStyle);
    };

    const handleUpdateAnimation = (key: string, value: any) => {
        if (!selectedClip) return;
        const newAnimation = { ...selectedClip.animation, [key]: value };
        // Ensure defaults if adding animation for first time
        if (!selectedClip.animation && !newAnimation.duration) newAnimation.duration = 10;
        if (!selectedClip.animation && !newAnimation.type) newAnimation.type = 'fade';
        handleUpdateClip('animation', newAnimation);
    };

    const addClip = (type: ClipType, contentOverride?: string) => {
        const newClip: Clip = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            trackId: type === 'text' || type === 'code' ? 1 : type === 'audio' ? 3 : 2,
            startFrame: currentFrame, // Place at playhead
            durationInFrames: 60,
            content: contentOverride || (
                type === 'text' ? 'New Text' :
                    type === 'audio' ? 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' :
                        type === 'shape' ? 'rect' :
                            type === 'code' ? 'console.log("Hello World");' :
                                'https://picsum.photos/seed/picsum/800/450'
            ),
            title: `New ${contentOverride || type}`,
            style: type === 'shape' ? { backgroundColor: '#ffffff' } : {},
            animation: { type: 'fade', duration: 15 }, // Default animation
        };
        setClips([...clips, newClip]);
        setSelectedClipId(newClip.id);
    };

    const removeClip = () => {
        if (!selectedClipId) return;
        setClips(clips.filter(c => c.id !== selectedClipId));
        setSelectedClipId(null);
    };

    const handleSeek = (frame: number) => {
        if (player) {
            player.seekTo(frame);
        }
    };

    const togglePlay = () => {
        if (player) {
            if (isPlaying) {
                player.pause();
            } else {
                player.play();
            }
            // setIsPlaying(!isPlaying); // Let event listener handle state
        }
    }

    return (
        <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans">

            {/* Top Section: Sidebar + Preview */}
            <div className="flex flex-1 min-h-0">
                {/* Sidebar */}
                <aside className="w-80 border-r border-border bg-card flex flex-col z-20 shadow-xl overflow-hidden">
                    <div className="p-4 border-b border-border flex items-center gap-3 bg-card sticky top-0">
                        <div className="size-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(109,40,217,0.5)]">
                            <Box className="text-primary-foreground fill-current" size={18} />
                        </div>
                        <h1 className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Omoti</h1>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {selectedClip ? (
                            <div className="space-y-4 animate-in slide-in-from-left duration-300">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Properties</h2>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/20" onClick={removeClip}>
                                        <Trash2 size={14} />
                                    </Button>
                                </div>

                                <Card className="bg-secondary/20 border-border/40">
                                    <CardHeader className="p-3 pb-0">
                                        <CardTitle className="text-xs font-medium text-muted-foreground">Content</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3 space-y-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">Label</Label>
                                            <Input
                                                value={selectedClip.title || ''}
                                                onChange={e => handleUpdateClip('title', e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">Value</Label>
                                            {selectedClip.type === 'code' ? (
                                                <textarea
                                                    value={selectedClip.content}
                                                    onChange={e => handleUpdateClip('content', e.target.value)}
                                                    className="w-full h-24 p-2 text-xs font-mono bg-background border border-input rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                                                />
                                            ) : (
                                                <Input
                                                    value={selectedClip.content}
                                                    onChange={e => handleUpdateClip('content', e.target.value)}
                                                    className="h-8 text-sm font-mono"
                                                />
                                            )}
                                        </div>
                                        {/* Style Properties */}
                                        {(selectedClip.type === 'shape' || selectedClip.type === 'text') && (
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Color</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="color"
                                                        value={(selectedClip.style?.backgroundColor as string) || (selectedClip.style?.color as string) || '#ffffff'}
                                                        onChange={e => handleUpdateStyle(selectedClip.type === 'text' ? 'color' : 'backgroundColor', e.target.value)}
                                                        className="w-10 h-8 p-1 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Animation Card */}
                                <Card className="bg-secondary/20 border-border/40">
                                    <CardHeader className="p-3 pb-0">
                                        <CardTitle className="text-xs font-medium text-muted-foreground">Animation (Transition)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3 space-y-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">Type</Label>
                                            <Select value={selectedClip.animation?.type || 'none'} onValueChange={(val) => handleUpdateAnimation('type', val)}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="None" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    <SelectItem value="fade">Fade In/Out</SelectItem>
                                                    <SelectItem value="pop">Pop (Scale)</SelectItem>
                                                    <SelectItem value="slide">Slide Up</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">Duration (Frames)</Label>
                                            <Input
                                                type="number"
                                                value={selectedClip.animation?.duration || 0}
                                                onChange={e => handleUpdateAnimation('duration', Number(e.target.value))}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-secondary/20 border-border/40">
                                    <CardHeader className="p-3 pb-0">
                                        <CardTitle className="text-xs font-medium text-muted-foreground">Timing</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3 space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Start</Label>
                                                <Input
                                                    type="number"
                                                    value={selectedClip.startFrame}
                                                    onChange={e => handleUpdateClip('startFrame', Number(e.target.value))}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Measured</Label>
                                                <Input
                                                    type="number"
                                                    value={selectedClip.durationInFrames}
                                                    onChange={e => handleUpdateClip('durationInFrames', Number(e.target.value))}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-2 opacity-50">
                                <Layers size={32} />
                                <p className="text-sm">Select a clip to edit</p>
                            </div>
                        )}

                        <div className="pt-4 border-t border-border/50">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Add Element</h2>
                            <div className="grid grid-cols-4 gap-2">
                                <Button variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10" onClick={() => addClip('text')}>
                                    <FileText size={16} />
                                    <span className="text-[10px]">Text</span>
                                </Button>
                                <Button variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10" onClick={() => addClip('video')}>
                                    <VideoIcon size={16} />
                                    <span className="text-[10px]">Video</span>
                                </Button>
                                <Button variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10" onClick={() => addClip('image')}>
                                    <ImageIcon size={16} />
                                    <span className="text-[10px]">Image</span>
                                </Button>
                                <Button variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10" onClick={() => addClip('audio')}>
                                    <Volume2 size={16} />
                                    <span className="text-[10px]">Audio</span>
                                </Button>
                                <Button variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10" onClick={() => addClip('shape', 'rect')}>
                                    <Square size={16} />
                                    <span className="text-[10px]">Rect</span>
                                </Button>
                                <Button variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10" onClick={() => addClip('shape', 'circle')}>
                                    <Circle size={16} />
                                    <span className="text-[10px]">Circle</span>
                                </Button>
                                <Button variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10" onClick={() => addClip('code')}>
                                    <Code2 size={16} />
                                    <span className="text-[10px]">Code</span>
                                </Button>
                                <Button variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10" onClick={() => addClip('image', 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2E5eG56eG56eG56eG56eG56eG56eG56eG5/3o7aD2saalBwwftBIY/giphy.gif')}>
                                    <Smile size={16} />
                                    <span className="text-[10px]">GIF</span>
                                </Button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border/50">
                            <Label className="text-xs text-muted-foreground mb-2 block">Global Color</Label>
                            <div className="flex gap-2">
                                <div className="relative">
                                    <Input
                                        type="color"
                                        value={primaryColor}
                                        onChange={e => setPrimaryColor(e.target.value)}
                                        className="w-10 h-8 p-1 cursor-pointer rounded-md overflow-hidden"
                                    />
                                </div>
                                <Input
                                    value={primaryColor}
                                    onChange={e => setPrimaryColor(e.target.value)}
                                    className="flex-1 h-8 font-mono uppercase bg-background/50 border-border/50"
                                />
                            </div>
                        </div>

                    </div>
                </aside>

                {/* Preview Area */}
                <main className="flex-1 flex flex-col bg-stone-950 relative overflow-hidden">
                    <header className="h-14 border-b border-border/50 flex items-center justify-between px-6 bg-background/80 backdrop-blur-md z-10">
                        <div className="text-sm text-muted-foreground">
                            Project: <span className="text-foreground font-medium">New Video 01</span>
                        </div>
                        <Button className="h-8 shadow-[0_0_20px_rgba(109,40,217,0.3)]" size="sm">
                            <Download className="mr-2 size-3" /> Export
                        </Button>
                    </header>

                    <div className="flex-1 flex flex-col relative">
                        {/* Viewport */}
                        <div className="flex-1 flex items-center justify-center bg-stone-950/20 p-8 overflow-hidden relative" onClick={() => setSelectedClipId(null)}>
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
                            {/* Grid pattern */}
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] pointer-events-none" />
                            {/* Video Player */}
                            <div className="relative shadow-2xl rounded-sm overflow-hidden border border-white/10 bg-black w-full aspect-video flex justify-center items-center">
                                <Player
                                    ref={onPlayerRef}
                                    component={ResultVideo}
                                    inputProps={{
                                        clips: clips,
                                        primaryColor: '#6d28d9',
                                    }}
                                    durationInFrames={Math.max(300, clips.reduce((acc, clip) => Math.max(acc, clip.startFrame + clip.durationInFrames), 0))}
                                    compositionWidth={1280}
                                    compositionHeight={720}
                                    fps={30}
                                    controls
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Transport Controls */}
                        <div className="h-12 bg-card border-t border-border flex items-center justify-center gap-4 z-20">
                            <Button variant="ghost" size="icon" onClick={() => handleSeek(0)}>
                                <SkipBack size={18} />
                            </Button>
                            <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-primary/50 bg-primary/10 text-primary hover:bg-primary/20" onClick={togglePlay}>
                                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleSeek(totalFrames)}>
                                <SkipForward size={18} />
                            </Button>
                            <div className="absolute right-4 text-xs font-mono text-muted-foreground">
                                {currentFrame} / {totalFrames} F
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Bottom: Timeline */}
            <div className="h-[300px] flex-shrink-0 z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.3)]">
                <Timeline
                    tracks={tracks}
                    clips={clips}
                    currentFrame={currentFrame}
                    onSeek={handleSeek}
                    onClipClick={id => setSelectedClipId(id)}
                    selectedClipId={selectedClipId}
                    totalFrames={totalFrames}
                />
            </div>
        </div>
    );
}
