import React, { useState, useEffect, useMemo } from 'react';
import {
    Loader2, Upload, Volume2, Layers, Plus,
    Image as ImageIcon, Trash2, FolderPlus, Folder as FolderIcon,
    ChevronDown, ChevronRight, MoreVertical, Edit2, Search,
    SortAsc, ArrowUpDown
} from 'lucide-react';
import { Asset, AssetFolder } from './utils';
import { ClipType } from '@/types';
import { TFunction } from 'i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface AssetsPanelProps {
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    uploadFiles: (files: File[]) => void;
    isUploading: boolean;
    assets: Asset[];
    assetFolders: AssetFolder[];
    addClip: (type: ClipType, contentOverride?: string, durationOverride?: number, startFrame?: number, trackId?: number, width?: number, height?: number) => void;
    removeAsset: (url: string) => void;
    createFolder: (name: string, parentId?: string) => void;
    renameFolder: (id: string, newName: string) => void;
    deleteFolder: (id: string) => void;
    moveAssetToFolder: (assetUrl: string, folderId?: string) => void;
    moveFolderToFolder: (sourceId: string, targetId?: string) => void;
    renameAsset: (assetUrl: string, newName: string) => void;
    t: TFunction;
}

type SortMode = 'name-asc' | 'name-desc' | 'newest' | 'type';

