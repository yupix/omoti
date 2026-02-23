import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, AlertCircle, Settings, CheckCircle2, Layers as LayersIcon, Folder, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import { Clip } from '@/types';
import { readPsd } from 'ag-psd';

interface AiGeneratorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onGenerate: (clips: Clip[]) => void;
    availableTachies: { name: string; url: string }[];
}

export function AiGeneratorDialog({ open, onOpenChange, onGenerate, availableTachies }: AiGeneratorDialogProps) {
    const [prompt, setPrompt] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [provider, setProvider] = useState('openai');
    const [psdLayers, setPsdLayers] = useState<Record<string, string[]>>({}); // Cache for PSD layers
    const [tachieData, setTachieData] = useState<{
        id: string, name: string, url: string, layers: string[], role: string,
        rules?: {
            mandatory: string[],
            exclusive: { name: string, path: string }[],
            optional: string[]
        },
        voice?: {
            provider: 'voicevox' | 'aivoice' | 'cevioai',
            voicevoxSpeaker: string,
            voicevoxStyle?: number,
            aivoicePreset: string,
            cevioaiSpeaker: string
        },
        facing?: 'left' | 'right'
    }[]>([]);
    const [configTachie, setConfigTachie] = useState<string | null>(null);
    const [configTachieTabs, setConfigTachieTabs] = useState<'layers' | 'voice'>('layers');
    const [fullPsdCache, setFullPsdCache] = useState<Record<string, any>>({});

    // Synthesis Metadata for Voice Config
    const [voicevoxSpeakers, setVoicevoxSpeakers] = useState<any[]>([]);
    const [aiVoicePresets, setAiVoicePresets] = useState<string[]>([]);
    const [cevioaiSpeakers, setCevioaiSpeakers] = useState<any[]>([]);

    // From Editor Context (passed via props or fetched here)
    // For simplicity, let's assume we can fetch them here based on URLs
    const voicevoxBaseUrl = 'http://127.0.0.1:50021';
    const aivoiceBaseUrl = 'http://localhost:8000';
    const cevioaiBaseUrl = 'http://localhost:8001';
    const [loadingLayers, setLoadingLayers] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');

    // Load persisted profiles on mount
    useEffect(() => {
        const saved = localStorage.getItem('omoti_character_profiles');
        if (saved && open) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setTachieData(parsed);
                }
            } catch (e) {
                console.error("Failed to load profiles", e);
            }
        }
    }, [open]);

    // Load voices
    useEffect(() => {
        if (open) {
            fetch(`/api/synthesize/metadata?provider=voicevox&baseUrl=${encodeURIComponent(voicevoxBaseUrl)}`)
                .then(r => r.json()).then(setVoicevoxSpeakers).catch(() => { });
            fetch(`/api/synthesize/metadata?provider=aivoice&baseUrl=${encodeURIComponent(aivoiceBaseUrl)}`)
                .then(r => r.json()).then(setAiVoicePresets).catch(() => { });
            fetch(`/api/synthesize/metadata?provider=cevioai&baseUrl=${encodeURIComponent(cevioaiBaseUrl)}`)
                .then(r => r.json()).then(setCevioaiSpeakers).catch(() => { });
        }
    }, [open]);

    // Save profiles when they change
    useEffect(() => {
        if (tachieData.length > 0) {
            localStorage.setItem('omoti_character_profiles', JSON.stringify(tachieData));
        }
    }, [tachieData]);

    const loadFullPsd = async (url: string) => {
        if (fullPsdCache[url]) return fullPsdCache[url];
        setLoadingPreview(true);
        try {
            const res = await fetch(url);
            const buffer = await res.arrayBuffer();
            const psd = readPsd(buffer); // Full load with image data
            setFullPsdCache(prev => ({ ...prev, [url]: psd }));
            return psd;
        } catch (e) {
            console.error("Failed to load full PSD", e);
            return null;
        } finally {
            setLoadingPreview(false);
        }
    };

    useEffect(() => {
        if (configTachie) {
            const data = tachieData.find(t => t.id === configTachie);
            if (data) loadFullPsd(data.url);
        }
    }, [configTachie]);

    const autoConfigure = (id: string) => {
        setTachieData(prev => prev.map(t => {
            if (t.id !== id) return t;

            const mandatory: string[] = [];
            const exclusive: { name: string, path: string }[] = [];
            const optional: string[] = [];

            // Basic keyword detection (Japanese focus)
            const folders = Array.from(new Set(t.layers
                .filter(l => l.includes('/'))
                .map(l => l.split('/').slice(0, 2).join('/'))
            ));

            folders.forEach(f => {
                const name = f.split('/').pop() || '';
                // Base components often named: 体, 服, 髪, 素体, ベース
                if (/[体服髪]|素体|ベース|Body|Clothes|Hair|Base/i.test(name)) {
                    mandatory.push(f);
                }
                // Group components often named: 目, 口, 眉, 表情, 腕, ポーズ
                else if (/[目口眉]|表情|腕|ポーズ|Eyes|Mouth|Brows|Pose|Arm/i.test(name)) {
                    exclusive.push({ name, path: f });
                }
            });

            return { ...t, rules: { mandatory, exclusive, optional } };
        }));
    };


    const loadPsdLayers = async (url: string) => {
        if (psdLayers[url]) return psdLayers[url];
        setLoadingLayers(true);
        try {
            const res = await fetch(url);
            const buffer = await res.arrayBuffer();
            const psd = readPsd(buffer, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
            const layerNames: string[] = [];
            const traverse = (children: any[], path = '') => {
                [...children].reverse().forEach(child => {
                    const currentPath = path ? `${path}/${child.name}` : (child.name || 'Layer');
                    layerNames.push(currentPath);
                    if (child.children) traverse(child.children, currentPath);
                });
            };
            if (psd.children) traverse(psd.children);
            setPsdLayers(prev => ({ ...prev, [url]: layerNames }));
            return layerNames;
        } catch (e) {
            console.error("Failed to extract PSD layers", e);
            return [];
        } finally {
            setLoadingLayers(false);
        }
    };

    const addCharacter = async (psdUrl: string, defaultName: string) => {
        const layers = await loadPsdLayers(psdUrl);
        const newId = `char-${Date.now()}`;
        setTachieData(prev => {
            const newData = [...prev, {
                id: newId,
                name: defaultName,
                url: psdUrl,
                layers: layers,
                role: '',
                rules: { mandatory: [], exclusive: [], optional: [] },
                voice: {
                    provider: 'voicevox' as const,
                    voicevoxSpeaker: '',
                    voicevoxStyle: undefined,
                    aivoicePreset: '',
                    cevioaiSpeaker: ''
                },
                facing: 'right' as const
            }];
            // Try auto-configure for new characters if they look like they need it
            return newData;
        });
        // Run auto-config after state update
        setTimeout(() => autoConfigure(newId), 10);
    };

    const removeCharacter = (id: string) => {
        setTachieData(prev => prev.filter(t => t.id !== id));
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        try {
            setLoading(true);
            setError('');
            setStatus('Thinking...');

            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    apiKey,
                    provider,
                    tachies: tachieData.map(t => ({
                        name: t.name,
                        role: t.role,
                        layers: t.layers,
                        url: t.url,
                        rules: t.rules,
                        voice: t.voice,
                        facing: (t.facing || 'right') as 'left' | 'right'
                    }))
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Generation failed');
            }

            setStatus('Synthesizing Voices...');
            const data = await res.json();

            if (data.clips) {
                onGenerate(data.clips);
                onOpenChange(false);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    const updateTachieInfo = (id: string, field: string, value: any) => {
        setTachieData(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const toggleRule = (id: string, type: 'mandatory' | 'exclusive' | 'optional', path: string) => {
        setTachieData(prev => prev.map(t => {
            if (t.id !== id) return t;
            const rules = { ...(t.rules || { mandatory: [], exclusive: [], optional: [] }) };
            if (type === 'mandatory') {
                rules.mandatory = rules.mandatory.includes(path)
                    ? rules.mandatory.filter(p => p !== path)
                    : [...rules.mandatory, path];
            } else if (type === 'exclusive') {
                rules.exclusive = rules.exclusive.some(g => g.path === path)
                    ? rules.exclusive.filter(g => g.path !== path)
                    : [...rules.exclusive, { name: path.split('/').pop() || '', path }];
            } else {
                rules.optional = (rules.optional || []).includes(path)
                    ? rules.optional.filter(p => p !== path)
                    : [...(rules.optional || []), path];
            }
            return { ...t, rules };
        }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="text-purple-500" size={20} />
                        AI Video Generator
                    </DialogTitle>
                    <DialogDescription>
                        Describe the video you want to create and configure your characters.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Topic / Script Idea</label>
                        <Textarea
                            placeholder="Explain the concept of React hooks in a simple way for beginners..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="min-h-[80px]"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">AI Provider</label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                value={provider}
                                onChange={(e) => setProvider(e.target.value)}
                            >
                                <option value="openai">OpenAI (GPT-4o)</option>
                                <option value="gemini">Google Gemini</option>
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium text-muted-foreground">API Key (Optional)</label>
                            <Input
                                type="password"
                                placeholder={provider === 'openai' ? "sk-..." : "AIza..."}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="text-xs"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4">
                        <label className="text-sm font-medium">Characters Configuration</label>
                        <div className="space-y-4">
                            {/* Selected Profiles */}
                            {tachieData.map((data) => (
                                <div key={data.id} className="p-3 border rounded-lg bg-primary/5 border-primary/30 shadow-sm relative group">
                                    <Button
                                        size="icon" variant="ghost"
                                        className="h-6 w-6 absolute top-1 right-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                                        onClick={() => removeCharacter(data.id)}
                                    >
                                        <Trash2 size={14} />
                                    </Button>

                                    <div className="flex gap-2 mb-2 items-center">
                                        <Input
                                            value={data.name}
                                            onChange={(e) => updateTachieInfo(data.id, 'name', e.target.value)}
                                            className="h-8 text-xs font-bold bg-background/50 flex-1"
                                            placeholder="Character Name"
                                        />
                                        <div className="text-[10px] text-muted-foreground max-w-[150px] truncate" title={data.url}>
                                            {data.url.split('/').pop()}
                                        </div>
                                    </div>

                                    <div className="grid gap-1.5 pl-1">
                                        <Input
                                            placeholder="AI Role: e.g. Teacher, energetic helper..."
                                            value={data.role}
                                            onChange={(e) => updateTachieInfo(data.id, 'role', e.target.value)}
                                            className="h-7 text-xs bg-background/50 shadow-none border-dashed"
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost" size="sm"
                                                className="h-6 gap-1 text-[10px] text-primary hover:text-primary hover:bg-primary/10 p-1 mt-0.5 justify-start w-fit shadow-none"
                                                onClick={() => { setConfigTachie(data.id); setConfigTachieTabs('layers'); }}
                                            >
                                                <Settings size={10} /> Configuration
                                            </Button>
                                            <Button
                                                variant="ghost" size="sm"
                                                className="h-6 gap-1 text-[10px] text-primary hover:text-primary hover:bg-primary/10 p-1 mt-0.5 justify-start w-fit shadow-none"
                                                onClick={() => { setConfigTachie(data.id); setConfigTachieTabs('voice'); }}
                                            >
                                                <div className="size-2 rounded-full bg-blue-500 animate-pulse" /> Voice
                                            </Button>
                                            <Button
                                                variant="ghost" size="sm"
                                                className="h-6 gap-1 text-[10px] text-muted-foreground hover:bg-secondary/20 p-1 mt-0.5 justify-start w-fit shadow-none"
                                                onClick={() => autoConfigure(data.id)}
                                            >
                                                <Sparkles size={10} /> Auto-Detect
                                            </Button>
                                            <div className="flex bg-secondary/20 rounded h-6 p-0.5 ml-auto">
                                                <button
                                                    className={`px-2 text-[8px] font-bold rounded-sm transition-all ${data.facing === 'left' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                                    onClick={() => updateTachieInfo(data.id, 'facing', 'left')}
                                                >
                                                    Left (←)
                                                </button>
                                                <button
                                                    className={`px-2 text-[8px] font-bold rounded-sm transition-all ${data.facing !== 'left' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                                    onClick={() => updateTachieInfo(data.id, 'facing', 'right')}
                                                >
                                                    Right (→)
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* PSD Source List */}
                            <div className="space-y-2 pt-2 border-t border-dashed">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Add Character from PSDs</label>
                                <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-1">
                                    {availableTachies.map((psd, idx) => (
                                        <Button
                                            key={idx}
                                            variant="outline"
                                            className="h-9 justify-start gap-2 text-[10px] overflow-hidden px-2"
                                            onClick={() => addCharacter(psd.url, psd.name.split('.')[0])}
                                            disabled={loadingLayers}
                                        >
                                            {loadingLayers ? <Loader2 size={10} className="animate-spin" /> : <LayersIcon size={12} />}
                                            <span className="truncate">{psd.name}</span>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleGenerate} disabled={loading || !prompt.trim()}>
                        {loading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {status || 'Generating...'}</>
                        ) : (
                            <><Sparkles className="mr-2 h-4 w-4" /> Generate</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>

            {/* Layer Rules Sub-Dialog */}
            <Dialog open={!!configTachie} onOpenChange={(o) => !o && setConfigTachie(null)}>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-row p-0 overflow-hidden">
                    {/* Left: Preview */}
                    <div className="w-[300px] bg-secondary/10 border-r flex flex-col p-4 gap-4">
                        <h4 className="text-[10px] font-bold uppercase text-muted-foreground">Character Base Preview</h4>
                        <TachiePreview
                            psd={fullPsdCache[tachieData.find(t => t.id === configTachie)?.url || '']}
                            mandatoryLayers={tachieData.find(t => t.id === configTachie)?.rules?.mandatory || []}
                            exclusiveGroups={tachieData.find(t => t.id === configTachie)?.rules?.exclusive?.map(e => e.path) || []}
                            loading={loadingPreview}
                        />
                        <div className="text-[9px] text-muted-foreground leading-relaxed">
                            This preview shows only <strong>Base (Mandatory)</strong> layers.
                            Use this to ensure you've selected enough parts to form the character's core appearance (Body, Hair, Outfit).
                            Expression layers (Eyes, Mouth) will be chosen by AI later.
                        </div>
                    </div>

                    {/* Right: Rules Config */}
                    <div className="flex-1 flex flex-col">
                        <div className="p-6 pb-2">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-sm">
                                    <LayersIcon size={16} />
                                    {configTachieTabs === 'layers' ? 'Structure' : 'Voice'} for {tachieData.find(t => t.id === configTachie)?.name || 'Character'}
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    {configTachieTabs === 'layers'
                                        ? 'Pick base/mandatory layers and define selection groups for expressions.'
                                        : 'Select the voice provider and character style for AI synthesis.'}
                                </DialogDescription>
                            </DialogHeader>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-2 bg-secondary/5">
                            {configTachieTabs === 'layers' ? (
                                <div className="space-y-4 py-2">
                                    {(() => {
                                        const data = tachieData.find(t => t.id === configTachie);
                                        if (!data) return null;

                                        const topFolders = Array.from(new Set(data.layers.map(l => l.split('/')[0])));

                                        const renderLevel = (path: string, depth: number) => {
                                            const children = data.layers.filter(l => {
                                                const parts = l.split('/');
                                                const parent = parts.slice(0, -1).join('/');
                                                return parent === path;
                                            });

                                            const subFolders = Array.from(new Set(data.layers
                                                .filter(l => l.startsWith(path + '/') && l.split('/').length === depth + 2)
                                                .map(l => l.split('/').slice(0, depth + 2).join('/'))
                                            ));

                                            const isUnderGroup = data.rules?.exclusive.some(g => (path + '/').startsWith(g.path + '/'));

                                            return (
                                                <div className="ml-4 border-l border-primary/10 pl-2 mt-1 space-y-1">
                                                    {subFolders.map(sf => {
                                                        const name = sf.split('/').pop();
                                                        return (
                                                            <div key={sf} className="space-y-1">
                                                                <div className="flex items-center justify-between group py-0.5">
                                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                        <Folder size={10} className="text-blue-400" /> {name}
                                                                    </span>
                                                                    {!isUnderGroup && (
                                                                        <div className="flex gap-1">
                                                                            <button onClick={() => toggleRule(data.id, 'mandatory', sf)} className={`px-1.5 py-0.5 rounded text-[8px] border transition-all ${data.rules?.mandatory.includes(sf) ? 'bg-green-500/20 border-green-500/50 text-green-600' : 'bg-transparent border-transparent text-muted-foreground hover:border-input'}`}>Base</button>
                                                                            <button onClick={() => toggleRule(data.id, 'exclusive', sf)} className={`px-1.5 py-0.5 rounded text-[8px] border transition-all ${data.rules?.exclusive.some(g => g.path === sf) ? 'bg-purple-500/20 border-purple-500/50 text-purple-600' : 'bg-transparent border-transparent text-muted-foreground hover:border-input'}`}>Group</button>
                                                                            <button onClick={() => toggleRule(data.id, 'optional', sf)} className={`px-1.5 py-0.5 rounded text-[8px] border transition-all ${data.rules?.optional?.includes(sf) ? 'bg-amber-500/20 border-amber-500/50 text-amber-600' : 'bg-transparent border-transparent text-muted-foreground hover:border-input'}`}>Extra</button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {depth < 3 && renderLevel(sf, depth + 1)}
                                                            </div>
                                                        );
                                                    })}
                                                    {children.filter(c => !subFolders.some(sf => c.startsWith(sf + '/'))).map(c => {
                                                        const name = c.split('/').pop();
                                                        return (
                                                            <div key={c} className="flex items-center justify-between group py-0.5 pr-1">
                                                                <span className="text-[9px] text-muted-foreground/80 flex items-center gap-1">
                                                                    <AlertCircle size={8} className="text-gray-400" /> {name}
                                                                </span>
                                                                {!isUnderGroup && (
                                                                    <div className="flex gap-1">
                                                                        <button onClick={() => toggleRule(data.id, 'mandatory', c)} className={`px-1.5 py-0.5 rounded text-[8px] border transition-all ${data.rules?.mandatory.includes(c) ? 'bg-green-500/20 border-green-500/50 text-green-600' : 'bg-transparent border-transparent text-muted-foreground hover:border-input'}`}>Base</button>
                                                                        <button onClick={() => toggleRule(data.id, 'optional', c)} className={`px-1.5 py-0.5 rounded text-[8px] border transition-all ${data.rules?.optional?.includes(c) ? 'bg-amber-500/20 border-amber-500/50 text-amber-600' : 'bg-transparent border-transparent text-muted-foreground hover:border-input'}`}>Extra</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        };

                                        return (
                                            <div className="space-y-4">
                                                {topFolders.map(tf => (
                                                    <div key={tf} className="border rounded p-2 bg-background/50 shadow-sm">
                                                        <div className="flex items-center justify-between border-b border-dashed pb-1 mb-1">
                                                            <span className="text-[11px] font-bold text-primary flex items-center gap-1"><Folder size={12} /> {tf}</span>
                                                            <div className="flex gap-1">
                                                                <button onClick={() => toggleRule(data.id, 'mandatory', tf)} className={`px-1.5 py-0.5 rounded text-[9px] border transition-all ${data.rules?.mandatory.includes(tf) ? 'bg-green-500/20 border-green-500/50 text-green-600' : 'bg-transparent border-transparent text-muted-foreground hover:border-input'}`}>Base</button>
                                                                <button onClick={() => toggleRule(data.id, 'exclusive', tf)} className={`px-1.5 py-0.5 rounded text-[9px] border transition-all ${data.rules?.exclusive.some(g => g.path === tf) ? 'bg-purple-500/20 border-purple-500/50 text-purple-600' : 'bg-transparent border-transparent text-muted-foreground hover:border-input'}`}>Group</button>
                                                                <button onClick={() => toggleRule(data.id, 'optional', tf)} className={`px-1.5 py-0.5 rounded text-[9px] border transition-all ${data.rules?.optional?.includes(tf) ? 'bg-amber-500/20 border-amber-500/50 text-amber-600' : 'bg-transparent border-transparent text-muted-foreground hover:border-input'}`}>Extra</button>
                                                            </div>
                                                        </div>
                                                        {renderLevel(tf, 0)}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="space-y-6 py-8">
                                    {(() => {
                                        const data = tachieData.find(t => t.id === configTachie);
                                        if (!data) return null;
                                        const voice = (data.voice || { provider: 'voicevox' as const }) as NonNullable<typeof data.voice>;

                                        return (
                                            <div className="grid gap-6">
                                                <div className="grid gap-2">
                                                    <label className="text-xs font-bold uppercase text-muted-foreground">Voice Provider</label>
                                                    <div className="flex gap-2">
                                                        <Button variant={voice.provider === 'voicevox' ? 'default' : 'outline'} className="flex-1 h-12" onClick={() => updateTachieInfo(data.id, 'voice', { ...voice, provider: 'voicevox' as const })}>VOICEVOX</Button>
                                                        <Button variant={voice.provider === 'aivoice' ? 'default' : 'outline'} className="flex-1 h-12" onClick={() => updateTachieInfo(data.id, 'voice', { ...voice, provider: 'aivoice' as const })}>AIVOICE</Button>
                                                        <Button variant={voice.provider === 'cevioai' ? 'default' : 'outline'} className="flex-1 h-12" onClick={() => updateTachieInfo(data.id, 'voice', { ...voice, provider: 'cevioai' as const })}>CeVIO AI</Button>
                                                    </div>
                                                </div>

                                                {voice.provider === 'voicevox' ? (
                                                    <>
                                                        <div className="grid gap-2">
                                                            <label className="text-xs font-bold uppercase text-muted-foreground">Speaker</label>
                                                            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={voice.voicevoxSpeaker || ''} onChange={(e) => {
                                                                const speaker = voicevoxSpeakers.find((s: any) => s.speaker_uuid === e.target.value);
                                                                updateTachieInfo(data.id, 'voice', { ...voice, voicevoxSpeaker: e.target.value, voicevoxStyle: speaker?.styles[0]?.id });
                                                            }}>
                                                                <option value="">Select Speaker...</option>
                                                                {voicevoxSpeakers.map((s: any) => <option key={s.speaker_uuid} value={s.speaker_uuid}>{s.name}</option>)}
                                                            </select>
                                                        </div>
                                                        {voice.voicevoxSpeaker && (
                                                            <div className="grid gap-2">
                                                                <label className="text-xs font-bold uppercase text-muted-foreground">Style</label>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {voicevoxSpeakers.find((s: any) => s.speaker_uuid === voice.voicevoxSpeaker)?.styles.map((style: any) => (
                                                                        <Button key={style.id} variant={voice.voicevoxStyle === style.id ? 'default' : 'outline'} size="sm" className="px-4" onClick={() => updateTachieInfo(data.id, 'voice', { ...voice, voicevoxStyle: style.id })}>{style.name}</Button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : voice.provider === 'aivoice' ? (
                                                    <div className="grid gap-2">
                                                        <label className="text-xs font-bold uppercase text-muted-foreground">Preset</label>
                                                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={voice.aivoicePreset || ''} onChange={(e) => updateTachieInfo(data.id, 'voice', { ...voice, aivoicePreset: e.target.value })}>
                                                            <option value="">Select Preset...</option>
                                                            {aiVoicePresets.map((p: string) => <option key={p} value={p}>{p}</option>)}
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-2">
                                                        <label className="text-xs font-bold uppercase text-muted-foreground">Cast</label>
                                                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={voice.cevioaiSpeaker || ''} onChange={(e) => updateTachieInfo(data.id, 'voice', { ...voice, cevioaiSpeaker: e.target.value })}>
                                                            <option value="">Select Cast...</option>
                                                            {cevioaiSpeakers.map((s: any) => <option key={s.speaker_uuid} value={s.speaker_uuid}>{s.name}</option>)}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t bg-background">
                            <Button className="w-full" size="sm" onClick={() => setConfigTachie(null)}>Apply Settings</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}

function TachiePreview({ psd, mandatoryLayers, exclusiveGroups, loading }: { psd: any; mandatoryLayers: string[]; exclusiveGroups: string[]; loading: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !psd) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear and draw
        canvas.width = psd.width;
        canvas.height = psd.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawLayers = (layers: any[], parentPath: string = '') => {
            // Draw from bottom-most (0) to top-most (length-1)
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                if (layer.hidden) continue;

                const currentPath = parentPath ? `${parentPath}/${layer.name}` : (layer.name || 'Layer');
                const isMandatory = mandatoryLayers.includes(currentPath);
                const isExclusiveGroup = exclusiveGroups.includes(currentPath);
                const hasMandatoryChild = mandatoryLayers.some(m => m.startsWith(currentPath + '/'));

                if (layer.children) {
                    if (isMandatory || hasMandatoryChild) {
                        drawLayers(layer.children, currentPath);
                    } else if (isExclusiveGroup) {
                        // For preview, just draw the first visible non-hidden child of an exclusive group
                        const firstChild = layer.children.find((c: any) => !c.hidden);
                        if (firstChild) {
                            drawLayers([firstChild], currentPath);
                        }
                    }
                } else if (isMandatory && layer.canvas) {
                    ctx.drawImage(layer.canvas, layer.left ?? 0, layer.top ?? 0);
                } else if (parentPath && exclusiveGroups.includes(parentPath) && layer.canvas) {
                    // This is a child of an exclusive group folder being drawn via the 'firstChild' logic above
                    ctx.drawImage(layer.canvas, layer.left ?? 0, layer.top ?? 0);
                }
            }
        };

        if (psd.children) drawLayers(psd.children);
    }, [psd, mandatoryLayers, exclusiveGroups]);

    return (
        <div className="relative w-full aspect-[3/4] bg-white rounded-lg overflow-hidden border shadow-inner flex items-center justify-center">
            {loading ? (
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin text-primary" size={24} />
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Decoding PSD...</span>
                </div>
            ) : psd ? (
                <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
            ) : (
                <div className="text-[10px] text-muted-foreground text-center p-4">
                    PSD data not loaded
                </div>
            )}
        </div>
    );
}
