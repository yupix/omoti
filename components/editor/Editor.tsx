"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { ResultVideo } from '@/remotion/ResultVideo';
import { Card, CardContent, CardHeader, CardTitle, CardTitle as CTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download, Layers, Box, Plus, Trash2, Calendar, FileText, Video as VideoIcon, Image as ImageIcon, Play, Pause, SkipBack, SkipForward, Volume2, Square, Circle, Code2, Smile, Loader2, Save, FolderOpen, Copy, Clock, Upload, Grid, Scissors } from 'lucide-react';
import { Clip, Track, ClipType, CodeStep } from '@/types';
import { Timeline } from './Timeline';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InteractOverlay } from './InteractOverlay';
import { bundledLanguages } from 'shiki';

const INITIAL_TRACKS: Track[] = [
    { id: 1, name: 'Overlay Text' },
    { id: 2, name: 'Main Video' },
    { id: 3, name: 'Background' },
];

const INITIAL_CLIPS: Clip[] = [
    { id: 'c1', type: 'text', trackId: 1, startFrame: 0, durationInFrames: 60, content: 'Hello World', title: 'Intro Text' },
    { id: 'c2', type: 'text', trackId: 1, startFrame: 70, durationInFrames: 50, content: 'Omoti Editor', title: 'Brand Text' },
];

interface Asset {
    name: string;
    url: string;
    type: 'image' | 'video' | 'audio';
    duration?: number; // in seconds
}

const getMediaDuration = (url: string, type: 'video' | 'audio'): Promise<number> => {
    return new Promise((resolve) => {
        const element = type === 'video' ? document.createElement('video') : document.createElement('audio');
        element.preload = 'metadata';
        element.onloadedmetadata = () => {
            resolve(element.duration);
        };
        element.onerror = () => {
            resolve(0);
        };
        element.src = url;
    });
};

