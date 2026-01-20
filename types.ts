export type ClipType = 'text' | 'image' | 'video' | 'audio' | 'shape' | 'code';


export interface Clip {
    id: string;
    type: ClipType;
    trackId: number;
    startFrame: number;
    durationInFrames: number;
    content: string; // Text content or Image/Video URL
    style?: React.CSSProperties; // Simple styling for now
    title?: string; // For display in timeline
    animation?: {
        type: 'fade' | 'pop' | 'slide' | 'none';
        duration: number; // in frames
    };
}

export interface Track {
    id: number;
    name: string;
}
