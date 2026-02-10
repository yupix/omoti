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

export interface Asset {
    name: string;
    url: string;
    type: 'image' | 'video' | 'audio' | 'tachie';
    duration?: number; // in seconds
}
