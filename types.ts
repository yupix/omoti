export type ClipType = 'text' | 'image' | 'video' | 'audio' | 'shape' | 'code' | 'tachie' | 'flow' | 'browser' | 'icon';


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
        type: 'fade' | 'pop' | 'slide' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'spin' | 'shake' | 'bounce' | 'none';
        duration: number; // in frames
    };
    x?: number; // Position X (pixels)
    y?: number; // Position Y (pixels)
    width?: number; // Width (pixels)
    height?: number; // Height (pixels)
    rotate?: number; // Rotation (degrees)
    crop?: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    }; // OBS-style cropping
    language?: string; // Programming language for code clips
    steps?: CodeStep[]; // Keyframes for code content
    transitionDuration?: number; // Duration of code transition (frames)
    mediaStartOffset?: number; // Offset in frames from the start of the media file
    playbackRate?: number; // Playback speed (default 1)
    volume?: number; // Audio volume (0-1, default 1)
    tachieLayers?: string[]; // IDs or paths of visible layers for PSD
    nodes?: any[]; // Nodes for ReactFlow
    edges?: any[]; // Edges for ReactFlow
    effects?: Effect[]; // List of visual effects
    audioUrl?: string; // Optional audio URL for lip-sync
    mouthOpenLayers?: string[]; // Layers to show when mouth is open
    mouthClosedLayers?: string[]; // Layers to show when mouth is closed
    mandatoryLayers?: string[]; // Layers that are always visible
    facing?: 'left' | 'right'; // Semantic direction the character is facing in the asset
    mirror?: boolean; // Whether to flip the clip horizontally
    keyframes?: {
        [key in 'x' | 'y' | 'width' | 'height' | 'rotate' | 'opacity' | 'scale']?: Keyframe[];
    };
}

export interface Keyframe {
    frame: number; // Relative to clip start
    value: number;
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface Effect {
    type: 'glow' | 'outline' | 'shadow' | 'blur' | 'sepia' | 'grayscale' | 'pulse' | 'float' | 'hue-rotate' | 'brightness' | 'contrast' | 'invert';
    color?: string;
    width?: number; // Spread or thickness
    blur?: number;
    opacity?: number;
    intensity?: number; // For animations like shake/pulse
}

export interface CodeStep {
    code: string;
    frameOffset: number;
}

export interface Track {
    id: number;
    name: string;
}
