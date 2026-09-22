"use client";

import { Box, Globe, Library, Settings2, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export type SidebarTab = 'properties' | 'assets' | 'icons';

export function ActivityBar({
    activeTab,
    collapsed,
    onSelect,
}: {
    activeTab: SidebarTab;
    collapsed: boolean;
    onSelect: (tab: SidebarTab) => void;
}) {
    const { t } = useTranslation();
    const tabs = [
        { id: 'properties' as const, icon: Settings2, title: t('editor.tabs.properties') },
        { id: 'assets' as const, icon: Library, title: t('editor.tabs.assets') },
        { id: 'icons' as const, icon: Smile, title: 'Icons' },
    ];

    return (
        <nav className="w-16 border-r border-border bg-card flex flex-col items-center py-4 z-30 shrink-0 select-none">
            <div className="size-10 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(109,40,217,0.5)] mb-8">
                <Box className="text-primary-foreground fill-current" size={20} />
            </div>

            <div className="flex flex-col gap-4">
                {tabs.map(({ id, icon: Icon, title }) => (
                    <button
                        key={id}
                        onClick={() => onSelect(id)}
                        className={`size-11 rounded-xl flex items-center justify-center transition-all ${activeTab === id && !collapsed ? 'text-primary bg-primary/15 shadow-[0_0_15px_rgba(139,92,246,0.2)]' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'}`}
                        title={title}
                    >
                        <Icon size={24} strokeWidth={activeTab === id && !collapsed ? 2.5 : 2} />
                    </button>
                ))}
            </div>

            <div className="mt-auto">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <Globe size={20} />
                </Button>
            </div>
        </nav>
    );
}
