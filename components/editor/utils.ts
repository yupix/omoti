import { readPsdDimensions, uploadFile, type UploadProgress } from '@/lib/upload';

function loadMediaMetadata(url: string, type: 'video' | 'audio' | 'image', signal?: AbortSignal): Promise<{ duration: number; width: number; height: number }> {
    return new Promise(resolve => {
        const element = type === 'image' ? new Image() : document.createElement(type);
        const fallback = { duration: 0, width: 600, height: 600 };
        const finish = (loaded: boolean) => {
            clearTimeout(timer);
            element.removeEventListener('load', onLoad);
            element.removeEventListener('loadedmetadata', onLoad);
            element.removeEventListener('error', onError);
            signal?.removeEventListener('abort', onError);
            const result = loaded ? {
                duration: type === 'image' ? 0 : (element as HTMLMediaElement).duration,
                width: type === 'image' ? (element as HTMLImageElement).naturalWidth : (element as HTMLVideoElement).videoWidth || 600,
                height: type === 'image' ? (element as HTMLImageElement).naturalHeight : (element as HTMLVideoElement).videoHeight || 600,
            } : fallback;
            element.removeAttribute('src');
            if (type !== 'image') (element as HTMLMediaElement).load();
            resolve(result);
        };
        const onLoad = () => finish(true);
        const onError = () => finish(false);
        if (signal?.aborted) { resolve(fallback); return; }
        const timer = setTimeout(onError, 15_000);
        element.addEventListener(type === 'image' ? 'load' : 'loadedmetadata', onLoad, { once: true });
        element.addEventListener('error', onError, { once: true });
        signal?.addEventListener('abort', onError, { once: true });
        if (type !== 'image') (element as HTMLMediaElement).preload = 'metadata';
        element.src = url;
    });
}

export const getMediaDuration = async (url: string, type: 'video' | 'audio', signal?: AbortSignal): Promise<number> => {
    const { duration } = await loadMediaMetadata(url, type, signal);
    return Number.isFinite(duration) ? duration : 0;
};

export const getMediaDimensions = async (url: string, type: 'video' | 'image', signal?: AbortSignal): Promise<{ width: number; height: number }> => {
    const { width, height } = await loadMediaMetadata(url, type, signal);
    return { width, height };
};

export interface Asset {
    name: string;
    url: string;
    type: 'image' | 'video' | 'audio' | 'tachie';
    duration?: number; // in seconds
    width?: number;
    height?: number;
    folderId?: string;
}

export interface AssetFolder {
    id: string;
    name: string;
    parentId?: string;
}


export async function uploadAsset(file: File, onProgress: (progress: UploadProgress) => void, signal: AbortSignal): Promise<Asset> {
    const type: Asset['type'] = /\.psd$/i.test(file.name) ? 'tachie'
        : /\.(mp4|webm|mov|mkv)$/i.test(file.name) ? 'video'
        : /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name) ? 'audio' : 'image';
    const psdDimensions = type === 'tachie' ? await readPsdDimensions(file) : undefined;
    const data = await uploadFile(file, onProgress, signal);
    const url = data.url;
    onProgress({ loaded: file.size, total: file.size, phase: 'processing' });
    const duration = type === 'video' || type === 'audio' ? await getMediaDuration(url, type, signal) : 0;
    const dimensions = psdDimensions || (type === 'video' || type === 'image' ? await getMediaDimensions(url, type, signal) : undefined);
    signal.throwIfAborted();
    return { name: data.name, url, type, duration, ...dimensions };
}
