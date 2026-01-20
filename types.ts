export type ClipType = 'text' | 'image' | 'video';

export interface Clip {
    id: string;
    type: ClipType;
    trackId: number;
    startFrame: number;
    durationInFrames: number;
    content: string; // Text content or Image/Video URL
    style?: React.CSSProperties; // Simple styling for now
    title?: string; // For display in timeline
}

export interface Track {
    id: number;
    name: string;
}