export default function Editor() {
    const [primaryColor, setPrimaryColor] = useState('#6d28d9');
    const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS); // Static tracks for now
    const [clips, setClips] = useState<Clip[]>(INITIAL_CLIPS);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

    const [currentFrame, setCurrentFrame] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [player, setPlayer] = useState<PlayerRef | null>(null);

    const [activeTab, setActiveTab] = useState<'properties' | 'assets'>('properties');
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    // Fetch assets on load
    useEffect(() => {
        fetch('/api/upload')
            .then(res => res.json())
            .then(async (data) => {
                if (data.files) {
                    const mapped = await Promise.all(data.files.map(async (f: any) => {
                        const type = f.name.match(/\.(mp4|webm|mov)$/i) ? 'video' :
                            f.name.match(/\.(mp3|wav|ogg|m4a)$/i) ? 'audio' : 'image';
                        let duration = 0;
                        if (type === 'video' || type === 'audio') {
                            duration = await getMediaDuration(`/uploads/${f.name}`, type);
                        }
                        return {
                            ...f,
                            type,
                            duration
                        };
                    }));
                    setAssets(mapped);
                }
            })
            .catch(console.error);
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploading(true);
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Upload failed');

            const data = await res.json();

            // Refresh assets
            const type = data.name.match(/\.(mp4|webm|mov)$/i) ? 'video' :
                data.name.match(/\.(mp3|wav|ogg|m4a)$/i) ? 'audio' : 'image';

            let duration = 0;
            if (type === 'video' || type === 'audio') {
                duration = await getMediaDuration(data.url, type);
            }

            const newAsset: Asset = {
                name: data.name,
                url: data.url,
                type,
                duration
            };
            setAssets(prev => [...prev, newAsset]);

            // Auto-switch to assets tab
            setActiveTab('assets');

        } catch (error) {
            console.error(error);
            alert('Upload failed');
        } finally {
            setIsUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    // Dynamic total frames based on content + buffer
    const maxClipEnd = Math.max(0, ...clips.map(c => c.startFrame + c.durationInFrames));
    const totalFrames = Math.max(300, maxClipEnd + 150); // Minimum 10s, or content + 5s buffer

    const selectedClip = clips.find(c => c.id === selectedClipId);

    // Auto-switch tab when selecting clip
    useEffect(() => {
        if (selectedClipId) {
            setActiveTab('properties');
        }
    }, [selectedClipId]);

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

    const handleBatchUpdateClip = (updates: Partial<Clip>) => {
        if (!selectedClipId) return;
        setClips(clips.map(c => c.id === selectedClipId ? { ...c, ...updates } : c));
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

    const checkCollision = (id: string, start: number, duration: number, track: number) => {
        const end = start + duration;
        return clips.some(c =>
            c.id !== id &&
            c.trackId === track &&
            start < (c.startFrame + c.durationInFrames) &&
            end > c.startFrame
        );
    };

    const addClip = (type: ClipType, contentOverride?: string, durationOverride?: number, startFrameOverride?: number, trackIdOverride?: number) => {
        const trackId = trackIdOverride ?? (type === 'text' || type === 'code' ? 1 : type === 'audio' ? 3 : 2);
        // Default 60 frames (2s), or durationOverride (seconds) * 30fps
        const duration = durationOverride ? Math.ceil(durationOverride * 30) : 60;
        let start = startFrameOverride ?? currentFrame;

        // Find next available slot if collision
        // Only auto-resolve collision if we are using default placement (not explicit drop)
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
            // Check collision for explicit drop? Maybe just warn or allow overlap?
            // The requirement was "prevent overlap", so let's enforce checking.
            if (checkCollision('new', start, duration, trackId)) {
                // If drop collides, we could reject or shift?
                // Rejecting is safer for now effectively "no-op" if invalid drop
                // Or find nearest valid space?
                // Lets just allow it but maybe shift if possible? 
                // To keep "prevent overlap" strict, let's reject.
                // But better UX might be to shift to end of whatever we hit?
                // For simplicity: reject drop if invalid.
                if (checkCollision('new', start, duration, trackId)) {
                    alert("Cannot place clip here: collision detected.");
                    return;
                }
            }
        }

        const newClip: Clip = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            trackId,
            startFrame: start, // Place at valid spot
            durationInFrames: duration,
            width: type === 'code' ? 600 : undefined,
            height: type === 'code' ? 400 : undefined,
            x: type === 'code' ? 340 : undefined,
            y: type === 'code' ? 160 : undefined,
            content: contentOverride || (
                type === 'text' ? 'New Text' :
                    type === 'audio' ? 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' :
                        type === 'shape' ? 'rect' :
                            type === 'code' ? 'console.log("Hello World");' :
                                'https://picsum.photos/seed/picsum/800/450'
            ),
            title: `New ${contentOverride || type}`,
            style: type === 'shape' ? { backgroundColor: '#ffffff' } : {},
            animation: { type: 'none', duration: 0 }, // Default animation
            language: type === 'code' ? 'typescript' : undefined,
            steps: type === 'code' ? [{ code: 'console.log("Hello World");', frameOffset: 0 }] : undefined,
        };
        setClips([...clips, newClip]);
        setSelectedClipId(newClip.id);
    };

    const handleTimelineDrop = (e: React.DragEvent, trackId: number, frame: number) => {
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/omoti-clip'));
            if (data) {
                addClip(data.type, data.content, data.duration, frame, trackId);
            }
        } catch (err) {
            console.error('Failed to parse drop data', err);
        }
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

    const handleClipMove = (clipId: string, newStartFrame: number, newTrackId: number) => {
        const clip = clips.find(c => c.id === clipId);
        if (!clip) return;

        const start = Math.max(0, newStartFrame);

        // Check collision
        if (checkCollision(clipId, start, clip.durationInFrames, newTrackId)) {
            return;
        }

        setClips(clips.map(c => {
            if (c.id === clipId) {
                return {
                    ...c,
                    startFrame: start,
                    trackId: newTrackId
                };
            }
            return c;
        }));
    };

    const handleClipResize = (clipId: string, newStartFrame: number, newDuration: number) => {
        const clip = clips.find(c => c.id === clipId);
        if (!clip) return;

        const start = Math.max(0, newStartFrame);
        const duration = Math.max(1, newDuration);

        // Check collision
        if (checkCollision(clipId, start, duration, clip.trackId)) {
            return;
        }

        setClips(clips.map(c => (c.id === clipId ? { ...c, startFrame: start, durationInFrames: duration } : c)));
    };

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedClipId) {
                    setClips(prev => prev.filter(c => c.id !== selectedClipId));
                    setSelectedClipId(null);
                }
            }

            if (e.key === 'Escape') {
                setSelectedClipId(null);
                setContextMenu(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedClipId]);

    // Close context menu on click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleAddTrack = () => {
        const newId = Math.max(...tracks.map(t => t.id), 0) + 1;
        setTracks([...tracks, { id: newId, name: `Track ${newId}` }]);
    };

    const handleTrackNameChange = (id: number, newName: string) => {
        setTracks(tracks.map(t => t.id === id ? { ...t, name: newName } : t));
    };

    const handleRemoveTrack = (id: number) => {
        if (confirm('Are you sure you want to delete this track? All clips on it will be removed.')) {
            setTracks(tracks.filter(t => t.id !== id));
            setClips(clips.filter(c => c.trackId !== id));
        }
    };

    const handleClipContextMenu = (e: React.MouseEvent, clipId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, clipId });
        setSelectedClipId(clipId);
    };

    const splitClip = (clipId: string) => {
        const clip = clips.find(c => c.id === clipId);
        if (!clip) return;

        // Check if playhead is within clip
        if (currentFrame <= clip.startFrame || currentFrame >= clip.startFrame + clip.durationInFrames) {
            alert("Playhead must be inside the clip to split.");
            return;
        }

        const splitOffset = currentFrame - clip.startFrame;
        const firstPartDuration = splitOffset;
        const secondPartDuration = clip.durationInFrames - splitOffset;
        const secondPartStart = currentFrame;

        // Validate min duration (e.g., 1 frame)
        if (firstPartDuration < 1 || secondPartDuration < 1) return;

        // Create second clip
        const newClip: Clip = {
            ...clip,
            id: Math.random().toString(36).substr(2, 9),
            startFrame: secondPartStart,
            durationInFrames: secondPartDuration,
            mediaStartOffset: (clip.mediaStartOffset || 0) + splitOffset,
            title: `${clip.title} (Part 2)`
        };

        // Update first clip
        const updatedClips = clips.map(c =>
            c.id === clipId
                ? { ...c, durationInFrames: firstPartDuration, title: `${clip.title} (Part 1)` }
                : c
        );

        setClips([...updatedClips, newClip]);
        setSelectedClipId(newClip.id);
    };

    const handleDuplicateClip = (clipId: string) => {
        const clip = clips.find(c => c.id === clipId);
        if (!clip) return;

        const newClip = {
            ...clip,
            id: Math.random().toString(36).substr(2, 9),
            // Try to place after, check collision? 
            // Original logic was dumb place after.
            // Let's use checkCollision logic if we wanted, but duplicate usually just pastes.
            // Revert to original simple paste but maybe shift if colliding?
            // "Prevent overlap" rule is active.
            // Let's try to find a spot.
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

        setClips([...clips, newClip]);
    };

    const handleSaveProject = () => {
        const projectData = {
            version: 1,
            tracks,
            clips,
            primaryColor,
            totalFrames,
        };
        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `omoti-project-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (json.version === 1 && Array.isArray(json.tracks) && Array.isArray(json.clips)) {
                    setTracks(json.tracks);
                    setClips(json.clips);
                    if (json.primaryColor) setPrimaryColor(json.primaryColor);
                    // Reset selection and player
                    setSelectedClipId(null);
                    alert('Project loaded successfully!');
                } else {
                    alert('Invalid project file format.');
                }
            } catch (err) {
                console.error(err);
                alert('Failed to parse project file.');
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    const handleExport = async () => {
        try {
            setIsExporting(true);
            const response = await fetch('/api/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clips }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Export failed');
            }

            const data = await response.json();

            // Trigger download
            const link = document.createElement('a');
            link.href = data.url;
            link.download = 'video-export.mp4';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error(error);
            alert('Export failed. Check console for details.');
        } finally {
            setIsExporting(false);
        }
    };

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

                    {/* Tab Switcher */}
                    <div className="flex border-b border-border bg-card shrink-0">
                        <button
                            onClick={() => setActiveTab('properties')}
                            className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors ${activeTab === 'properties' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
                        >
                            Properties
                        </button>
                        <button
                            onClick={() => setActiveTab('assets')}
                            className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors ${activeTab === 'assets' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
                        >
                            Assets
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {activeTab === 'properties' ? (
                            <>
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
                                                        <div className="space-y-2">
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] uppercase text-muted-foreground">Language</Label>
                                                                <Select
                                                                    value={selectedClip.language || 'typescript'}
                                                                    onValueChange={(val) => handleUpdateClip('language', val)}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs">
                                                                        <SelectValue placeholder="Language" />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="max-h-[300px]">
                                                                        {Object.keys(bundledLanguages).sort().map((lang) => (
                                                                            <SelectItem key={lang} value={lang}>
                                                                                {lang}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] uppercase text-muted-foreground">Transition Duration (Frames)</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={selectedClip.transitionDuration || 24}
                                                                    onChange={e => handleUpdateClip('transitionDuration', parseInt(e.target.value))}
                                                                    className="h-8 text-xs font-mono"
                                                                />
                                                            </div>
                                                            <div className="space-y-4">
                                                                {/* Visual Timeline Bar */}
                                                                <div className="space-y-1">
                                                                    <div className="flex justify-between text-[9px] text-muted-foreground uppercase">
                                                                        <span>Timeline Preview</span>
                                                                        <span>{selectedClip.durationInFrames}f</span>
                                                                    </div>
                                                                    <div className="relative h-6 bg-secondary/50 rounded overflow-hidden border border-border/50">
                                                                        {/* Playhead Position */}
                                                                        <div
                                                                            className="absolute top-0 bottom-0 border-l-[2px] border-red-500 z-10 transition-all duration-75"
                                                                            style={{
                                                                                left: `${Math.min(100, Math.max(0, ((currentFrame - selectedClip.startFrame) / selectedClip.durationInFrames) * 100))}%`
                                                                            }}
                                                                        />
                                                                        {/* Active Range Highlight */}
                                                                        <div
                                                                            className="absolute top-0 bottom-0 left-0 bg-primary/10 transition-all duration-75"
                                                                            style={{
                                                                                width: `${Math.min(100, Math.max(0, ((currentFrame - selectedClip.startFrame) / selectedClip.durationInFrames) * 100))}%`
                                                                            }}
                                                                        />

                                                                        {/* Step Markers */}
                                                                        {(selectedClip.steps || []).map((s, i) => (
                                                                            <div
                                                                                key={i}
                                                                                className="absolute top-1 bottom-1 w-1 bg-primary rounded-full hover:bg-primary/80 z-20 ring-1 ring-black/50"
                                                                                style={{ left: `${(s.frameOffset / selectedClip.durationInFrames) * 100}%` }}
                                                                                title={`Step at ${s.frameOffset}f`}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center justify-between">
                                                                    <Label className="text-[10px] uppercase text-muted-foreground">Keyframes</Label>
                                                                    <Button
                                                                        size="sm" variant="secondary" className="h-6 px-2 text-[10px] hover:bg-primary hover:text-primary-foreground"
                                                                        onClick={() => {
                                                                            const offset = Math.max(0, currentFrame - selectedClip.startFrame);
                                                                            // Allow adding slightly past end? No, strictly inside or at end.

                                                                            const steps = selectedClip.steps || [];
                                                                            // Find currently active code to copy
                                                                            const prevStep = [...steps].reverse().find(s => s.frameOffset <= offset);
                                                                            const baseCode = prevStep ? prevStep.code : selectedClip.content;

                                                                            const newSteps = [...steps.filter(s => s.frameOffset !== offset), {
                                                                                code: baseCode,
                                                                                frameOffset: offset
                                                                            }].sort((a, b) => a.frameOffset - b.frameOffset);

                                                                            handleUpdateClip('steps', newSteps);
                                                                        }}
                                                                    >
                                                                        <Plus size={12} className="mr-1" /> Add Effect at Playhead
                                                                    </Button>
                                                                </div>

                                                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                                                    {(selectedClip.steps || [{ code: selectedClip.content, frameOffset: 0 }]).map((step, index) => (
                                                                        <div key={index} className="space-y-2 p-2 rounded-md border border-border bg-background/50 relative group">
                                                                            <div className="flex items-start gap-2 mb-1">
                                                                                <div className="flex-1 space-y-1">
                                                                                    <div className="flex justify-between items-center">
                                                                                        <Label className="text-[9px] uppercase text-muted-foreground">Start Offset (Frames)</Label>
                                                                                        <span className="text-[9px] font-mono text-muted-foreground bg-primary/10 px-1 rounded">
                                                                                            Global: {selectedClip.startFrame + step.frameOffset}f
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex gap-1">
                                                                                        <Input
                                                                                            type="number"
                                                                                            className="h-7 text-xs"
                                                                                            value={step.frameOffset}
                                                                                            onChange={(e) => {
                                                                                                const newSteps = [...(selectedClip.steps || [])];
                                                                                                newSteps[index] = { ...step, frameOffset: Number(e.target.value) };
                                                                                                handleUpdateClip('steps', newSteps);
                                                                                            }}
                                                                                        />
                                                                                        <Button
                                                                                            size="icon" variant="outline" className="h-7 w-7 flex-shrink-0"
                                                                                            title="Set to Current Playhead"
                                                                                            onClick={() => {
                                                                                                const newOffset = Math.max(0, currentFrame - selectedClip.startFrame);
                                                                                                const newSteps = [...(selectedClip.steps || [])];
                                                                                                newSteps[index] = { ...step, frameOffset: newOffset };
                                                                                                handleUpdateClip('steps', newSteps);
                                                                                            }}
                                                                                        >
                                                                                            <Clock size={12} />
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                                <Button
                                                                                    size="icon" variant="ghost" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity mt-5"
                                                                                    onClick={() => {
                                                                                        const newSteps = (selectedClip.steps || []).filter((_, i) => i !== index);
                                                                                        handleUpdateClip('steps', newSteps);
                                                                                    }}
                                                                                    disabled={(selectedClip.steps || []).length <= 1}
                                                                                >
                                                                                    <Trash2 size={12} />
                                                                                </Button>
                                                                            </div>
                                                                            <textarea
                                                                                value={step.code}
                                                                                onChange={e => {
                                                                                    const newSteps = [...(selectedClip.steps || [])];
                                                                                    newSteps[index] = { ...step, code: e.target.value };
                                                                                    handleUpdateClip('steps', newSteps);
                                                                                }}
                                                                                className="w-full h-20 p-2 text-xs font-mono bg-background border border-input rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
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
                                                    <div className="space-y-3 pt-2 border-t border-border/50">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">Color</Label>
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    type="color"
                                                                    value={(selectedClip.style?.backgroundColor as string) || (selectedClip.style?.color as string) || '#ffffff'}
                                                                    onChange={e => handleUpdateStyle(selectedClip.type === 'text' ? 'color' : 'backgroundColor', e.target.value)}
                                                                    className="w-full h-8 p-1 cursor-pointer"
                                                                />
                                                            </div>
                                                        </div>

                                                        {selectedClip.type === 'text' && (
                                                            <>
                                                                <div className="space-y-1">
                                                                    <Label className="text-[10px] uppercase text-muted-foreground">Font Family</Label>
                                                                    <Select
                                                                        value={(selectedClip.style?.fontFamily as string) || 'sans-serif'}
                                                                        onValueChange={(val) => handleUpdateStyle('fontFamily', val)}
                                                                    >
                                                                        <SelectTrigger className="h-8 text-xs">
                                                                            <SelectValue placeholder="Font" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="sans-serif">Sans Serif</SelectItem>
                                                                            <SelectItem value="serif">Serif</SelectItem>
                                                                            <SelectItem value="monospace">Monospace</SelectItem>
                                                                            <SelectItem value="Inter">Inter</SelectItem>
                                                                            <SelectItem value="Roboto">Roboto</SelectItem>
                                                                            <SelectItem value="'Comic Sans MS'">Comic Sans</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label className="text-[10px] uppercase text-muted-foreground">Font Size (px)</Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={typeof selectedClip.style?.fontSize === 'string' ? parseInt(selectedClip.style.fontSize) : 80}
                                                                        onChange={e => handleUpdateStyle('fontSize', `${e.target.value}px`)}
                                                                        className="h-8 text-sm"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label className="text-[10px] uppercase text-muted-foreground">Font Weight</Label>
                                                                    <Select
                                                                        value={String(selectedClip.style?.fontWeight || 800)}
                                                                        onValueChange={(val) => handleUpdateStyle('fontWeight', parseInt(val))}
                                                                    >
                                                                        <SelectTrigger className="h-8 text-xs">
                                                                            <SelectValue placeholder="Weight" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="400">Normal (400)</SelectItem>
                                                                            <SelectItem value="600">Semi Bold (600)</SelectItem>
                                                                            <SelectItem value="800">Bold (800)</SelectItem>
                                                                            <SelectItem value="900">Black (900)</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </>
                                                        )}
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
                                        <Button
                                            variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing"
                                            onClick={() => addClip('text')}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/omoti-clip', JSON.stringify({ type: 'text' }));
                                            }}
                                        >
                                            <FileText size={16} />
                                            <span className="text-[10px]">Text</span>
                                        </Button>
                                        <Button
                                            variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing"
                                            onClick={() => addClip('video')}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/omoti-clip', JSON.stringify({ type: 'video' }));
                                            }}
                                        >
                                            <VideoIcon size={16} />
                                            <span className="text-[10px]">Video</span>
                                        </Button>
                                        <Button
                                            variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing"
                                            onClick={() => addClip('image')}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/omoti-clip', JSON.stringify({ type: 'image' }));
                                            }}
                                        >
                                            <ImageIcon size={16} />
                                            <span className="text-[10px]">Image</span>
                                        </Button>
                                        <Button
                                            variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing"
                                            onClick={() => addClip('audio')}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/omoti-clip', JSON.stringify({ type: 'audio', content: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' }));
                                            }}
                                        >
                                            <Volume2 size={16} />
                                            <span className="text-[10px]">Audio</span>
                                        </Button>
                                        <Button
                                            variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing"
                                            onClick={() => addClip('shape', 'rect')}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/omoti-clip', JSON.stringify({ type: 'shape', content: 'rect' }));
                                            }}
                                        >
                                            <Square size={16} />
                                            <span className="text-[10px]">Rect</span>
                                        </Button>
                                        <Button
                                            variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing"
                                            onClick={() => addClip('shape', 'circle')}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/omoti-clip', JSON.stringify({ type: 'shape', content: 'circle' }));
                                            }}
                                        >
                                            <Circle size={16} />
                                            <span className="text-[10px]">Circle</span>
                                        </Button>
                                        <Button
                                            variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing"
                                            onClick={() => addClip('code')}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/omoti-clip', JSON.stringify({ type: 'code', content: 'console.log("Hello World");' }));
                                            }}
                                        >
                                            <Code2 size={16} />
                                            <span className="text-[10px]">Code</span>
                                        </Button>
                                        <Button
                                            variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing"
                                            onClick={() => addClip('image', 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2E5eG56eG56eG56eG56eG56eG56eG5/3o7aD2saalBwwftBIY/giphy.gif')}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/omoti-clip', JSON.stringify({ type: 'image', content: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2E5eG56eG56eG56eG56eG56eG56eG5/3o7aD2saalBwwftBIY/giphy.gif' }));
                                            }}
                                        >
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

                            </>
                        ) : (
                            <div className="space-y-4 animate-in slide-in-from-right duration-300">
                                {/* Upload Box */}
                                <div
                                    className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                                    onClick={() => document.getElementById('asset-upload')?.click()}
                                >
                                    <input
                                        type="file"
                                        id="asset-upload"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        accept="image/*,video/*,audio/*"
                                    />
                                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                                        {isUploading ? <Loader2 className="animate-spin text-primary" size={20} /> : <Upload className="text-muted-foreground group-hover:text-primary" size={20} />}
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-medium text-foreground">Click to Upload</p>
                                        <p className="text-[10px] text-muted-foreground">Images, Videos or Audio</p>
                                    </div>
                                </div>

                                {/* Asset Grid */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Library</h2>
                                        <span className="text-[10px] text-muted-foreground">{assets.length} items</span>
                                    </div>

                                    {assets.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <ImageIcon className="mx-auto h-8 w-8 opacity-20 mb-2" />
                                            <p className="text-xs">No assets yet</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            {assets.map((asset, i) => (
                                                <div
                                                    key={i}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData('application/omoti-clip', JSON.stringify({
                                                            type: asset.type,
                                                            content: asset.url,
                                                            duration: asset.duration
                                                        }));
                                                    }}
                                                    className="group relative aspect-video bg-black/50 rounded-md overflow-hidden border border-border/50 cursor-pointer hover:border-primary transition-all cursor-grab active:cursor-grabbing"
                                                    onClick={() => addClip(asset.type, asset.url, asset.duration)}
                                                    title={`${asset.name} ${asset.duration ? `(${asset.duration.toFixed(1)}s)` : ''}`}
                                                >
                                                    {asset.type === 'video' ? (
                                                        <video src={asset.url} className="w-full h-full object-cover pointer-events-none" />
                                                    ) : asset.type === 'audio' ? (
                                                        <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                                                            <Volume2 className="text-muted-foreground" size={24} />
                                                        </div>
                                                    ) : (
                                                        <img src={asset.url} alt={asset.name} className="w-full h-full object-cover pointer-events-none" />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                        <Plus className="text-white drop-shadow-md" size={20} />
                                                    </div>
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-4">
                                                        <p className="text-[10px] text-white truncate px-0.5">{asset.name}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Preview Area */}
                <main className="flex-1 flex flex-col bg-stone-950 relative overflow-hidden">
                    <header className="h-14 border-b border-border/50 flex items-center justify-between px-6 bg-background/80 backdrop-blur-md z-10">
                        <div className="text-sm text-muted-foreground flex items-center gap-4">
                            <span>Project: <span className="text-foreground font-medium">New Video 01</span></span>
                            <div className="h-4 w-px bg-border"></div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSaveProject} title="Save Project">
                                    <Save size={16} />
                                </Button>
                                <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8" title="Load Project">
                                    <FolderOpen size={16} />
                                    <input type="file" className="hidden" accept=".json" onChange={handleLoadProject} />
                                </label>
                            </div>
                        </div>
                        <Button
                            className="h-8 shadow-[0_0_20px_rgba(109,40,217,0.3)] transition-all hover:shadow-[0_0_30px_rgba(109,40,217,0.5)]"
                            size="sm"
                            onClick={handleExport}
                            disabled={isExporting}
                        >
                            {isExporting ? <Loader2 className="mr-2 size-3 animate-spin" /> : <Download className="mr-2 size-3" />}
                            {isExporting ? 'Exporting...' : 'Export'}
                        </Button>
                    </header>

                    <div className="flex-1 flex flex-col relative min-h-0">
                        {/* Viewport */}
                        <div className="flex-1 flex items-center justify-center bg-stone-950/20 p-8 overflow-hidden relative" onClick={() => setSelectedClipId(null)}>
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
                            {/* Grid pattern */}
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] pointer-events-none" />
                            {/* Video Player */}
                            <div className="relative shadow-2xl rounded-sm overflow-hidden border border-white/10 bg-black h-full max-w-full aspect-video flex justify-center items-center">
                                <Player
                                    ref={onPlayerRef}
                                    component={ResultVideo}
                                    inputProps={{ clips, primaryColor }}
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
                                {clips.filter(c =>
                                    currentFrame >= c.startFrame &&
                                    currentFrame < c.startFrame + c.durationInFrames &&
                                    c.id !== selectedClipId &&
                                    ['text', 'image', 'shape', 'code'].includes(c.type) // Only positionable types
                                ).map(clip => {
                                    const isPositioned = typeof clip.x === 'number' || typeof clip.y === 'number' || typeof clip.width === 'number' || typeof clip.height === 'number';
                                    const x = isPositioned ? (clip.x || 0) : 0;
                                    const y = isPositioned ? (clip.y || 0) : 0;
                                    const width = isPositioned ? (clip.width || 400) : 1280;
                                    const height = isPositioned ? (clip.height || 400) : 720;

                                    return (
                                        <div
                                            key={clip.id}
                                            style={{
                                                position: 'absolute',
                                                left: `${(x / 1280) * 100}%`,
                                                top: `${(y / 720) * 100}%`,
                                                width: `${(width / 1280) * 100}%`,
                                                height: `${(height / 720) * 100}%`,
                                                zIndex: 40, // Below InteractOverlay (50)
                                                cursor: 'pointer',
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedClipId(clip.id);
                                            }}
                                            className="hover:ring-2 hover:ring-blue-500/30 transition-all rounded-sm"
                                        />
                                    );
                                })}
                                <InteractOverlay
                                    clip={selectedClip}
                                    onUpdate={handleBatchUpdateClip}
                                    width={1280}
                                    height={720}
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
                    onClipMove={handleClipMove}
                    onClipResize={handleClipResize}
                    onTimelineDrop={handleTimelineDrop}
                    onAddTrack={handleAddTrack}
                    onUpdateTrackName={handleTrackNameChange}
                    onRemoveTrack={handleRemoveTrack}
                    onContextMenu={handleClipContextMenu}
                    selectedClipId={selectedClipId}
                    totalFrames={totalFrames}
                />
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 min-w-32 bg-popover border border-border shadow-md rounded-md overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <div className="p-1 flex flex-col gap-0.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start h-8 px-2"
                            onClick={() => {
                                splitClip(contextMenu.clipId);
                                setContextMenu(null);
                            }}
                        >
                            <Scissors size={14} className="mr-2" />
                            Split at Playhead
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start h-8 px-2"
                            onClick={() => handleDuplicateClip(contextMenu.clipId)}
                        >
                            <Copy size={14} className="mr-2" />
                            Duplicate
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start h-8 px-2 text-destructive hover:text-destructive"
                            onClick={() => {
                                setClips(clips.filter(c => c.id !== contextMenu.clipId));
                                setContextMenu(null);
                            }}
                        >
                            <Trash2 size={14} className="mr-2" />
                            Delete
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
