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
    const [selectedTachie, setSelectedTachie] = useState('');
    const [psdLayers, setPsdLayers] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (availableTachies.length > 0 && !selectedTachie) {
            setSelectedTachie(availableTachies[0].url);
        }
    }, [availableTachies]);

    useEffect(() => {
        if (selectedTachie) {
            const extractLayers = async () => {
                try {
                    const res = await fetch(selectedTachie);
                    const buffer = await res.arrayBuffer();
                    const psd = readPsd(buffer, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });

                    const names: string[] = [];
                    const traverse = (children: any[], path = '') => {
                        // Reverse needed? ag-psd returns bottom-up? Check Editor.tsx logic.
                        // Editor says: ag-psd returns layers from bottom to top.
                        // For UI list (and likely AI context), top to bottom is more intuitive usually?
                        // But Editor reverses it. Let's replicate.
                        [...children].reverse().forEach(child => {
                            const currentPath = path ? `${path}/${child.name}` : (child.name || 'Layer');
                            names.push(currentPath);
                            if (child.children) traverse(child.children, currentPath);
                        });
                    };
                    if (psd.children) traverse(psd.children);
                    setPsdLayers(names);
                } catch (e) {
                    console.error("Failed to extract PSD layers", e);
                }
            };
            extractLayers();
        } else {
            setPsdLayers([]);
        }
    }, [selectedTachie]);

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
                    tachieUrl: selectedTachie,
                    tachieLayers: psdLayers
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="text-purple-500" size={20} />
                        AI Video Generator
                    </DialogTitle>
                    <DialogDescription>
                        Desribe the video you want to create (e.g., "Explain React useMemo").
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

                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Character (Tachie)</label>
                        <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={selectedTachie}
                            onChange={(e) => setSelectedTachie(e.target.value)}
                        >
                            {availableTachies.map((t, idx) => (
                                <option key={idx} value={t.url}>{t.name}</option>
                            ))}
                            {availableTachies.length === 0 && <option value="">No PSDs found</option>}
                        </select>
                        <p className="text-[10px] text-muted-foreground">
                            {psdLayers.length > 0 ? `Detected ${psdLayers.length} layers for auto-expression.` : 'Select a PSD to enable dynamic expressions.'}
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
