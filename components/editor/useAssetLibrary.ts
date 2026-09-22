"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Asset, AssetFolder, getMediaDuration, uploadAsset } from './utils';
import type { UploadProgress } from '@/lib/upload';

export function useAssetLibrary({ onUploadsFinished }: { onUploadsFinished?: () => void } = {}) {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [assetFolders, setAssetFolders] = useState<AssetFolder[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<(UploadProgress & { name: string }) | null>(null);
    const [uploadError, setUploadError] = useState('');
    const uploadAbort = useRef<AbortController | null>(null);
    useEffect(() => () => uploadAbort.current?.abort(), []);

    // Fetch assets on load
    useEffect(() => {
        fetch('/api/upload')
            .then(res => res.json())
            .then(async (data) => {
                if (data.files) {
                    const mapped = await Promise.all(data.files.map(async (f: { name: string }) => {
                        const fullUrl = `/uploads/${f.name}`;
                        const type = f.name.match(/\.(mp4|webm|mov|mkv)$/i) ? 'video' :
                            f.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i) ? 'audio' :
                                f.name.match(/\.psd$/i) ? 'tachie' : 'image';
                        let duration = 0;
                        if (type === 'video' || type === 'audio') {
                            duration = await getMediaDuration(fullUrl, type);
                        }
                        return {
                            ...f,
                            url: fullUrl,
                            type,
                            duration
                        };
                    }));
                    setAssets(mapped);
                }
            })
            .catch(console.error);
    }, []);

    const onUploadsFinishedRef = useRef(onUploadsFinished);
    onUploadsFinishedRef.current = onUploadsFinished;

    const uploadFiles = useCallback(async (files: File[], onUploaded?: (asset: Asset) => void) => {
        if (uploadAbort.current || files.length === 0) return;
        const controller = new AbortController();
        uploadAbort.current = controller;
        setIsUploading(true);
        setUploadError('');
        try {
            for (const file of files) {
                controller.signal.throwIfAborted();
                setUploadProgress({ name: file.name, loaded: 0, total: file.size, phase: 'processing' });
                const asset = await uploadAsset(file, progress => setUploadProgress({ name: file.name, ...progress }), controller.signal);
                setAssets(prev => [...prev, asset]);
                onUploaded?.(asset);
            }
            onUploadsFinishedRef.current?.();
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) {
                setUploadError(error instanceof Error ? error.message : 'Upload failed');
            }
        } finally {
            uploadAbort.current = null;
            setIsUploading(false);
            setUploadProgress(null);
        }
    }, []);

    const removeAsset = useCallback((url: string) => {
        setAssets(prev => prev.filter(a => a.url !== url));
    }, []);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        await uploadFiles(files);
        e.target.value = ''; // Reset input
    }, [uploadFiles]);

    const createFolder = useCallback((name: string, parentId?: string) => {
        const newFolder: AssetFolder = {
            id: Math.random().toString(36).substring(2, 11),
            name,
            parentId
        };
        setAssetFolders(prev => [...prev, newFolder]);
    }, []);

    const renameFolder = useCallback((id: string, newName: string) => {
        setAssetFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    }, []);

    const deleteFolder = useCallback((id: string) => {
        setAssetFolders(prev => {
            const folderToDelete = prev.find(f => f.id === id);
            const parentOfDeleted = folderToDelete?.parentId;
            return prev.filter(f => f.id !== id).map(f =>
                f.parentId === id ? { ...f, parentId: parentOfDeleted } : f
            );
        });
        setAssets(prev => {
            const folderToDelete = assetFolders.find(f => f.id === id);
            return prev.map(a => a.folderId === id ? { ...a, folderId: folderToDelete?.parentId } : a);
        });
    }, [assetFolders]);

    const moveAssetToFolder = useCallback((assetUrl: string, folderId?: string) => {
        setAssets(prev => prev.map(a => a.url === assetUrl ? { ...a, folderId } : a));
    }, []);

    const renameAsset = useCallback((assetUrl: string, newName: string) => {
        setAssets(prev => prev.map(a => a.url === assetUrl ? { ...a, name: newName } : a));
    }, []);

    const moveFolderToFolder = useCallback((sourceId: string, targetId?: string) => {
        if (sourceId === targetId) return;
        const isDescendant = (parent: string, child: string): boolean => {
            const folder = assetFolders.find(f => f.id === child);
            if (!folder || !folder.parentId) return false;
            if (folder.parentId === parent) return true;
            return isDescendant(parent, folder.parentId);
        };
        if (targetId && isDescendant(sourceId, targetId)) return;
        setAssetFolders(prev => prev.map(f => f.id === sourceId ? { ...f, parentId: targetId } : f));
    }, [assetFolders]);

    return {
        assets,
        setAssets,
        assetFolders,
        setAssetFolders,
        isUploading,
        uploadProgress,
        uploadError,
        setUploadError,
        uploadAbort,
        uploadFiles,
        removeAsset,
        handleFileUpload,
        createFolder,
        renameFolder,
        deleteFolder,
        moveAssetToFolder,
        renameAsset,
        moveFolderToFolder,
    };
}
