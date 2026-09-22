"use client";

import { useState, useEffect, useCallback } from 'react';
import { Clip } from '@/types';
import { loadPsd } from '@/lib/psd';
import { describePsd } from '@/lib/psd-structure';

export interface TachiePreset {
    id: string;
    name: string;
    assetUrl: string;
    layers: string[];
    facing?: 'left' | 'right';
}

export function useTachiePresets() {
    const [tachiePresets, setTachiePresets] = useState<TachiePreset[]>([]);

    // Load tachie presets from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('omoti_tachie_presets');
        if (!saved) return;
        queueMicrotask(() => {
            try {
                setTachiePresets(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse tachie presets', e);
            }
        });
    }, []);

    // Save tachie presets to localStorage
    useEffect(() => {
        localStorage.setItem('omoti_tachie_presets', JSON.stringify(tachiePresets));
    }, [tachiePresets]);

    return { tachiePresets, setTachiePresets };
}

// Layer state is keyed to the clip identity (id + content + type), so selecting
// another clip or replacing the PSD source automatically reads as empty.
interface ClipKeyedState {
    clipId?: string;
    content?: string;
    type?: Clip['type'];
}

interface LoadedLayers extends ClipKeyedState {
    available: string[];
    withChildren: Set<string>;
}

export function useTachieLayers(
    selectedClip: Clip | undefined,
    setClips: React.Dispatch<React.SetStateAction<Clip[]>>
) {
    const [loadedLayers, setLoadedLayers] = useState<LoadedLayers | null>(null);
    const [collapsed, setCollapsed] = useState<(ClipKeyedState & { paths: Set<string> }) | null>(null);

    const selectedClipId = selectedClip?.id;
    const selectedClipContent = selectedClip?.content;
    const selectedClipType = selectedClip?.type;

    const matchesSelected = (s: ClipKeyedState | null) =>
        !!s && s.clipId === selectedClipId && s.content === selectedClipContent && s.type === selectedClipType;

    const availableLayers = loadedLayers && matchesSelected(loadedLayers) ? loadedLayers.available : [];
    const pathsWithChildren = loadedLayers && matchesSelected(loadedLayers) ? loadedLayers.withChildren : new Set<string>();
    const collapsedPaths = collapsed && matchesSelected(collapsed) ? collapsed.paths : new Set<string>();
    const setCollapsedPaths = useCallback((paths: Set<string>) => {
        setCollapsed({ clipId: selectedClipId, content: selectedClipContent, type: selectedClipType, paths });
    }, [selectedClipId, selectedClipContent, selectedClipType]);

    // Parse PSD layers when a tachie clip is selected
    useEffect(() => {
        if (!selectedClipId || selectedClipType !== 'tachie' || !selectedClipContent) return;

        let cancelled = false;
        const loadLayers = async () => {
            try {
                const psd = await loadPsd(selectedClipContent, undefined, true);
                if (cancelled) return;

                const nodes = [...describePsd(psd).nodes].reverse();
                const defaultVisible = nodes.filter(node => node.visible).map(node => node.path);
                setLoadedLayers({
                    clipId: selectedClipId,
                    content: selectedClipContent,
                    type: selectedClipType,
                    available: nodes.map(node => node.path),
                    withChildren: new Set(nodes.filter(node => node.group).map(node => node.path)),
                });

                // Read the latest configuration and update only the clip/source
                // that started this request, preserving edits made while loading.
                setClips(prev => {
                    if (cancelled) return prev;
                    const target = prev.find(clip => clip.id === selectedClipId && clip.type === 'tachie' && clip.content === selectedClipContent);
                    if (!target || target.tachieLayers?.length || target.mouthOpenLayers?.length || target.mouthClosedLayers?.length) return prev;
                    return prev.map(clip => clip === target ? { ...clip, tachieLayers: defaultVisible } : clip);
                });
            } catch (e) {
                if (cancelled) return;
                console.error('Failed to parse PSD layers:', e);
                setLoadedLayers({ clipId: selectedClipId, content: selectedClipContent, type: selectedClipType, available: [], withChildren: new Set() });
            }
        };
        void loadLayers();
        return () => { cancelled = true; };
    }, [selectedClipId, selectedClipContent, selectedClipType, setClips]);

    return { availableLayers, collapsedPaths, setCollapsedPaths, pathsWithChildren };
}
