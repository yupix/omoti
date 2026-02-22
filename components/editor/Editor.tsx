"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { ResultVideo } from '@/remotion/ResultVideo';
import { Button } from '@/components/ui/button';
import { Clip, Track, ClipType } from '@/types';
import { Timeline } from './Timeline';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InteractOverlay } from './InteractOverlay';
import '@/lib/i18n'; // Initialize i18n
import { useTranslation } from 'react-i18next';
import {
    Download, Box, Play, Pause, SkipBack, SkipForward,
    Loader2, Save, FolderOpen, Globe, Scissors, Copy, Trash2,
    Maximize2, X
} from 'lucide-react';
import { readPsd } from 'ag-psd';
import { getAIVoicePresets } from '@/lib/aivoice';
import { PropertiesPanel } from './PropertiesPanel';
import { AssetsPanel } from './AssetsPanel';
import { AiGeneratorDialog } from './AiGeneratorDialog';
import { Sparkles } from 'lucide-react';

import { INITIAL_CLIPS, INITIAL_TRACKS } from './constants';
import { Asset, getMediaDuration } from './utils';
import { setFrame as setEditorFrame, getSnapshot as getEditorFrame } from './editorFrameStore';
import { FrameDisplay, FullscreenFrameDisplay, FrameSeekBar, PreviewClipOverlays } from './EditorFrameComponents';

