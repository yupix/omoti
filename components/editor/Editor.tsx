"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Clip, Track } from '@/types';
import { Timeline } from './Timeline';
import '@/lib/i18n'; // Initialize i18n
import { useTranslation } from 'react-i18next';
import { PropertiesPanel } from './PropertiesPanel';
import { AssetsPanel } from './AssetsPanel';
import { AiGeneratorDialog } from './AiGeneratorDialog';
import { AiEditorDialog } from './AiEditorDialog';
import { applyEditPlan, sameProject, type EditPlan, type EditorProject } from '@/lib/ai-edit';
import { IconBrowser } from './IconBrowser';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { INITIAL_CLIPS, INITIAL_TRACKS } from './constants';
import { getSnapshot as getEditorFrame } from './editorFrameStore';
import { useAssetLibrary } from './useAssetLibrary';
import { useSynth } from './useSynth';
import { useEditorHistory } from './useEditorHistory';
import { useTachieLayers, useTachiePresets } from './useTachieLayers';
import { usePlayerControls } from './usePlayerControls';
import { useClipOperations } from './useClipOperations';
import { ActivityBar, type SidebarTab } from './ActivityBar';
import { EditorSidebar } from './EditorSidebar';
import { EditorHeader } from './EditorHeader';
import { PreviewViewport } from './PreviewViewport';
import { TransportControls } from './TransportControls';
import { FullscreenPreview } from './FullscreenPreview';
import { UploadToast } from './UploadToast';
import { ClipContextMenu, type ClipContextMenuState } from './ClipContextMenu';

