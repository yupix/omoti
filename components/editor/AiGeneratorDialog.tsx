import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
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
    const [selectedTachieUrls, setSelectedTachieUrls] = useState<string[]>([]);
    const [tachieData, setTachieData] = useState<{ id: string, name: string, url: string, layers: string[], role: string }[]>([]);
    const [loadingLayers, setLoadingLayers] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (availableTachies.length > 0 && selectedTachieUrls.length === 0) {
            setSelectedTachieUrls([availableTachies[0].url]);
        }
    }, [availableTachies]);

    useEffect(() => {
        const extractAllLayers = async () => {
            if (selectedTachieUrls.length === 0) {
                setTachieData([]);
                return;
            }

            setLoadingLayers(true);
            try {
                const newData = await Promise.all(selectedTachieUrls.map(async (url) => {
                    const existing = tachieData.find(t => t.url === url);
                    if (existing && existing.layers.length > 0) return existing;

                    const tachie = availableTachies.find(t => t.url === url);
                    const name = tachie?.name || 'Unknown';

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
                    return { id: url, name, url, layers: layerNames, role: existing?.role || '' };
                }));
                // Filter out any duplicates and keep states
                setTachieData(newData);
            } catch (e) {
                console.error("Failed to extract PSD layers", e);
            } finally {
                setLoadingLayers(false);
            }
        };
        extractAllLayers();
    }, [selectedTachieUrls]);

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
                        url: t.url
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

    const toggleTachie = (url: string) => {
        setSelectedTachieUrls(prev =>
            prev.includes(url)
                ? prev.filter(u => u !== url)
                : [...prev, url]
        );
    };

    const updateTachieInfo = (url: string, field: 'name' | 'role', value: string) => {
        setTachieData(prev => prev.map(t => t.url === url ? { ...t, [field]: value } : t));
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
                        <label className="text-sm font-medium">Characters (Tachie) Selection & Roles</label>
                        <div className="grid gap-3 max-h-[300px] overflow-y-auto p-2 border rounded-md bg-secondary/20">
                            {availableTachies.map((t, idx) => {
                                const isSelected = selectedTachieUrls.includes(t.url);
                                const data = tachieData.find(d => d.url === t.url);

                                return (
                                    <div key={idx} className={`p-3 border rounded-lg transition-all ${isSelected ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-transparent border-transparent'}`}>
                                        <div className="flex items-center gap-3 mb-2">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleTachie(t.url)}
                                                className="w-4 h-4 rounded border-gray-300"
                                            />
                                            {isSelected ? (
                                                <Input
                                                    value={data?.name || t.name}
                                                    onChange={(e) => updateTachieInfo(t.url, 'name', e.target.value)}
                                                    className="h-7 text-xs font-bold bg-background/50"
                                                    placeholder="Character Name"
                                                />
                                            ) : (
                                                <span className="text-xs font-medium text-muted-foreground">{t.name}</span>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <div className="grid gap-1.5 ml-7">
                                                <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center justify-between">
                                                    AI Role / Personality
                                                    {data?.layers && <span className="text-primary/70">{data.layers.length} layers</span>}
                                                </label>
                                                <Input
                                                    placeholder="Teacher, grumpy student, energetic assistant..."
                                                    value={data?.role || ''}
                                                    onChange={(e) => updateTachieInfo(t.url, 'role', e.target.value)}
                                                    className="h-7 text-xs bg-background/50"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {availableTachies.length === 0 && <span className="text-xs text-center py-4 text-muted-foreground">No PSDs found in assets.</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            {loadingLayers ? (
                                <><Loader2 size={10} className="animate-spin" /> Analyzing PSDs...</>
                            ) : (
                                `Give characters roles to help the AI write better dialogue.`
                            )}
                        </p>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 p-2 rounded">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleGenerate} disabled={loading || !prompt.trim()}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {status || 'Generating...'}
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Generate
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
