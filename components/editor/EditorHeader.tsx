"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FolderOpen, Globe, Loader2, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function EditorHeader({
    onSaveProject,
    onLoadProject,
    onExport,
    isExporting,
    onAiCreate,
    onAiEdit,
    aiEditDisabled,
}: {
    onSaveProject: () => void;
    onLoadProject: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onExport: () => void;
    isExporting: boolean;
    onAiCreate: () => void;
    onAiEdit: () => void;
    aiEditDisabled: boolean;
}) {
    const { t, i18n } = useTranslation();
    const language = i18n.resolvedLanguage || 'en';

    return (
        <header className="h-14 shrink-0 border-b border-border/50 flex items-center justify-between px-6 bg-background/80 backdrop-blur-md z-10 w-full">
            <div className="text-sm text-muted-foreground flex items-center gap-4">
                <span>{t('editor.header.project')}: <span className="text-foreground font-medium">New Video 01</span></span>
                <div className="h-4 w-px bg-border"></div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSaveProject} title={t('editor.header.save')}>
                        <Save size={16} />
                    </Button>
                    <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8" title={t('editor.header.load')}>
                        <FolderOpen size={16} />
                        <input type="file" className="hidden" accept=".json" onChange={onLoadProject} />
                    </label>
                    <div className="h-4 w-px bg-border"></div>
                    <Select value={language} onValueChange={(val) => i18n.changeLanguage(val)}>
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
            <div>
                <Button
                    className="h-8 shadow-[0_0_20px_rgba(109,40,217,0.3)] transition-all hover:shadow-[0_0_30px_rgba(109,40,217,0.5)]"
                    size="sm"
                    onClick={onExport}
                    disabled={isExporting}
                >
                    {isExporting ? <Loader2 className="mr-2 size-3 animate-spin" /> : <Download className="mr-2 size-3" />}
                    {isExporting ? t('editor.header.exporting') : t('editor.header.export')}
                </Button>
                <Button
                    className="ml-2 h-8 bg-purple-600 hover:bg-purple-700 text-white border border-purple-400/20 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                    size="sm"
                    onClick={onAiCreate}
                >
                    <Sparkles className="mr-2 size-3" />
                    AI Create
                </Button>
                <Button className="ml-2 h-8" size="sm" variant="outline" disabled={aiEditDisabled}
                    onClick={onAiEdit}>
                    <Sparkles className="mr-2 size-3" />AI編集
                </Button>
            </div>
        </header>
    );
}
