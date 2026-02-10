import React from 'react';
import { Loader2, Upload, Volume2, Layers, Plus, Image as ImageIcon } from 'lucide-react';
import { Asset } from './utils';
import { ClipboardEvent } from 'react';
import { ClipType } from '@/types';
import { TFunction } from 'i18next';

interface AssetsPanelProps {
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isUploading: boolean;
    assets: Asset[];
    addClip: (type: ClipType, contentOverride?: string, durationOverride?: number) => void;
    t: TFunction;
}

export const AssetsPanel: React.FC<AssetsPanelProps> = ({
    handleFileUpload,
    isUploading,
    assets,
    addClip,
    t
}) => {
    return (
        <div className="space-y-4 animate-in slide-in-from-right duration-300">
            {/* Upload Box */}
            <div
                className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                onClick={() => document.getElementById('asset-upload')?.click()}
            >
                <input
                    type="file"
                    id="asset-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,video/*,audio/*,.mkv,.flac,.ogg,.wav,.aac,.m4a,.mov,.webm,.webp,.svg,.bmp,.avif"
                />
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                    {isUploading ? <Loader2 className="animate-spin text-primary" size={20} /> : <Upload className="text-muted-foreground group-hover:text-primary" size={20} />}
                </div>
                <div className="text-center">
                    <p className="text-xs font-medium text-foreground">{t('editor.assets.upload.title')}</p>
                    <p className="text-[10px] text-muted-foreground">{t('editor.assets.upload.subtitle')}</p>
                </div>
            </div>

            {/* Asset Grid */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('editor.assets.library')}</h2>
                    <span className="text-[10px] text-muted-foreground">{assets.length} {t('editor.items')}</span>
                </div>

                {assets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <ImageIcon className="mx-auto h-8 w-8 opacity-20 mb-2" />
                        <p className="text-xs">{t('editor.assets.empty')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {assets.map((asset, i) => (
                            <div
                                key={i}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/omoti-clip', JSON.stringify({
                                        type: asset.type,
                                        content: asset.url,
                                        duration: asset.duration
                                    }));
                                }}
                                className="group relative aspect-video bg-black/50 rounded-md overflow-hidden border border-border/50 cursor-pointer hover:border-primary transition-all cursor-grab active:cursor-grabbing"
                                onClick={() => addClip(asset.type, asset.url, asset.duration)}
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
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
