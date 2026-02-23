import React from 'react';
import { useEditorFrame } from './useEditorFrame';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { Clip, ClipType } from '@/types';
import { bundledLanguages } from 'shiki';
import {
    Layers, Plus, Trash2, Clock, Volume2, Bookmark, CheckSquare, ChevronDown, ChevronRight,
    FileText, Video as VideoIcon, Image as ImageIcon, Square, Circle, Code2, Grid, Smile, Loader2, Sparkles, Wand2
} from 'lucide-react';
import { FlowEditor } from './FlowEditor';
import { GOOGLE_FONTS, SYSTEM_FONTS } from '@/lib/fonts';
import { synthesizeVoice } from '@/lib/aivoice';
import { synthesizeVoicevox, VoicevoxSpeaker } from '@/lib/voicevox';
import { TFunction } from 'i18next';

interface PropertiesPanelProps {
    selectedClip: Clip | null;
    localVolume: number | null;
    setLocalVolume: (vol: number | null) => void;
    handleUpdateClip: (key: keyof Clip, value: any) => void;
    handleBatchUpdateClip: (updates: Partial<Clip>) => void;
    handleUpdateStyle: (key: string, value: any) => void;
    handleUpdateAnimation: (key: string, value: any) => void;
    removeClip: () => void;
    addClip: (type: ClipType, contentOverride?: string, durationOverride?: number) => void;
    tachiePresets: { id: string; name: string; assetUrl: string; layers: string[] }[];
    setTachiePresets: (presets: { id: string; name: string; assetUrl: string; layers: string[] }[]) => void;
    availableLayers: string[];
    collapsedPaths: Set<string>;
    setCollapsedPaths: (paths: Set<string>) => void;
    pathsWithChildren: Set<string>;
    aiVoicePresets: string[];
    selectedAiVoicePreset: string;
    setSelectedAiVoicePreset: (val: string) => void;
    cevioaiSpeakers: any[];
    selectedCevioaiSpeaker: string;
    setSelectedCevioaiSpeaker: (val: string) => void;
    synthProvider: 'aivoice' | 'voicevox' | 'cevioai';
    setSynthProvider: (val: 'aivoice' | 'voicevox' | 'cevioai') => void;
    aivoiceBaseUrl: string;
    setAivoiceBaseUrl: (val: string) => void;
    voicevoxBaseUrl: string;
    setVoicevoxBaseUrl: (val: string) => void;
    cevioaiBaseUrl: string;
    setCevioaiBaseUrl: (val: string) => void;
    voicevoxSpeakers: VoicevoxSpeaker[];
    selectedVoicevoxSpeaker: string;
    setSelectedVoicevoxSpeaker: (val: string) => void;
    selectedVoicevoxStyle: number;
    setSelectedVoicevoxStyle: (val: number) => void;
    isSynthesizing: boolean;
    setIsSynthesizing: (val: boolean) => void;
    primaryColor: string;
    setPrimaryColor: (val: string) => void;
    t: TFunction;
}