const AssetsPanelInner: React.FC<AssetsPanelProps> = ({
    handleFileUpload,
    uploadFiles,
    isUploading,
    assets,
    assetFolders,
    addClip,
    removeAsset,
    createFolder,
    renameFolder,
    deleteFolder,
    moveAssetToFolder,
    moveFolderToFolder,
    renameAsset,
    t
}) => {
    const [isDragActive, setIsDragActive] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string; name: string } | null>(null);
    const [folderContextMenu, setFolderContextMenu] = useState<{ x: number; y: number; id: string; name: string } | null>(null);
    const [emptyAreaContextMenu, setEmptyAreaContextMenu] = useState<{ x: number; y: number; parentId?: string } | null>(null);
    const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(['root']));
    const [dropTarget, setDropTarget] = useState<string | null>(null);

    // Search and Sort State
    const [searchQuery, setSearchQuery] = useState('');
    const [sortMode, setSortMode] = useState<SortMode>('name-asc');

    // Close context menu on click anywhere
    useEffect(() => {
        const handleClick = () => {
            setContextMenu(null);
            setFolderContextMenu(null);
            setEmptyAreaContextMenu(null);
        };
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const toggleFolder = (id: string) => {
        const next = new Set(openFolders);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setOpenFolders(next);
    };

    const handleNewFolder = (parentId?: string) => {
        const name = prompt('Folder Name:', 'New Folder');
        if (name) createFolder(name, parentId);
    };

    const handleRenameFolder = (id: string, currentName: string) => {
        const name = prompt('Rename Folder:', currentName);
        if (name && name !== currentName) renameFolder(id, name);
    };

    const handleRenameAsset = (url: string, currentName: string) => {
        const name = prompt('Rename Asset:', currentName);
        if (name && name !== currentName) renameAsset(url, name);
    };

    const onDrop = (e: React.DragEvent, targetFolderId?: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget(null);

        const assetUrl = e.dataTransfer.getData('application/omoti-asset-url');
        const sourceFolderId = e.dataTransfer.getData('application/omoti-folder-id');

        if (assetUrl) {
            moveAssetToFolder(assetUrl, targetFolderId);
        } else if (sourceFolderId) {
            moveFolderToFolder(sourceFolderId, targetFolderId);
        }
    };

    const renderAsset = (asset: Asset) => (
        <div
            key={asset.url}
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData('application/omoti-clip', JSON.stringify({
                    type: asset.type,
                    content: asset.url,
                    duration: asset.duration,
                    width: asset.width,
                    height: asset.height
                }));
                e.dataTransfer.setData('application/omoti-asset-url', asset.url);
            }}
            className="group relative aspect-video bg-black/50 rounded-md overflow-hidden border border-border/50 cursor-pointer hover:border-primary transition-all cursor-grab active:cursor-grabbing"
            onClick={() => addClip(asset.type, asset.url, asset.duration, undefined, undefined, asset.width, asset.height)}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, url: asset.url, name: asset.name });
            }}
            title={`${asset.name} ${asset.duration ? `(${asset.duration.toFixed(1)}s)` : ''}`}
        >
            {asset.type === 'video' ? (
                <video src={asset.url} className="w-full h-full object-cover pointer-events-none" />
            ) : asset.type === 'audio' ? (
                <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                    <Volume2 className="text-muted-foreground" size={24} />
                </div>
            ) : asset.type === 'tachie' ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-secondary/50 gap-2">
                    <Layers className="text-muted-foreground" size={24} />
                    <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">PSD</span>
                </div>
            ) : (
                <img src={asset.url} alt={asset.name} className="w-full h-full object-cover pointer-events-none" />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Plus className="text-white drop-shadow-md" size={20} />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-4">
                <p className="text-[10px] text-white truncate px-0.5">{asset.name}</p>
            </div>
        </div>
    );

    // Filtering and Sorting Process
    const processedAssets = useMemo(() => {
        let filtered = assets;

        // Search Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(a => a.name.toLowerCase().includes(query));
        }

        // Sort
        return [...filtered].sort((a, b) => {
            if (sortMode === 'name-asc') return a.name.localeCompare(b.name);
            if (sortMode === 'name-desc') return b.name.localeCompare(a.name);
            if (sortMode === 'type') return a.type.localeCompare(b.type);
            if (sortMode === 'newest') return 0; // Asset doesn't have date yet, but we could add it.
            return 0;
        });
    }, [assets, searchQuery, sortMode]);

    const processedFolders = useMemo(() => {
        let filtered = assetFolders;

        // If searching, we might want to only show folders that contain matching assets or match themselves
        // But for simplicity, let's just sort folders.
        return [...filtered].sort((a, b) => {
            if (sortMode === 'name-asc') return a.name.localeCompare(b.name);
            if (sortMode === 'name-desc') return b.name.localeCompare(a.name);
            return 0;
        });
    }, [assetFolders, sortMode]);

    const renderFolder = (folder: AssetFolder, level: number = 0) => {
        const isOpen = openFolders.has(folder.id);
        const childrenFolders = processedFolders.filter(f => f.parentId === folder.id);
        const folderAssets = processedAssets.filter(a => a.folderId === folder.id);
        const isTarget = dropTarget === folder.id;

        // If searching and this folder has no matching contents and doesn't match name, hide it?
        // Actually, if processedAssets filters out everything, folderAssets will be empty.
        // If we are searching, we might want to just show a flat list of assets.
        if (searchQuery && folderAssets.length === 0 && childrenFolders.length === 0) return null;

        return (
            <div key={folder.id} className="select-none">
                <div
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('application/omoti-folder-id', folder.id);
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropTarget(folder.id); }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={(e) => onDrop(e, folder.id)}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFolderContextMenu({ x: e.clientX, y: e.clientY, id: folder.id, name: folder.name });
                    }}
                    className={`flex items-center gap-2 p-1.5 rounded-md group transition-all cursor-pointer ${isTarget ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-secondary/50'}`}
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleFolder(folder.id); }}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <FolderIcon size={16} className={(folderAssets.length > 0 || childrenFolders.length > 0) ? "text-primary/70" : "text-muted-foreground"} />
                    <span className="text-xs font-medium flex-1 truncate">{folder.name}</span>

                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                                e.stopPropagation();
                                setFolderContextMenu({ x: e.clientX, y: e.clientY, id: folder.id, name: folder.name });
                            }}
                        >
                            <MoreVertical size={14} />
                        </Button>
                    </div>
                </div>

                {isOpen && (
                    <div className="pl-4 ml-2 border-l border-border/50 py-1 space-y-1">
                        {childrenFolders.map(child => renderFolder(child, level + 1))}
                        <div className="grid grid-cols-2 gap-2">
                            {folderAssets.map(renderAsset)}
                        </div>
                        {childrenFolders.length === 0 && folderAssets.length === 0 && !searchQuery && (
                            <p className="text-[10px] text-muted-foreground py-2 text-center italic">Empty</p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const rootFolders = processedFolders.filter(f => !f.parentId);
    const rootAssets = processedAssets.filter(a => !a.folderId);

    return (
        <div className="space-y-4 animate-in slide-in-from-right duration-300 min-h-full pb-20">
            {/* Search and Sort Bar */}
            <div className="flex flex-col gap-2">
                <div className="relative group">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Search assets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-card/30 border-border/50 focus:border-primary/50 transition-all h-9 text-xs"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-2.5 text-[10px] text-muted-foreground hover:text-foreground font-bold"
                        >
                            ESC
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Select value={sortMode} onValueChange={(val) => setSortMode(val as SortMode)}>
                        <SelectTrigger className="h-8 text-[10px] bg-card/30 border-border/50 flex-1">
                            <ArrowUpDown className="h-3 w-3 mr-2 opacity-50" />
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name-asc" className="text-xs">Name (A-Z)</SelectItem>
                            <SelectItem value="name-desc" className="text-xs">Name (Z-A)</SelectItem>
                            <SelectItem value="type" className="text-xs">Type</SelectItem>
                            <SelectItem value="newest" className="text-xs">Newest (Mock)</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground bg-card/30 border border-border/50"
                        onClick={() => handleNewFolder()}
                        title="New Folder"
                    >
                        <FolderPlus size={16} />
                    </Button>
                </div>
            </div>

            {/* Upload Box */}
            <div
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary hover:bg-primary/5'}`}
                onClick={() => document.getElementById('asset-upload')?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragActive(true);
                }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        uploadFiles(Array.from(e.dataTransfer.files));
                    }
                }}
            >
                <input
                    type="file"
                    id="asset-upload"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,video/*,audio/*,.mkv,.flac,.ogg,.wav,.aac,.m4a,.mov,.webm,.webp,.svg,.bmp,.avif"
                />
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                    {isUploading ? <Loader2 className="animate-spin text-primary" size={20} /> : <Upload className="text-muted-foreground group-hover:text-primary" size={20} />}
                </div>
                <div className="text-center pointer-events-none">
                    <p className="text-xs font-medium text-foreground">{t('editor.assets.upload.title')}</p>
                    <p className="text-[10px] text-muted-foreground">{t('editor.assets.upload.subtitle')}</p>
                </div>
            </div>

            {/* Assets Section */}
            <div
                className="space-y-2 min-h-[300px]"
                onContextMenu={(e) => {
                    e.preventDefault();
                    setEmptyAreaContextMenu({ x: e.clientX, y: e.clientY });
                }}
                onDragOver={(e) => { e.preventDefault(); setDropTarget('root'); }}
                onDragLeave={(e) => { if (e.target === e.currentTarget) setDropTarget(null); }}
                onDrop={(e) => onDrop(e, undefined)}
            >
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('editor.assets.library')}</h2>
                </div>

                <div
                    className={`space-y-1 transition-colors rounded-md p-1 min-h-[200px] ${dropTarget === 'root' ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}
                >
                    {/* If searching, and we want to show everything flat, we could change logic here.
                        But keeping hierarchy is nicer if folders contain what matches. */}
                    {rootFolders.map(folder => renderFolder(folder))}

                    {/* Root Assets Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        {rootAssets.map(renderAsset)}
                    </div>

                    {processedAssets.length === 0 && processedFolders.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            {searchQuery ? (
                                <>
                                    <Search className="mx-auto h-8 w-8 opacity-20 mb-2" />
                                    <p className="text-xs">No assets match "{searchQuery}"</p>
                                </>
                            ) : (
                                <>
                                    <ImageIcon className="mx-auto h-8 w-8 opacity-20 mb-2" />
                                    <p className="text-xs">{t('editor.assets.empty')}</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Context Menu for Assets */}
            {contextMenu && (
                <div
                    className="fixed z-50 min-w-[160px] bg-card border border-border shadow-xl rounded-md p-1 animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="w-full text-left px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-sm"
                        onClick={() => {
                            handleNewFolder();
                            setContextMenu(null);
                        }}
                    >
                        <FolderPlus size={14} />
                        New Folder
                    </button>
                    <button
                        className="w-full text-left px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-sm"
                        onClick={() => {
                            handleRenameAsset(contextMenu.url, contextMenu.name);
                            setContextMenu(null);
                        }}
                    >
                        <Edit2 size={14} />
                        Rename
                    </button>
                    <Separator className="my-1 bg-border/50" />
                    <button
                        className="w-full text-left px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground text-destructive flex items-center gap-2 rounded-sm"
                        onClick={() => {
                            removeAsset(contextMenu.url);
                            setContextMenu(null);
                        }}
                    >
                        <Trash2 size={14} />
                        Delete
                    </button>
                </div>
            )}

            {/* Context Menu for Folders */}
            {folderContextMenu && (
                <div
                    className="fixed z-50 min-w-[160px] bg-card border border-border shadow-xl rounded-md p-1 animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: folderContextMenu.x, top: folderContextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="w-full text-left px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-sm"
                        onClick={() => {
                            handleNewFolder(folderContextMenu.id);
                            setFolderContextMenu(null);
                        }}
                    >
                        <FolderPlus size={14} />
                        New Subfolder
                    </button>
                    <button
                        className="w-full text-left px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-sm"
                        onClick={() => {
                            handleRenameFolder(folderContextMenu.id, folderContextMenu.name);
                            setFolderContextMenu(null);
                        }}
                    >
                        <Edit2 size={14} />
                        Rename
                    </button>
                    <Separator className="my-1 bg-border/50" />
                    <button
                        className="w-full text-left px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground text-destructive flex items-center gap-2 rounded-sm"
                        onClick={() => {
                            deleteFolder(folderContextMenu.id);
                            setFolderContextMenu(null);
                        }}
                    >
                        <Trash2 size={14} />
                        Delete
                    </button>
                </div>
            )}

            {/* Context Menu for Empty Area */}
            {emptyAreaContextMenu && (
                <div
                    className="fixed z-50 min-w-[160px] bg-card border border-border shadow-xl rounded-md p-1 animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: emptyAreaContextMenu.x, top: emptyAreaContextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="w-full text-left px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-sm"
                        onClick={() => {
                            handleNewFolder(emptyAreaContextMenu.parentId);
                            setEmptyAreaContextMenu(null);
                        }}
                    >
                        <FolderPlus size={14} />
                        New Folder
                    </button>
                </div>
            )}
        </div>
    );
};

const Separator = ({ className }: { className?: string }) => (
    <div className={`h-px w-full ${className}`} />
);

export const AssetsPanel = React.memo(AssetsPanelInner);
