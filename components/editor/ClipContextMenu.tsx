"use client";

import { useTranslation } from 'react-i18next';
import { Copy, Scissors, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ClipContextMenuState {
    x: number;
    y: number;
    clipId: string;
}

export function ClipContextMenu({
    menu,
    onSplit,
    onDuplicate,
    onDelete,
}: {
    menu: ClipContextMenuState;
    onSplit: (clipId: string) => void;
    onDuplicate: (clipId: string) => void;
    onDelete: (clipId: string) => void;
}) {
    const { t } = useTranslation();

    return (
        <div
            className="fixed z-50 min-w-32 bg-popover border border-border shadow-md rounded-md overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-100"
            style={{ left: menu.x, top: menu.y }}
        >
            <div className="p-1 flex flex-col gap-0.5">
                <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-8 px-2"
                    onClick={() => onSplit(menu.clipId)}
                >
                    <Scissors size={14} className="mr-2" />
                    {t('editor.contextMenu.split')}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-8 px-2"
                    onClick={() => onDuplicate(menu.clipId)}
                >
                    <Copy size={14} className="mr-2" />
                    {t('editor.contextMenu.duplicate')}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-8 px-2 text-destructive hover:text-destructive"
                    onClick={() => onDelete(menu.clipId)}
                >
                    <Trash2 size={14} className="mr-2" />
                    {t('editor.contextMenu.delete')}
                </Button>
            </div>
        </div>
    );
}
