export const getMediaDuration = (url: string, type: 'video' | 'audio'): Promise<number> => {
    return new Promise((resolve) => {
        const element = type === 'video' ? document.createElement('video') : document.createElement('audio');
        element.preload = 'metadata';
        element.onloadedmetadata = () => {
            resolve(element.duration);
        };
        element.onerror = () => {
            resolve(0);
        };
        element.src = url;
    });
};

export const getMediaDimensions = (url: string, type: 'video' | 'image' | 'tachie'): Promise<{ width: number, height: number }> => {
    return new Promise((resolve) => {
        if (type === 'image' || type === 'tachie') {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () => resolve({ width: 600, height: 600 });
            img.src = url;
            return;
        }

        if (type === 'video') {
            const video = document.createElement('video');
            video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
            video.onerror = () => resolve({ width: 600, height: 600 });
            video.src = url;
            return;
        }

        resolve({ width: 600, height: 600 });
    });
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