export default function Editor() {
    const { t, i18n } = useTranslation();
    const [primaryColor, setPrimaryColor] = useState('#6d28d9');
    const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS); // Static tracks for now
    const [clips, setClips] = useState<Clip[]>(INITIAL_CLIPS);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load editor state from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('omoti_editor_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.tracks && parsed.tracks.length > 0) setTracks(parsed.tracks);
                if (parsed.clips) setClips(parsed.clips);
                if (parsed.primaryColor) setPrimaryColor(parsed.primaryColor);
            } catch (e) {
                console.error('Failed to load saved state', e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save editor state to localStorage
    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('omoti_editor_state', JSON.stringify({
            tracks,
            clips,
            primaryColor
        }));
    }, [tracks, clips, primaryColor, isLoaded]);

    const currentFrameRef = useRef(0); // for addClip etc - synced from store
    const [isPlaying, setIsPlaying] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [player, setPlayer] = useState<PlayerRef | null>(null);

    const [activeTab, setActiveTab] = useState<'properties' | 'assets'>('properties');
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [localVolume, setLocalVolume] = useState<number | null>(null);
    const [availableLayers, setAvailableLayers] = useState<string[]>([]);
    const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
    const [pathsWithChildren, setPathsWithChildren] = useState<Set<string>>(new Set());
    const [tachiePresets, setTachiePresets] = useState<{ id: string; name: string; assetUrl: string; layers: string[] }[]>([]);
    const [aiVoicePresets, setAiVoicePresets] = useState<string[]>([]);
    const [selectedAiVoicePreset, setSelectedAiVoicePreset] = useState<string>('');
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
    const mainPlayerRef = React.useRef<PlayerRef | null>(null);
    const wasFullscreenRef = React.useRef(false);
    const [language, setLanguage] = useState(() => i18n.resolvedLanguage || 'en');

    const handleLanguageChange = (val: string) => {
        setLanguage(val);
        i18n.changeLanguage(val);
    };

    // Load tachie presets from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('omoti_tachie_presets');
        if (saved) {
            try {
                setTachiePresets(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse tachie presets', e);
            }
        } else {
            // Seed default presets if empty
            const psdUrl = '/uploads/1770692241459-_____SD___.psd';
            setTachiePresets([
                { id: 'p-akane', name: 'a (琴乃茜)', assetUrl: psdUrl, layers: [] },
                { id: 'p-aoi', name: 'aoi (葵)', assetUrl: psdUrl, layers: [] }
            ]);
        }
    }, []);

    // Save tachie presets to localStorage
    useEffect(() => {
        localStorage.setItem('omoti_tachie_presets', JSON.stringify(tachiePresets));
    }, [tachiePresets]);

    // Fetch AIVOICE presets
    useEffect(() => {
        getAIVoicePresets().then(presets => {
            setAiVoicePresets(presets);
            if (presets.length > 0) setSelectedAiVoicePreset(presets[0]);
        });
    }, []);

    // Exit fullscreen on Escape
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isPreviewFullscreen) {
                setIsPreviewFullscreen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isPreviewFullscreen]);

    // Fetch assets on load
    useEffect(() => {
        fetch('/api/upload')
            .then(res => res.json())
            .then(async (data) => {
                if (data.files) {
                    const mapped = await Promise.all(data.files.map(async (f: any) => {
                        const origin = window.location.origin;
                        const fullUrl = `${origin}/uploads/${f.name}`;
                        const type = f.name.match(/\.(mp4|webm|mov)$/i) ? 'video' :
                            f.name.match(/\.(mp3|wav|ogg|m4a)$/i) ? 'audio' :
                                f.name.match(/\.psd$/i) ? 'tachie' : 'image';
                        let duration = 0;
                        if (type === 'video' || type === 'audio') {
                            duration = await getMediaDuration(fullUrl, type);
                        }
                        return {
                            ...f,
                            url: fullUrl,
                            type,
                            duration
                        };
                    }));
                    setAssets(mapped);
                }
            })
            .catch(console.error);
    }, []);

    const uploadFiles = useCallback(async (files: File[]) => {
        try {
            setIsUploading(true);
            const newAssets: Asset[] = [];

            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) throw new Error(`Upload failed for ${file.name}`);

                const data = await res.json();

                // Refresh assets
                const type = data.name.match(/\.(mp4|webm|mov|ogg|mkv)$/i) ? 'video' :
                    data.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i) ? 'audio' :
                        data.name.match(/\.psd$/i) ? 'tachie' : 'image';

                const origin = window.location.origin;
                const fullUrl = `${origin}${data.url}`;

                let duration = 0;
                if (type === 'video' || type === 'audio') {
                    duration = await getMediaDuration(fullUrl, type);
                }

                newAssets.push({
                    name: data.name,
                    url: fullUrl,
                    type,
                    duration
                });
            }

            if (newAssets.length > 0) {
                setAssets(prev => [...prev, ...newAssets]);
                // Auto-switch to assets tab
                setActiveTab('assets');
            }
        } catch (error) {
            console.error(error);
            alert('Upload failed');
        } finally {
            setIsUploading(false);
        }
    }, [getMediaDuration, setAssets, setActiveTab]);

    const removeAsset = useCallback((url: string) => {
        setAssets(prev => prev.filter(a => a.url !== url));
    }, []);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        await uploadFiles(files);
        e.target.value = ''; // Reset input
    }, [uploadFiles]);

    // Dynamic total frames based on content + buffer
    const maxClipEnd = Math.max(0, ...clips.map(c => (c.startFrame || 0) + (c.durationInFrames || 0)));
    const totalFrames = Math.max(300, (isNaN(maxClipEnd) ? 0 : maxClipEnd) + 150); // Minimum 10s, or content + 5s buffer

    const inputProps = useMemo(() => ({
        clips,
        primaryColor,
        assetBaseUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
    }), [clips, primaryColor]);

    const selectedClip = clips.find(c => c.id === selectedClipId);

    // Parse PSD layers when a tachie clip is selected
    useEffect(() => {
        if (selectedClip && selectedClip.type === 'tachie') {
            const loadLayers = async () => {
                try {
                    const response = await fetch(selectedClip.content);
                    const buffer = await response.arrayBuffer();
                    // Just read structure, skip images for speed
                    const psd = readPsd(buffer, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });

                    const names: string[] = [];
                    const defaultVisible: string[] = [];
                    const withChildren: string[] = [];
                    const extractNames = (layers: any[], parentPath: string = '', parentVisible: boolean = true) => {
                        // ag-psd returns layers from bottom to top.
                        // For the UI list, we want top to bottom (like Photoshop).
                        [...layers].reverse().forEach(l => {
                            const currentPath = parentPath ? `${parentPath}/${l.name}` : (l.name || 'Unnamed Layer');
                            names.push(currentPath);
                            const isVisible = parentVisible && !l.hidden;
                            if (isVisible) {
                                defaultVisible.push(currentPath);
                            }
                            if (l.children && l.children.length > 0) {
                                withChildren.push(currentPath);
                                extractNames(l.children, currentPath, isVisible);
                            }
                        });
                    };
                    if (psd.children) extractNames(psd.children);
                    setAvailableLayers(names);
                    setPathsWithChildren(new Set(withChildren));

                    // Initialize tachieLayers if empty
                    if (!selectedClip.tachieLayers || selectedClip.tachieLayers.length === 0) {
                        handleUpdateClip('tachieLayers', defaultVisible);
                    }
                } catch (e) {
                    console.error('Failed to parse PSD layers:', e);
                    setAvailableLayers([]);
                }
            };
            loadLayers();
        } else {
            setAvailableLayers([]);
        }
    }, [selectedClip?.id, selectedClip?.content, selectedClip?.type]);

    // Sync local volume state when selected clip changes
    useEffect(() => {
        if (selectedClip) {
            setLocalVolume(selectedClip.volume ?? 1);
        }
    }, [selectedClip]);

    // Auto-switch tab when selecting clip
    useEffect(() => {
        if (selectedClipId) {
            setActiveTab('properties');
        }
    }, [selectedClipId]);

    // Use callback ref to ensure we capture the player instance once it's available
    const onMainPlayerRef = React.useCallback((ref: PlayerRef | null) => {
        mainPlayerRef.current = ref;
        if (!isPreviewFullscreen && ref) setPlayer(ref);
    }, [isPreviewFullscreen]);

    const onFullscreenPlayerRef = React.useCallback((ref: PlayerRef | null) => {
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

        const handleFrameUpdate = (e: any) => {
            const frame = (e as { detail?: { frame?: number } }).detail?.frame ?? 0;
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

    const handleUpdateClip = useCallback((key: keyof Clip, value: any) => {
        if (!selectedClipId) return;
        setClips(clips.map(c => c.id === selectedClipId ? { ...c, [key]: value } : c));
    }, [selectedClipId, clips]);

    const handleBatchUpdateClip = useCallback((updates: Partial<Clip>) => {
        if (!selectedClipId) return;
        setClips(clips.map(c => c.id === selectedClipId ? { ...c, ...updates } : c));
    }, [selectedClipId, clips]);

    const handleUpdateStyle = useCallback((key: string, value: any) => {
        if (!selectedClip) return;
        const newStyle = { ...selectedClip.style, [key]: value };
        handleUpdateClip('style', newStyle);
    }, [selectedClip, handleUpdateClip]);

    const handleUpdateAnimation = useCallback((key: string, value: any) => {
        if (!selectedClip) return;
        const newAnimation = { ...selectedClip.animation, [key]: value };
        if (!selectedClip.animation && !newAnimation.duration) newAnimation.duration = 10;
        if (!selectedClip.animation && !newAnimation.type) newAnimation.type = 'fade';
        handleUpdateClip('animation', newAnimation);
    }, [selectedClip, handleUpdateClip]);

    const checkCollision = (id: string, start: number, duration: number, track: number) => {
        const end = start + duration;
        return clips.some(c =>
            c.id !== id &&
            c.trackId === track &&
            start < (c.startFrame + c.durationInFrames) &&
            end > c.startFrame
        );
    };

    const addClip = useCallback((type: ClipType, contentOverride?: string, durationOverride?: number, startFrameOverride?: number, trackIdOverride?: number) => {
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

        const newClip: Clip = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            trackId,
            startFrame: start, // Place at valid spot
            durationInFrames: duration,
            width: (type === 'text') ? 800 : (type === 'code' || type === 'flow') ? 600 : (type === 'image' || type === 'tachie') ? 600 : undefined,
            height: (type === 'text') ? 200 : (type === 'code' || type === 'flow') ? 400 : (type === 'image' || type === 'tachie') ? 600 : undefined,
            x: (type === 'text') ? 240 : (type === 'code' || type === 'flow') ? 340 : (type === 'image' || type === 'tachie') ? 340 : undefined,
            y: (type === 'text') ? 500 : (type === 'code' || type === 'flow') ? 160 : (type === 'image' || type === 'tachie') ? 60 : undefined,
            content: contentOverride || (
                type === 'text' ? 'New Text' :
                    type === 'audio' ? 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' :
                        type === 'shape' ? 'rect' :
                            type === 'code' ? 'console.log("Hello World");' :
                                type === 'flow' ? 'New Flow' :
                                    'https://picsum.photos/seed/picsum/800/450'
            ),
            title: `New ${contentOverride || type}`,
            style: type === 'shape' ? { backgroundColor: '#ffffff' } : {},
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
        };
        setClips([...clips, newClip]);
        setSelectedClipId(newClip.id);
    }, [clips, tracks]);

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

    const removeClip = useCallback(() => {
        if (!selectedClipId) return;
        setClips(clips.filter(c => c.id !== selectedClipId));
        setSelectedClipId(null);
    }, [selectedClipId, clips]);

    const handleSeek = useCallback((frame: number) => {
        setEditorFrame(frame);
        currentFrameRef.current = frame;
        if (player) player.seekTo(frame);
    }, [player]);

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

    // ------------- Undo / Redo History -------------
    const historyRef = useRef<{ clips: Clip[]; tracks: Track[]; primaryColor: string }[]>([]);
    const historyIndexRef = useRef(-1);
    const isNavigatingHistoryRef = useRef(false);

    // Save history whenever state changes (unless we are undoing/redoing)
    useEffect(() => {
        if (!isLoaded) return;
        if (isNavigatingHistoryRef.current) {
            isNavigatingHistoryRef.current = false;
            return;
        }

        const currentState = { clips, tracks, primaryColor };

        // Prevent pushing duplicate states sequentially
        const lastState = historyRef.current[historyIndexRef.current];
        if (lastState && JSON.stringify(lastState) === JSON.stringify(currentState)) {
            return;
        }

        // If we are not at the end of the history (i.e. we undid something), truncate future history
        if (historyIndexRef.current < historyRef.current.length - 1) {
            historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
        }

        historyRef.current.push(currentState);

        // Limit history to 50 items to prevent huge memory usage in localStorage/RAM
        if (historyRef.current.length > 50) {
            historyRef.current.shift();
        } else {
            historyIndexRef.current++;
        }
    }, [clips, tracks, primaryColor, isLoaded]);

    const handleUndo = useCallback(() => {
        if (historyIndexRef.current > 0) {
            isNavigatingHistoryRef.current = true;
            historyIndexRef.current--;
            const previousState = historyRef.current[historyIndexRef.current];
            setClips(previousState.clips);
            setTracks(previousState.tracks);
            setPrimaryColor(previousState.primaryColor);
        }
    }, []);

    const handleRedo = useCallback(() => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            isNavigatingHistoryRef.current = true;
            historyIndexRef.current++;
            const nextState = historyRef.current[historyIndexRef.current];
            setClips(nextState.clips);
            setTracks(nextState.tracks);
            setPrimaryColor(nextState.primaryColor);
        }
    }, []);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input
            const activeTag = document.activeElement?.tagName;
            const isContentEditable = (document.activeElement as HTMLElement)?.isContentEditable;
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || isContentEditable) {
                return;
            }

            // Undo (Ctrl+Z or Cmd+Z)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
                return;
            }

            // Redo (Ctrl+Shift+Z, Cmd+Shift+Z, Ctrl+Y, Cmd+Y)
            if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) ||
                ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) {
                e.preventDefault();
                handleRedo();
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

            if (e.key === 'ArrowLeft') {
                if (!selectedClipId) {
                    e.preventDefault();
                    handleSeek(Math.max(0, getEditorFrame() - 1));
                }
            }

            if (e.key === 'ArrowRight') {
                if (!selectedClipId) {
                    e.preventDefault();
                    handleSeek(Math.min(totalFrames, getEditorFrame() + 1));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedClipId, handleSeek, totalFrames, handleUndo, handleRedo]);

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
                body: JSON.stringify({
                    clips,
                    assetBaseUrl: window.location.origin, // Next.jsサーバーのURL（エクスポート時にPSD等を取得するため）
                }),
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

    const [isAiOpen, setIsAiOpen] = useState(false);

    const handleAiGenerate = (newClips: Clip[]) => {
        if (confirm("This will replace your current timeline. Continue?")) {
            // Dynamically generate tracks based on clips
            const usedTrackIds = Array.from(new Set(newClips.map(c => c.trackId)));
            // Ensure standard tracks exist if not used? No, just what's needed.
            // Actually, let's keep it clean.

            const newTracks: Track[] = usedTrackIds.sort((a, b) => a - b).map(id => {
                let name = `Track ${id}`;
                if (id === 1) name = 'Text/Subtitles';
                else if (id === 2) name = 'Characters';
                else if (id === 3) name = 'Audio/BGM';
                else if (id === 10) name = 'Background';
                else if (id >= 4 && id < 10) name = `Overlay ${id - 3}`;

                return { id, name };
            });

            setTracks(newTracks);
            setClips(newClips);
            alert("Video generated successfully!");
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
                            {t('editor.tabs.properties')}
                        </button>
                        <button
                            onClick={() => setActiveTab('assets')}
                            className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors ${activeTab === 'assets' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
                        >
                            {t('editor.tabs.assets')}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {activeTab === 'properties' ? (
                            <PropertiesPanel
                                selectedClip={selectedClip || null}
                                localVolume={localVolume}
                                setLocalVolume={setLocalVolume}
                                handleUpdateClip={handleUpdateClip}
                                handleBatchUpdateClip={handleBatchUpdateClip}
                                handleUpdateStyle={handleUpdateStyle}
                                handleUpdateAnimation={handleUpdateAnimation}
                                removeClip={removeClip}
                                addClip={addClip}
                                tachiePresets={tachiePresets}
                                setTachiePresets={setTachiePresets}
                                availableLayers={availableLayers}
                                collapsedPaths={collapsedPaths}
                                setCollapsedPaths={setCollapsedPaths}
                                pathsWithChildren={pathsWithChildren}
                                aiVoicePresets={aiVoicePresets}
                                selectedAiVoicePreset={selectedAiVoicePreset}
                                setSelectedAiVoicePreset={setSelectedAiVoicePreset}
                                isSynthesizing={isSynthesizing}
                                setIsSynthesizing={setIsSynthesizing}
                                primaryColor={primaryColor}
                                setPrimaryColor={setPrimaryColor}
                                t={t}
                            />
                        ) : (
                            <AssetsPanel
                                handleFileUpload={handleFileUpload}
                                uploadFiles={uploadFiles}
                                isUploading={isUploading}
                                assets={assets}
                                addClip={addClip}
                                removeAsset={removeAsset}
                                t={t}
                            />
                        )}
                    </div>
                </aside>

                {/* Preview Area */}
                <main className="flex-1 flex flex-col bg-stone-950 relative overflow-hidden">
                    <header className="h-14 border-b border-border/50 flex items-center justify-between px-6 bg-background/80 backdrop-blur-md z-10">
                        <div className="text-sm text-muted-foreground flex items-center gap-4">
                            <span>{t('editor.header.project')}: <span className="text-foreground font-medium">New Video 01</span></span>
                            <div className="h-4 w-px bg-border"></div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSaveProject} title={t('editor.header.save')}>
                                    <Save size={16} />
                                </Button>
                                <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8" title={t('editor.header.load')}>
                                    <FolderOpen size={16} />
                                    <input type="file" className="hidden" accept=".json" onChange={handleLoadProject} />
                                </label>
                                <div className="h-4 w-px bg-border"></div>
                                <Select value={language} onValueChange={handleLanguageChange}>
                                    <SelectTrigger className="h-8 w-[90px] text-xs gap-1 px-2 border-none bg-transparent hover:bg-accent focus:ring-0">
                                        <Globe size={14} className="text-muted-foreground" />
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="ja">日本語</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button
                            className="h-8 shadow-[0_0_20px_rgba(109,40,217,0.3)] transition-all hover:shadow-[0_0_30px_rgba(109,40,217,0.5)]"
                            size="sm"
                            onClick={handleExport}
                            disabled={isExporting}
                        >
                            {isExporting ? <Loader2 className="mr-2 size-3 animate-spin" /> : <Download className="mr-2 size-3" />}
                            {isExporting ? t('editor.header.exporting') : t('editor.header.export')}
                        </Button>
                        <Button
                            className="ml-2 h-8 bg-purple-600 hover:bg-purple-700 text-white border border-purple-400/20 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                            size="sm"
                            onClick={() => setIsAiOpen(true)}
                        >
                            <Sparkles className="mr-2 size-3" />
                            AI Create
                        </Button>

                    </header>

                    <div className="flex-1 flex flex-col relative min-h-0">
                        {/* Viewport */}
                        <div className="flex-1 flex items-center justify-center bg-stone-950/20 p-8 overflow-hidden relative" onClick={() => setSelectedClipId(null)}>
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
                            {/* Grid pattern */}
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] pointer-events-none" />
                            {/* Fullscreen toggle */}
                            <Button
                                variant="secondary"
                                size="icon"
                                className="absolute top-4 right-4 z-30 h-9 w-9 rounded-md bg-black/60 hover:bg-black/80 border border-white/10"
                                onClick={(e) => { e.stopPropagation(); setIsPreviewFullscreen(true); }}
                                title={t('editor.preview.fullscreen')}
                            >
                                <Maximize2 size={16} />
                            </Button>
                            {/* Video Player - skip when fullscreen to avoid double Player render */}
                            <div className="relative shadow-2xl rounded-sm overflow-hidden border border-white/10 bg-black h-full max-w-full aspect-video flex justify-center items-center">
                                {!isPreviewFullscreen && (
                                    <Player
                                        ref={onMainPlayerRef}
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
                                    onClipClick={setSelectedClipId}
                                />
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
                            <div className="absolute right-4">
                                <FrameDisplay totalFrames={totalFrames} />
                            </div>
                        </div>
                    </div>
                </main>
            </div >

            {/* Bottom: Timeline */}
            < div className="h-[300px] flex-shrink-0 z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.3)]" >
                <Timeline
                    tracks={tracks}
                    clips={clips}
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
            </div >

            {/* Context Menu */}
            {
                contextMenu && (
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
                                {t('editor.contextMenu.split')}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="justify-start h-8 px-2"
                                onClick={() => handleDuplicateClip(contextMenu.clipId)}
                            >
                                <Copy size={14} className="mr-2" />
                                {t('editor.contextMenu.duplicate')}
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
                                {t('editor.contextMenu.delete')}
                            </Button>
                        </div>
                    </div>
                )
            }

            {/* Fullscreen Preview Overlay */}
            {isPreviewFullscreen && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-black">
                    <div className="absolute top-4 right-4 z-50">
                        <Button
                            variant="secondary"
                            size="icon"
                            className="h-10 w-10 rounded-md bg-white/10 hover:bg-white/20 border border-white/20"
                            onClick={() => setIsPreviewFullscreen(false)}
                            title={t('editor.preview.exitFullscreen')}
                        >
                            <X size={20} />
                        </Button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                        <div className="w-full h-full max-w-[calc(100vh*16/9)] max-h-full aspect-video flex justify-center items-center">
                            <Player
                                ref={onFullscreenPlayerRef}
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
                            onSeek={handleSeek}
                            className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                        />
                        <div className="flex items-center justify-center gap-4">
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => handleSeek(0)}>
                                <SkipBack size={20} />
                            </Button>
                            <Button variant="outline" size="icon" className="rounded-full h-12 w-12 border-primary/50 bg-primary/20 text-primary hover:bg-primary/30" onClick={togglePlay}>
                                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => handleSeek(totalFrames)}>
                                <SkipForward size={20} />
                            </Button>
                            <div className="ml-4">
                                <FullscreenFrameDisplay totalFrames={totalFrames} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <AiGeneratorDialog
                open={isAiOpen}
                onOpenChange={setIsAiOpen}
                onGenerate={handleAiGenerate}
                availableTachies={assets.filter(a => a.type === 'tachie').map(a => ({ name: a.name, url: a.url }))}
            />
        </div >
    );
}
