export type ClipType = 'text' | 'image' | 'video' | 'audio' | 'shape' | 'code' | 'tachie' | 'flow';


export interface Clip {
    id: string;
    type: ClipType;
    trackId: number;
    startFrame: number;
    durationInFrames: number;
    content: string; // Text content or Image/Video/PSD URL
    style?: React.CSSProperties; // Simple styling for now
    title?: string; // For display in timeline
    animation?: {
        type: 'fade' | 'pop' | 'slide' | 'none';
        duration: number; // in frames
    };
    x?: number; // Position X (pixels)
    y?: number; // Position Y (pixels)
    width?: number; // Width (pixels)
    height?: number; // Height (pixels)
    rotate?: number; // Rotation (degrees)
    language?: string; // Programming language for code clips
    steps?: CodeStep[]; // Keyframes for code content
    transitionDuration?: number; // Duration of code transition (frames)
    mediaStartOffset?: number; // Offset in frames from the start of the media file
    playbackRate?: number; // Playback speed (default 1)
    volume?: number; // Audio volume (0-1, default 1)
    tachieLayers?: string[]; // IDs or paths of visible layers for PSD
    nodes?: any[]; // Nodes for ReactFlow
    edges?: any[]; // Edges for ReactFlow
}

export interface CodeStep {
    code: string;
    frameOffset: number;
}

export interface Track {
    id: number;
    name: string;
}