export default function Editor() {
    const { t } = useTranslation();
    const [primaryColor, setPrimaryColor] = useState('#6d28d9');
    const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS); // Static tracks for now
    const [clips, setClips] = useState<Clip[]>(INITIAL_CLIPS);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [activeTab, setActiveTab] = useState<SidebarTab>('properties');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [localVolume, setLocalVolume] = useState<number | null>(null);
    const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [isAiEditOpen, setIsAiEditOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<ClipContextMenuState | null>(null);

    const {
        assets, setAssets, assetFolders, setAssetFolders,
        isUploading, uploadProgress, uploadError, setUploadError, uploadAbort,
        uploadFiles, removeAsset, handleFileUpload,
        createFolder, renameFolder, deleteFolder,
        moveAssetToFolder, renameAsset, moveFolderToFolder,
    } = useAssetLibrary({ onUploadsFinished: () => setActiveTab('assets') });

    const {
        synthProvider, setSynthProvider,
        aivoiceBaseUrl, setAivoiceBaseUrl,
        voicevoxBaseUrl, setVoicevoxBaseUrl,
        cevioaiBaseUrl, setCevioaiBaseUrl,
        voicevoxSpeakers, cevioaiSpeakers,
        selectedVoicevoxSpeaker, setSelectedVoicevoxSpeaker,
        selectedVoicevoxStyle, setSelectedVoicevoxStyle,
        selectedCevioaiSpeaker, setSelectedCevioaiSpeaker,
        aiVoicePresets, selectedAiVoicePreset, setSelectedAiVoicePreset,
        isSynthesizing, setIsSynthesizing,
    } = useSynth();

    const {
        player, isPlaying, currentFrameRef,
        onMainPlayerRef, onFullscreenPlayerRef,
        seek, togglePlay,
    } = usePlayerControls({ isPreviewFullscreen });

    const { tachiePresets, setTachiePresets } = useTachiePresets();

    // Load editor state from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('omoti_editor_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.tracks && parsed.tracks.length > 0) setTracks(parsed.tracks);
                if (parsed.clips) setClips(parsed.clips);
                if (parsed.primaryColor) setPrimaryColor(parsed.primaryColor);
                if (parsed.assets) setAssets(parsed.assets);
                if (parsed.assetFolders) setAssetFolders(parsed.assetFolders);
                if (parsed.synthProvider) setSynthProvider(parsed.synthProvider);
                if (parsed.aivoiceBaseUrl) setAivoiceBaseUrl(parsed.aivoiceBaseUrl);
                if (parsed.voicevoxBaseUrl) setVoicevoxBaseUrl(parsed.voicevoxBaseUrl);
                if (parsed.cevioaiBaseUrl) setCevioaiBaseUrl(parsed.cevioaiBaseUrl);
                if (parsed.selectedVoicevoxSpeaker) setSelectedVoicevoxSpeaker(parsed.selectedVoicevoxSpeaker);
                if (parsed.selectedVoicevoxStyle !== undefined) setSelectedVoicevoxStyle(parsed.selectedVoicevoxStyle);
                if (parsed.selectedCevioaiSpeaker) setSelectedCevioaiSpeaker(parsed.selectedCevioaiSpeaker);
            } catch (e) {
                console.error('Failed to load saved state', e);
            }
        }
        setIsLoaded(true);
    }, [setAssets, setAssetFolders, setSynthProvider, setAivoiceBaseUrl, setVoicevoxBaseUrl, setCevioaiBaseUrl, setSelectedVoicevoxSpeaker, setSelectedVoicevoxStyle, setSelectedCevioaiSpeaker]);

    // Save editor state to localStorage
    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('omoti_editor_state', JSON.stringify({
            tracks,
            clips,
            primaryColor,
            assets,
            assetFolders,
            synthProvider,
            aivoiceBaseUrl,
            voicevoxBaseUrl,
            cevioaiBaseUrl,
            selectedVoicevoxSpeaker,
            selectedVoicevoxStyle,
            selectedCevioaiSpeaker
        }));
    }, [tracks, clips, primaryColor, assets, assetFolders, isLoaded, synthProvider, aivoiceBaseUrl, voicevoxBaseUrl, cevioaiBaseUrl, selectedVoicevoxSpeaker, selectedVoicevoxStyle, selectedCevioaiSpeaker]);

    // Dynamic total frames based on content + buffer
    const maxClipEnd = Math.max(0, ...clips.map(c => (c.startFrame || 0) + (c.durationInFrames || 0)));
    const totalFrames = Math.max(300, (isNaN(maxClipEnd) ? 0 : maxClipEnd) + 150); // Minimum 10s, or content + 5s buffer

    const inputProps = useMemo(() => ({
        clips,
        primaryColor,
        assetBaseUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
    }), [clips, primaryColor]);

    const selectedClip = clips.find(c => c.id === selectedClipId);

    const {
        availableLayers, collapsedPaths, setCollapsedPaths, pathsWithChildren,
    } = useTachieLayers(selectedClip, setClips);

    const {
        updateClip, batchUpdateClip, updateStyle, updateAnimation,
        addClip, removeClip, deleteClip, moveClip, resizeClip,
        splitClip, duplicateClip,
    } = useClipOperations({
        clips, setClips, tracks, setTracks,
        selectedClipId, setSelectedClipId,
        currentFrameRef, totalFrames,
    });

    const { undo, redo, recordImmediate } = useEditorHistory({
        clips, tracks, primaryColor,
        setClips, setTracks, setPrimaryColor, isLoaded,
    });

    const handleTimelineDrop = useCallback(async (e: React.DragEvent, trackId: number, frame: number) => {
        try {
            // Check if OMoti internal clip drag
            const dataStr = e.dataTransfer.getData('application/omoti-clip');
            if (dataStr) {
                const data = JSON.parse(dataStr);
                addClip(data.type, data.content, data.duration, frame, trackId, data.width, data.height);
                return;
            }

            // Check if Native OS File Drag & Drop
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const files = Array.from(e.dataTransfer.files);
                let currentFrameOffset = frame;
                await uploadFiles(files, asset => {
                    addClip(asset.type, asset.url, asset.duration, currentFrameOffset, trackId, asset.width, asset.height);
                    currentFrameOffset += asset.duration ? Math.ceil(asset.duration * 30) : 60;
                });
            }
        } catch (err) {
            console.error('Failed to parse drop data', err);
        }
    }, [addClip, uploadFiles]);

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
                undo();
                return;
            }

            // Redo (Ctrl+Shift+Z, Cmd+Shift+Z, Ctrl+Y, Cmd+Y)
            if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) ||
                ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) {
                e.preventDefault();
                redo();
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedClipId) {
                    deleteClip(selectedClipId);
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
                    seek(Math.max(0, getEditorFrame() - 1));
                }
            }

            if (e.key === 'ArrowRight') {
                if (!selectedClipId) {
                    e.preventDefault();
                    seek(Math.min(totalFrames, getEditorFrame() + 1));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedClipId, seek, totalFrames, undo, redo, deleteClip]);

    // Close context menu on click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleTabSelect = (tab: SidebarTab) => {
        if (activeTab === tab && !isSidebarCollapsed) {
            setIsSidebarCollapsed(true);
        } else {
            setActiveTab(tab);
            setIsSidebarCollapsed(false);
        }
    };

    const handleAddTrack = () => {
        const newId = Math.max(...tracks.map(t => t.id), 0) + 1;
        setTracks([...tracks, { id: newId, name: `Track ${newId}` }]);
    };

    const handleTrackNameChange = (id: number, newName: string) => {
        setTracks(tracks.map(t => t.id === id ? { ...t, name: newName } : t));
    };

    const handleRemoveTrack = (id: number) => {
        if (confirm('Are you sure you want to delete this track? All clips on it will be removed.')) {
            setTracks(prev => prev.filter(t => t.id !== id));
            setClips(prev => prev.filter(c => c.trackId !== id));
        }
    };

    const handleClipContextMenu = (e: React.MouseEvent, clipId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, clipId });
        setSelectedClipId(clipId);
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

    const handleAiEdit = (original: EditorProject, plan: EditPlan, selectedIds?: string[]) => {
        const current = { clips, tracks, primaryColor };
        if (!sameProject(current, original)) throw new Error('タイムラインが変更されました。編集案を作り直してください。');
        const next = applyEditPlan(current, plan, selectedIds);
        recordImmediate(current, next);
        setClips(next.clips);
        setTracks(next.tracks);
        if (selectedClipId && !next.clips.some(clip => clip.id === selectedClipId)) setSelectedClipId(null);
    };

    const handleAiGenerate = (newClips: Clip[]) => {
        if (confirm("This will replace your current timeline. Continue?")) {
            // Dynamically generate tracks based on clips
            const usedTrackIds = Array.from(new Set(newClips.map(c => c.trackId)));

            const newTracks: Track[] = usedTrackIds.sort((a, b) => a - b).map(id => {
                const trackClips = newClips.filter(clip => clip.trackId === id);
                let name = `Overlay ${id}`;
                if (trackClips.every(clip => clip.title === 'Subtitle')) name = 'Subtitles';
                else if (trackClips.every(clip => clip.title === 'Main Title')) name = 'Title';
                else if (trackClips.every(clip => clip.type === 'tachie')) name = 'Characters';
                else if (trackClips.every(clip => clip.type === 'audio')) name = 'Audio/BGM';
                else if (trackClips.every(clip => clip.title === 'Background')) name = 'Background';

                return { id, name };
            });

            setTracks(newTracks);
            setClips(newClips);
            alert("Video generated successfully!");
        }
    };

    const sidebarTitle = activeTab === 'properties' ? t('editor.tabs.properties')
        : activeTab === 'assets' ? t('editor.tabs.assets') : 'Icons';

    return (
        <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans">
            <UploadToast
                progress={uploadProgress}
                error={uploadError}
                onCancel={() => uploadAbort.current?.abort()}
                onDismissError={() => setUploadError('')}
            />
            <div className="flex flex-1 overflow-hidden">
                {/* VS Code style Activity Bar (Permanent) */}
                <ActivityBar
                    activeTab={activeTab}
                    collapsed={isSidebarCollapsed}
                    onSelect={handleTabSelect}
                />

                <EditorSidebar
                    collapsed={isSidebarCollapsed}
                    title={sidebarTitle}
                    onCollapse={() => setIsSidebarCollapsed(true)}
                >
                    {activeTab === 'properties' ? (
                        <PropertiesPanel
                            selectedClip={selectedClip || null}
                            localVolume={localVolume}
                            setLocalVolume={setLocalVolume}
                            handleUpdateClip={updateClip}
                            handleBatchUpdateClip={batchUpdateClip}
                            handleUpdateStyle={updateStyle}
                            handleUpdateAnimation={updateAnimation}
                            removeClip={removeClip}
                            addClip={addClip}
                            tachieAssets={assets.filter(asset => asset.type === 'tachie')}
                            tachiePresets={tachiePresets}
                            setTachiePresets={setTachiePresets}
                            availableLayers={availableLayers}
                            collapsedPaths={collapsedPaths}
                            setCollapsedPaths={setCollapsedPaths}
                            pathsWithChildren={pathsWithChildren}
                            aiVoicePresets={aiVoicePresets}
                            selectedAiVoicePreset={selectedAiVoicePreset}
                            setSelectedAiVoicePreset={setSelectedAiVoicePreset}
                            cevioaiSpeakers={cevioaiSpeakers}
                            selectedCevioaiSpeaker={selectedCevioaiSpeaker}
                            setSelectedCevioaiSpeaker={setSelectedCevioaiSpeaker}
                            synthProvider={synthProvider}
                            setSynthProvider={setSynthProvider}
                            aivoiceBaseUrl={aivoiceBaseUrl}
                            setAivoiceBaseUrl={setAivoiceBaseUrl}
                            voicevoxBaseUrl={voicevoxBaseUrl}
                            setVoicevoxBaseUrl={setVoicevoxBaseUrl}
                            cevioaiBaseUrl={cevioaiBaseUrl}
                            setCevioaiBaseUrl={setCevioaiBaseUrl}
                            voicevoxSpeakers={voicevoxSpeakers}
                            selectedVoicevoxSpeaker={selectedVoicevoxSpeaker}
                            setSelectedVoicevoxSpeaker={setSelectedVoicevoxSpeaker}
                            selectedVoicevoxStyle={selectedVoicevoxStyle}
                            setSelectedVoicevoxStyle={setSelectedVoicevoxStyle}
                            isSynthesizing={isSynthesizing}
                            setIsSynthesizing={setIsSynthesizing}
                            primaryColor={primaryColor}
                            setPrimaryColor={setPrimaryColor}
                            t={t}
                        />
                    ) : activeTab === 'assets' ? (
                        <AssetsPanel
                            handleFileUpload={handleFileUpload}
                            uploadFiles={uploadFiles}
                            isUploading={isUploading}
                            assets={assets}
                            assetFolders={assetFolders}
                            addClip={addClip}
                            removeAsset={removeAsset}
                            createFolder={createFolder}
                            renameFolder={renameFolder}
                            renameAsset={renameAsset}
                            deleteFolder={deleteFolder}
                            moveAssetToFolder={moveAssetToFolder}
                            moveFolderToFolder={moveFolderToFolder}
                            t={t}
                        />
                    ) : (
                        <IconBrowser addClip={addClip} />
                    )}
                </EditorSidebar>

                <div className="flex-1 flex flex-col min-w-0">
                    <Group orientation="vertical">
                        <Panel defaultSize={60} minSize={30} className="flex flex-col relative min-h-0 bg-stone-950">
                            <EditorHeader
                                onSaveProject={handleSaveProject}
                                onLoadProject={handleLoadProject}
                                onExport={handleExport}
                                isExporting={isExporting}
                                onAiCreate={() => setIsAiOpen(true)}
                                onAiEdit={() => { player?.pause(); setIsAiEditOpen(true); }}
                                aiEditDisabled={!isLoaded || !clips.length}
                            />

                            <div className="flex-1 flex flex-col relative min-h-0">
                                {/* Viewport */}
                                <PreviewViewport
                                    playerRef={onMainPlayerRef}
                                    showPlayer={!isPreviewFullscreen}
                                    inputProps={inputProps}
                                    totalFrames={totalFrames}
                                    clips={clips}
                                    selectedClip={selectedClip}
                                    selectedClipId={selectedClipId}
                                    onClipClick={setSelectedClipId}
                                    onBackgroundClick={() => setSelectedClipId(null)}
                                    onUpdateClip={batchUpdateClip}
                                    onFullscreen={() => setIsPreviewFullscreen(true)}
                                />

                                {/* Transport Controls */}
                                <TransportControls
                                    isPlaying={isPlaying}
                                    onTogglePlay={togglePlay}
                                    onSeek={seek}
                                    totalFrames={totalFrames}
                                />
                            </div>
                        </Panel>

                        <Separator className="h-1.5 bg-border/50 hover:bg-primary/40 transition-all cursor-row-resize active:bg-primary flex justify-center items-center group/sep-v z-40">
                            <div className="w-10 h-1 bg-muted-foreground/20 group-hover/sep-v:bg-primary/60 rounded-full transition-colors" />
                        </Separator>

                        {/* Bottom: Timeline */}
                        <Panel defaultSize={40} minSize={20} className="shadow-[0_-5px_20px_rgba(0,0,0,0.3)] z-30">
                            <div className="h-full w-full">
                                <Timeline
                                    tracks={tracks}
                                    clips={clips}
                                    onSeek={seek}
                                    onClipClick={id => setSelectedClipId(id)}
                                    onClipMove={moveClip}
                                    onClipResize={resizeClip}
                                    onTimelineDrop={handleTimelineDrop}
                                    onAddTrack={handleAddTrack}
                                    onUpdateTrackName={handleTrackNameChange}
                                    onRemoveTrack={handleRemoveTrack}
                                    onContextMenu={handleClipContextMenu}
                                    selectedClipId={selectedClipId}
                                    totalFrames={totalFrames}
                                />
                            </div>
                        </Panel>
                    </Group>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <ClipContextMenu
                    menu={contextMenu}
                    onSplit={(clipId) => { splitClip(clipId); setContextMenu(null); }}
                    onDuplicate={duplicateClip}
                    onDelete={(clipId) => { deleteClip(clipId); setContextMenu(null); }}
                />
            )}

            {/* Fullscreen Preview Overlay */}
            {isPreviewFullscreen && (
                <FullscreenPreview
                    playerRef={onFullscreenPlayerRef}
                    inputProps={inputProps}
                    totalFrames={totalFrames}
                    isPlaying={isPlaying}
                    onTogglePlay={togglePlay}
                    onSeek={seek}
                    onClose={() => setIsPreviewFullscreen(false)}
                />
            )}

            {isAiEditOpen && <AiEditorDialog project={{ clips, tracks, primaryColor }} selectedClipId={selectedClipId}
                currentFrame={getEditorFrame()} onOpenChange={setIsAiEditOpen} onApply={handleAiEdit} />}
            <AiGeneratorDialog
                open={isAiOpen}
                onOpenChange={setIsAiOpen}
                onGenerate={handleAiGenerate}
                availableTachies={assets.filter(a => a.type === 'tachie').map(a => ({ name: a.name, url: a.url }))}
            />
        </div >
    );
}