const PropertiesPanelInner: React.FC<PropertiesPanelProps> = ({
    selectedClip,
    localVolume,
    setLocalVolume,
    handleUpdateClip,
    handleBatchUpdateClip,
    handleUpdateStyle,
    handleUpdateAnimation,
    removeClip,
    addClip,
    tachiePresets,
    setTachiePresets,
    availableLayers,
    collapsedPaths,
    setCollapsedPaths,
    pathsWithChildren,
    aiVoicePresets,
    selectedAiVoicePreset,
    setSelectedAiVoicePreset,
    cevioaiSpeakers,
    selectedCevioaiSpeaker,
    setSelectedCevioaiSpeaker,
    synthProvider,
    setSynthProvider,
    aivoiceBaseUrl,
    setAivoiceBaseUrl,
    voicevoxBaseUrl,
    setVoicevoxBaseUrl,
    cevioaiBaseUrl,
    setCevioaiBaseUrl,
    voicevoxSpeakers,
    selectedVoicevoxSpeaker,
    setSelectedVoicevoxSpeaker,
    selectedVoicevoxStyle,
    setSelectedVoicevoxStyle,
    isSynthesizing,
    setIsSynthesizing,
    primaryColor,
    setPrimaryColor,
    t
}) => {
    const currentFrame = useEditorFrame();
    return (
        <>
            {selectedClip ? (
                <div className="space-y-4 animate-in slide-in-from-left duration-300">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t('editor.properties.title')}</h2>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/20" onClick={removeClip}>
                            <Trash2 size={14} />
                        </Button>
                    </div>

                    {(selectedClip.type === 'video' || selectedClip.type === 'audio' || (selectedClip.type === 'image' && selectedClip.content.toLowerCase().endsWith('.gif'))) && (
                        <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-border bg-card">
                            <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.playbackSpeed')}</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    max="10"
                                    className="h-8 text-xs font-mono"
                                    value={selectedClip.playbackRate || 1}
                                    onChange={(e) => handleUpdateClip('playbackRate', parseFloat(e.target.value) || 1)}
                                />
                                <span className="text-xs text-muted-foreground w-8 text-right">
                                    {(selectedClip.playbackRate || 1).toFixed(1)}x
                                </span>
                            </div>
                        </div>
                    )}

                    {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
                        <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-border bg-card">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.volume')}</Label>
                                <span className="text-xs text-muted-foreground font-mono">
                                    {Math.round((localVolume ?? selectedClip.volume ?? 1) * 100)}%
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Volume2 size={14} className="text-muted-foreground" />
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                    value={localVolume ?? selectedClip.volume ?? 1}
                                    onChange={(e) => setLocalVolume(parseFloat(e.target.value))}
                                    onPointerUp={() => {
                                        if (localVolume !== null) {
                                            handleUpdateClip('volume', localVolume);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    <Card className="bg-secondary/20 border-border/40">
                        <CardHeader className="p-3 pb-0">
                            <CardTitle className="text-xs font-medium text-muted-foreground">{t('editor.properties.content')}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 space-y-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.label')}</Label>
                                <Input
                                    value={selectedClip.title || ''}
                                    onChange={e => handleUpdateClip('title', e.target.value)}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.value')}</Label>
                                {selectedClip.type === 'code' ? (
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.language')}</Label>
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
                                            <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.transitionDuration')}</Label>
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
                                                    <span>{t('editor.properties.timelinePreview')}</span>
                                                    <span>{selectedClip.durationInFrames}{t('editor.frames')}</span>
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
                                                <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.keyframes')}</Label>
                                                <Button
                                                    size="sm" variant="secondary" className="h-6 px-2 text-[10px] hover:bg-primary hover:text-primary-foreground"
                                                    onClick={() => {
                                                        const offset = Math.max(0, currentFrame - selectedClip.startFrame);
                                                        const steps = selectedClip.steps || [];
                                                        const prevStep = [...steps].reverse().find(s => s.frameOffset <= offset);
                                                        const baseCode = prevStep ? prevStep.code : selectedClip.content;

                                                        const newSteps = [...steps.filter(s => s.frameOffset !== offset), {
                                                            code: baseCode,
                                                            frameOffset: offset
                                                        }].sort((a, b) => a.frameOffset - b.frameOffset);

                                                        handleUpdateClip('steps', newSteps);
                                                    }}
                                                >
                                                    <Plus size={12} className="mr-1" /> {t('editor.properties.addEffect')}
                                                </Button>
                                            </div>

                                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                                {(selectedClip.steps || [{ code: selectedClip.content, frameOffset: 0 }]).map((step, index) => (
                                                    <div key={index} className="space-y-2 p-2 rounded-md border border-border bg-background/50 relative group">
                                                        <div className="flex items-start gap-2 mb-1">
                                                            <div className="flex-1 space-y-1">
                                                                <div className="flex justify-between items-center">
                                                                    <Label className="text-[9px] uppercase text-muted-foreground">{t('editor.properties.startOffset')}</Label>
                                                                    <span className="text-[9px] font-mono text-muted-foreground bg-primary/10 px-1 rounded">
                                                                        {t('editor.global')}: {selectedClip.startFrame + step.frameOffset}{t('editor.frames')}
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
                                ) : selectedClip.type === 'tachie' ? (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                                                    <Bookmark size={10} /> Presets
                                                </Label>
                                                <Button
                                                    size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1"
                                                    onClick={() => {
                                                        const name = prompt('Preset Name:');
                                                        if (!name) return;
                                                        const newPreset = {
                                                            id: Math.random().toString(36).substr(2, 9),
                                                            name,
                                                            assetUrl: selectedClip.content,
                                                            layers: selectedClip.tachieLayers || []
                                                        };
                                                        setTachiePresets([...tachiePresets, newPreset]);
                                                    }}
                                                >
                                                    <Plus size={10} /> {t('editor.properties.savePreset')}
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {tachiePresets.filter(p => p.assetUrl === selectedClip.content).length === 0 ? (
                                                    <span className="text-[10px] text-muted-foreground italic">No presets for this asset.</span>
                                                ) : (
                                                    tachiePresets.filter(p => p.assetUrl === selectedClip.content).map(preset => (
                                                        <div key={preset.id} className="relative group">
                                                            <Button
                                                                size="sm" variant="secondary" className="h-6 px-3 text-[10px] bg-primary/10 hover:bg-primary/20 border-primary/20 transition-colors"
                                                                onClick={() => handleUpdateClip('tachieLayers', preset.layers)}
                                                            >
                                                                {preset.name}
                                                            </Button>
                                                            <button
                                                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full size-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setTachiePresets(tachiePresets.filter(p => p.id !== preset.id));
                                                                }}
                                                            >
                                                                <Trash2 size={8} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase text-muted-foreground">Visible Layers</Label>
                                            <div className="max-h-60 overflow-y-auto border border-border rounded-md p-2 bg-background/50 space-y-1 scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40">
                                                {availableLayers.length === 0 ? (
                                                    <p className="text-[10px] text-muted-foreground text-center py-4 italic">No layers found or loading structure...</p>
                                                ) : (
                                                    availableLayers.filter(path => {
                                                        // Hide if any of its parent paths are collapsed
                                                        const parts = path.split('/');
                                                        for (let i = 1; i < parts.length; i++) {
                                                            const parentPath = parts.slice(0, i).join('/');
                                                            if (collapsedPaths.has(parentPath)) return false;
                                                        }
                                                        return true;
                                                    }).map((path, idx) => {
                                                        const isActive = (selectedClip.tachieLayers || []).includes(path);
                                                        const isCollapsed = collapsedPaths.has(path);
                                                        const hasChildren = pathsWithChildren.has(path);
                                                        const parts = path.split('/');
                                                        const name = parts[parts.length - 1];
                                                        const indent = parts.length - 1;

                                                        return (
                                                            <div
                                                                key={idx}
                                                                className="flex items-center gap-1 hover:bg-primary/10 px-2 py-0.5 rounded-sm cursor-default group transition-colors"
                                                                style={{ paddingLeft: `${indent * 12 + 4}px` }}
                                                            >
                                                                <div
                                                                    className="size-4 flex items-center justify-center cursor-pointer hover:bg-primary/20 rounded transition-colors"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (!hasChildren) return;
                                                                        const next = new Set(collapsedPaths);
                                                                        if (isCollapsed) next.delete(path);
                                                                        else next.add(path);
                                                                        setCollapsedPaths(next);
                                                                    }}
                                                                >
                                                                    {hasChildren && (
                                                                        isCollapsed ? <ChevronRight size={10} className="text-muted-foreground" /> : <ChevronDown size={10} className="text-muted-foreground" />
                                                                    )}
                                                                </div>
                                                                <div
                                                                    className="flex items-center gap-2 flex-1 cursor-pointer"
                                                                    onClick={() => {
                                                                        const current = selectedClip.tachieLayers || [];
                                                                        const next = current.includes(path)
                                                                            ? current.filter(l => l !== path)
                                                                            : [...current, path];
                                                                        handleUpdateClip('tachieLayers', next);
                                                                    }}
                                                                >
                                                                    <div className={`size-3.5 rounded border-2 flex-shrink-0 transition-all flex items-center justify-center ${isActive ? 'bg-primary border-primary' : 'bg-transparent border-muted-foreground/30'}`}>
                                                                        {isActive && <CheckSquare size={10} className="text-primary-foreground" />}
                                                                    </div>
                                                                    <span className={`text-[10px] truncate select-none flex-1 ${isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>{name}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : selectedClip.type === 'flow' ? (
                                    <div className="space-y-4">
                                        <FlowEditor
                                            initialNodes={selectedClip.nodes || []}
                                            initialEdges={selectedClip.edges || []}
                                            onUpdate={(nodes, edges) => {
                                                handleBatchUpdateClip({ nodes, edges });
                                            }}
                                        />
                                    </div>
                                ) : selectedClip.type === 'text' ? (
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.content')}</Label>
                                            <textarea
                                                value={selectedClip.content}
                                                onChange={e => handleUpdateClip('content', e.target.value)}
                                                className="w-full h-24 p-2 text-xs font-sans bg-background border border-input rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                                            />
                                        </div>
                                        <div className="pt-2 border-t border-border/50 space-y-3">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.voiceSynthesizer') || 'Voice Synthesizer'}</Label>
                                                <div className="grid grid-cols-3 gap-1">
                                                    <Button variant={synthProvider === 'aivoice' ? 'default' : 'outline'} size="sm" className="h-7 text-[9px] px-1" onClick={() => setSynthProvider('aivoice')}>AIVOICE</Button>
                                                    <Button variant={synthProvider === 'voicevox' ? 'default' : 'outline'} size="sm" className="h-7 text-[9px] px-1" onClick={() => setSynthProvider('voicevox')}>VOICEVOX</Button>
                                                    <Button variant={synthProvider === 'cevioai' ? 'default' : 'outline'} size="sm" className="h-7 text-[8px] px-1" onClick={() => setSynthProvider('cevioai')}>CeVIO AI</Button>
                                                </div>
                                            </div>

                                            {synthProvider === 'aivoice' ? (
                                                <div className="space-y-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] uppercase text-muted-foreground">Preset</Label>
                                                        <Select value={selectedAiVoicePreset} onValueChange={setSelectedAiVoicePreset}>
                                                            <SelectTrigger className="h-8 text-xs bg-background">
                                                                <SelectValue placeholder="Select preset" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {aiVoicePresets.map(p => (
                                                                    <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] uppercase text-muted-foreground">Server URL</Label>
                                                        <Input
                                                            value={aivoiceBaseUrl}
                                                            onChange={e => setAivoiceBaseUrl(e.target.value)}
                                                            className="h-8 text-xs bg-background font-mono"
                                                            placeholder="http://localhost:8000"
                                                        />
                                                    </div>
                                                </div>
                                            ) : synthProvider === 'cevioai' ? (
                                                <div className="space-y-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] uppercase text-muted-foreground">Cast</Label>
                                                        <Select value={selectedCevioaiSpeaker} onValueChange={setSelectedCevioaiSpeaker}>
                                                            <SelectTrigger className="h-8 text-xs bg-background">
                                                                <SelectValue placeholder="Select cast" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {cevioaiSpeakers.map(s => (
                                                                    <SelectItem key={s.speaker_uuid} value={s.speaker_uuid} className="text-xs">{s.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] uppercase text-muted-foreground">Server URL</Label>
                                                        <Input
                                                            value={cevioaiBaseUrl}
                                                            onChange={e => setCevioaiBaseUrl(e.target.value)}
                                                            className="h-8 text-xs bg-background font-mono"
                                                            placeholder="http://localhost:8001"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] uppercase text-muted-foreground">Speaker</Label>
                                                        <Select value={selectedVoicevoxSpeaker} onValueChange={setSelectedVoicevoxSpeaker}>
                                                            <SelectTrigger className="h-8 text-xs bg-background">
                                                                <SelectValue placeholder="Select speaker" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {voicevoxSpeakers.map(s => (
                                                                    <SelectItem key={s.speaker_uuid} value={s.speaker_uuid} className="text-xs">{s.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] uppercase text-muted-foreground">Style</Label>
                                                        <Select
                                                            value={selectedVoicevoxStyle.toString()}
                                                            onValueChange={(val) => setSelectedVoicevoxStyle(parseInt(val))}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs bg-background">
                                                                <SelectValue placeholder="Select style" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {voicevoxSpeakers.find(s => s.speaker_uuid === selectedVoicevoxSpeaker)?.styles.map(st => (
                                                                    <SelectItem key={st.id} value={st.id.toString()} className="text-xs">{st.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] uppercase text-muted-foreground">Server URL</Label>
                                                        <Input
                                                            value={voicevoxBaseUrl}
                                                            onChange={e => setVoicevoxBaseUrl(e.target.value)}
                                                            className="h-8 text-xs bg-background font-mono"
                                                            placeholder="http://localhost:50021"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <Button
                                                size="sm"
                                                disabled={isSynthesizing || (synthProvider === 'aivoice' ? !aiVoicePresets.length : synthProvider === 'cevioai' ? !cevioaiSpeakers.length : !voicevoxSpeakers.length)}
                                                className="w-full h-8 text-[10px] gap-2 mt-2"
                                                onClick={async () => {
                                                    try {
                                                        const { synthesizeCevioai } = await import('@/lib/cevioai');
                                                        setIsSynthesizing(true);
                                                        if (synthProvider === 'aivoice') {
                                                            const result = await synthesizeVoice(aivoiceBaseUrl, selectedClip.content, selectedAiVoicePreset);
                                                            if (result) {
                                                                const audioDuration = result.duration || 2;
                                                                handleUpdateClip('durationInFrames', Math.ceil(audioDuration * 30));
                                                                addClip('audio', result.url, audioDuration);
                                                            } else {
                                                                alert('AIVOICE Synthesis failed. Is the server running?');
                                                            }
                                                        } else if (synthProvider === 'cevioai') {
                                                            const result = await synthesizeCevioai(cevioaiBaseUrl, selectedClip.content, selectedCevioaiSpeaker);
                                                            if (result) {
                                                                const audioDuration = result.duration || 2;
                                                                handleUpdateClip('durationInFrames', Math.ceil(audioDuration * 30));
                                                                addClip('audio', result.url, audioDuration);
                                                            } else {
                                                                alert('CeVIO AI Synthesis failed. Is the server running?');
                                                            }
                                                        } else {
                                                            const result = await synthesizeVoicevox(voicevoxBaseUrl, selectedClip.content, selectedVoicevoxStyle);
                                                            if (result) {
                                                                // Use HTMLAudioElement to get duration for VOICEVOX blob
                                                                const audio = new Audio(result.url);
                                                                audio.onloadedmetadata = () => {
                                                                    const duration = audio.duration || 3;
                                                                    handleUpdateClip('durationInFrames', Math.ceil(duration * 30));
                                                                    addClip('audio', result.url, duration);
                                                                };
                                                            } else {
                                                                alert('VOICEVOX Synthesis failed. Is the server running?');
                                                            }
                                                        }
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert('Synthesis error');
                                                    } finally {
                                                        setIsSynthesizing(false);
                                                    }
                                                }}
                                            >
                                                {isSynthesizing ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
                                                {t('editor.properties.generateVoice')}
                                            </Button>
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
                            {(selectedClip.type === 'shape' || selectedClip.type === 'text' || selectedClip.type === 'icon') && (
                                <div className="space-y-3 pt-2 border-t border-border/50">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.color')}</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                value={(selectedClip.style?.backgroundColor as string) || (selectedClip.style?.color as string) || '#ffffff'}
                                                onChange={e => handleUpdateStyle((selectedClip.type === 'text' || selectedClip.type === 'icon') ? 'color' : 'backgroundColor', e.target.value)}
                                                className="w-full h-8 p-1 cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    {selectedClip.type === 'text' && (
                                        <>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.fontFamily')}</Label>
                                                <Select
                                                    value={(selectedClip.style?.fontFamily as string) || 'sans-serif'}
                                                    onValueChange={(val) => handleUpdateStyle('fontFamily', val)}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Font" />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-[300px]">
                                                        <SelectGroup>
                                                            <SelectLabel className="text-[10px] uppercase text-muted-foreground px-2 py-1.5">System</SelectLabel>
                                                            {SYSTEM_FONTS.map(f => (
                                                                <SelectItem key={f.family} value={f.family}>{f.name}</SelectItem>
                                                            ))}
                                                        </SelectGroup>
                                                        <SelectSeparator />
                                                        <SelectGroup>
                                                            <SelectLabel className="text-[10px] uppercase text-muted-foreground px-2 py-1.5">Google Fonts</SelectLabel>
                                                            {GOOGLE_FONTS.map(f => (
                                                                <SelectItem key={f.family} value={f.family}>{f.name}</SelectItem>
                                                            ))}
                                                        </SelectGroup>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.fontSize')}</Label>
                                                <Input
                                                    type="number"
                                                    value={typeof selectedClip.style?.fontSize === 'string' ? parseInt(selectedClip.style.fontSize) : 80}
                                                    onChange={e => handleUpdateStyle('fontSize', `${e.target.value}px`)}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.fontWeight')}</Label>
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
                            <CardTitle className="text-xs font-medium text-muted-foreground">{t('editor.properties.animation')}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 space-y-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.type')}</Label>
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
                                <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.duration')}</Label>
                                <Input
                                    type="number"
                                    value={selectedClip.animation?.duration || 0}
                                    onChange={e => handleUpdateAnimation('duration', Number(e.target.value))}
                                    className="h-8 text-sm"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Effects Card */}
                    <Card className="bg-secondary/20 border-border/40">
                        <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Wand2 size={12} /> {t('editor.properties.effects') || 'Effects'}
                            </CardTitle>
                            <Button
                                size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-primary/20 text-primary"
                                onClick={() => {
                                    const effects = selectedClip.effects || [];
                                    handleUpdateClip('effects', [...effects, { type: 'glow', color: primaryColor, width: 10, blur: 10 }]);
                                }}
                            >
                                <Plus size={14} />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-3 space-y-3">
                            {!selectedClip.effects?.length && (
                                <p className="text-[10px] text-muted-foreground text-center py-2 italic">No effects added</p>
                            )}
                            {(selectedClip.effects || []).map((effect, idx) => (
                                <div key={idx} className="space-y-2 p-2 rounded-md border border-border/50 bg-background/30 relative group">
                                    <div className="flex items-center justify-between">
                                        <Select
                                            value={effect.type}
                                            onValueChange={(val: any) => {
                                                const next = [...(selectedClip.effects || [])];
                                                next[idx] = { ...effect, type: val };
                                                handleUpdateClip('effects', next);
                                            }}
                                        >
                                            <SelectTrigger className="h-6 text-[10px] w-24">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="glow">Glow</SelectItem>
                                                <SelectItem value="outline">Outline</SelectItem>
                                                <SelectItem value="shadow">Shadow</SelectItem>
                                                <SelectItem value="blur">Blur</SelectItem>
                                                <SelectItem value="sepia">Sepia</SelectItem>
                                                <SelectItem value="grayscale">Grayscale</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            size="icon" variant="ghost" className="h-5 w-5 text-destructive"
                                            onClick={() => {
                                                const next = (selectedClip.effects || []).filter((_, i) => i !== idx);
                                                handleUpdateClip('effects', next);
                                            }}
                                        >
                                            <Trash2 size={10} />
                                        </Button>
                                    </div>

                                    {(effect.type === 'glow' || effect.type === 'outline' || effect.type === 'shadow') && (
                                        <div className="flex gap-2">
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-[9px] text-muted-foreground">Color</Label>
                                                <Input
                                                    type="color"
                                                    value={effect.color || '#ffffff'}
                                                    onChange={e => {
                                                        const next = [...(selectedClip.effects || [])];
                                                        next[idx] = { ...effect, color: e.target.value };
                                                        handleUpdateClip('effects', next);
                                                    }}
                                                    className="h-6 p-0.5"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-[9px] text-muted-foreground">Size</Label>
                                                <Input
                                                    type="number"
                                                    value={effect.width ?? 5}
                                                    onChange={e => {
                                                        const next = [...(selectedClip.effects || [])];
                                                        next[idx] = { ...effect, width: parseInt(e.target.value) };
                                                        handleUpdateClip('effects', next);
                                                    }}
                                                    className="h-6 text-xs"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {(effect.type === 'glow' || effect.type === 'shadow' || effect.type === 'blur') && (
                                        <div className="space-y-1">
                                            <Label className="text-[9px] text-muted-foreground">Blur ({effect.blur ?? 5}px)</Label>
                                            <input
                                                type="range"
                                                min="0" max="50" step="1"
                                                value={effect.blur ?? 5}
                                                onChange={e => {
                                                    const next = [...(selectedClip.effects || [])];
                                                    next[idx] = { ...effect, blur: parseInt(e.target.value) };
                                                    handleUpdateClip('effects', next);
                                                }}
                                                className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                            />
                                        </div>
                                    )}
                                    {(effect.type === 'sepia' || effect.type === 'grayscale') && (
                                        <div className="space-y-1">
                                            <Label className="text-[9px] text-muted-foreground">Intensity ({(effect.opacity ?? 1) * 100}%)</Label>
                                            <input
                                                type="range"
                                                min="0" max="1" step="0.1"
                                                value={effect.opacity ?? 1}
                                                onChange={e => {
                                                    const next = [...(selectedClip.effects || [])];
                                                    next[idx] = { ...effect, opacity: parseFloat(e.target.value) };
                                                    handleUpdateClip('effects', next);
                                                }}
                                                className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="bg-secondary/20 border-border/40">
                        <CardHeader className="p-3 pb-0">
                            <CardTitle className="text-xs font-medium text-muted-foreground">{t('editor.properties.timing')}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.start')}</Label>
                                    <Input
                                        type="number"
                                        value={selectedClip.startFrame}
                                        onChange={e => handleUpdateClip('startFrame', Number(e.target.value))}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase text-muted-foreground">{t('editor.properties.measured')}</Label>
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
                    <p className="text-sm">{t('editor.properties.noSelection')}</p>
                </div>
            )}

            <div className="pt-4 border-t border-border/50">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{t('editor.addElement')}</h2>
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
                        <span className="text-[10px]">{t('editor.elements.text')}</span>
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
                        <span className="text-[10px]">{t('editor.elements.video')}</span>
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
                        <span className="text-[10px]">{t('editor.elements.image')}</span>
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
                        <span className="text-[10px]">{t('editor.elements.audio')}</span>
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
                        <span className="text-[10px]">{t('editor.elements.rect')}</span>
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
                        <span className="text-[10px]">{t('editor.elements.circle')}</span>
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
                        <span className="text-[10px]">{t('editor.elements.code')}</span>
                    </Button>
                    <Button
                        variant="outline" size="sm" className="flex flex-col h-16 gap-1 border-dashed hover:border-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing"
                        onClick={() => addClip('flow')}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('application/omoti-clip', JSON.stringify({ type: 'flow', content: 'New Flow' }));
                        }}
                    >
                        <Grid size={16} />
                        <span className="text-[10px]">{t('editor.elements.flow')}</span>
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
                        <span className="text-[10px]">{t('editor.elements.gif')}</span>
                    </Button>
                </div>
            </div>

            <div className="pt-4 border-t border-border/50">
                <Label className="text-xs text-muted-foreground mb-2 block">{t('editor.globalColor')}</Label>
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
    );
};

export const PropertiesPanel = React.memo(PropertiesPanelInner);
