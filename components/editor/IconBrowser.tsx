import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Zap } from 'lucide-react';
import { Icon } from '@iconify/react';
import { ClipType } from '@/types';
import { TFunction } from 'i18next';

export interface IconBrowserProps {
    addClip: (type: ClipType, contentOverride?: string, durationOverride?: number, startFrame?: number, trackId?: number, width?: number, height?: number) => void;
    t?: TFunction; // Optional if i18n is used fully later
}

export function IconBrowser({ addClip }: IconBrowserProps) {
    const [query, setQuery] = useState('');
    const [icons, setIcons] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [debouncedQuery, setDebouncedQuery] = useState('');

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedQuery(query), 500);
        return () => clearTimeout(handler);
    }, [query]);

    useEffect(() => {
        if (!debouncedQuery.trim()) {
            setIcons([]);
            return;
        }

        let isMounted = true;
        const fetchIcons = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(debouncedQuery)}&limit=60`);
                if (!res.ok) throw new Error('Failed to fetch icons');
                const data = await res.json();
                if (isMounted && data.icons) {
                    setIcons(data.icons);
                }
            } catch (err) {
                console.error(err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchIcons();
        return () => { isMounted = false; };
    }, [debouncedQuery]);

    return (
        <div className="flex flex-col h-full space-y-4 animate-in slide-in-from-right duration-300">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Search Iconify (e.g., md:home, react, arrow)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9 bg-background/50 border-border"
                />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 border rounded-md border-border bg-black/20 p-2">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="animate-spin text-primary" size={24} />
                    </div>
                ) : icons.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                        {icons.map((iconName) => (
                            <div
                                key={iconName}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/omoti-clip', JSON.stringify({
                                        type: 'icon',
                                        content: iconName,
                                        width: 100,
                                        height: 100,
                                        duration: 60
                                    }));
                                }}
                                onClick={() => addClip('icon', iconName, 60, undefined, undefined, 100, 100)}
                                className="aspect-square bg-card hover:bg-primary/20 hover:border-primary border border-transparent rounded-md flex flex-col items-center justify-center cursor-pointer transition-colors group relative"
                                title={iconName}
                            >
                                <Icon icon={iconName} className="text-foreground w-8 h-8 group-hover:scale-110 transition-transform" />
                            </div>
                        ))}
                    </div>
                ) : debouncedQuery ? (
                    <div className="flex flex-col justify-center items-center h-full text-muted-foreground text-xs">
                        No icons found.
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs space-y-2 opacity-60">
                        <Zap size={24} className="mb-2" />
                        <p>Search over 150,000 open source icons.</p>
                        <p>Powered by Iconify</p>
                    </div>
                )}
            </div>
        </div>
    );
}
