import { AbsoluteFill, Sequence, useCurrentFrame, Audio, interpolate, spring, useVideoConfig } from 'remotion';
import React from 'react';
import { Clip } from '../types';

interface RenderClipProps {
    clip: Clip;
}

const RenderClip: React.FC<RenderClipProps> = ({ clip }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Calculate Animation Styles
    // Calculate Animation Styles
    let animationStyle: React.CSSProperties = { opacity: 1, transform: 'scale(1)' };

    if (clip.animation?.type === 'fade') {
        const animDuration = clip.animation.duration || 10;
        const fadeIn = interpolate(frame, [0, animDuration], [0, 1], { extrapolateRight: 'clamp' });
        const fadeOut = interpolate(frame, [clip.durationInFrames - animDuration, clip.durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        animationStyle.opacity = fadeIn * fadeOut;
    } else if (clip.animation?.type === 'pop') {
        const scale = spring({
            fps,
            frame,
            config: { damping: 10 }
        });
        animationStyle.transform = `scale(${scale})`;
    } else if (clip.animation?.type === 'slide') {
        const slideY = interpolate(frame, [0, 20], [100, 0], { extrapolateRight: 'clamp', easing: (t) => t * (2 - t) }); // Slide up
        animationStyle.transform = `translateY(${slideY}%)`;
        animationStyle.opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
    }

    // Base positioning style
    const isPositioned = typeof clip.x === 'number' || typeof clip.y === 'number' || typeof clip.width === 'number' || typeof clip.height === 'number';
    const positionStyle: React.CSSProperties = {
        position: 'absolute',
        left: isPositioned ? clip.x : 0,
        top: isPositioned ? clip.y : 0,
        width: isPositioned ? (clip.width || 400) : '100%',
        height: isPositioned ? (clip.height || 400) : '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        ...animationStyle,
    };

    // Render text
    if (clip.type === 'text') {
        return (
            <div style={positionStyle}>
                <h1 style={{
                    fontFamily: 'sans-serif',
                    fontSize: '80px',
                    color: 'white',
                    fontWeight: 800,
                    margin: 0,
                    textShadow: '0 4px 10px rgba(0,0,0,0.5)',
                    ...clip.style
                }}>
                    {clip.content}
                </h1>
            </div>
        );
    }

    if (clip.type === 'code') {
        return (
            <div style={positionStyle}>
                <div style={{
                    backgroundColor: '#1e1e1e',
                    padding: '40px',
                    borderRadius: '16px',
                    border: '1px solid #333',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    minWidth: '300px', // ensure some width if scaling down
                    ...clip.style
                }}>
                    <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '32px', color: '#d4d4d4', whiteSpace: 'pre-wrap' }}>
                        <code>{clip.content}</code>
                    </pre>
                </div>
            </div>
        )
    }

    if (clip.type === 'image') {
        return (
            <div style={positionStyle}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={clip.content}
                    alt="clip"
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover', // Or contain? Cover fills the box.
                        ...clip.style
                    }}
                />
            </div>
        );
    }

    if (clip.type === 'shape') {
        const isCircle = clip.content === 'circle';
        // Shapes fill their container box now
        return (
            <div style={positionStyle}>
                <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'white',
                    borderRadius: isCircle ? '50%' : '0px',
                    ...clip.style
                }} />
            </div>
        );
    }

    if (clip.type === 'audio') {
        return <Audio src={clip.content} />;
    }

    return null;
}

export const ResultVideo: React.FC<{
    clips: Clip[];
    primaryColor: string;
}> = ({ clips, primaryColor }) => {
    const frame = useCurrentFrame();

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#000'
        }}>
            {/* Background - Inline Styles */}
            <div
                style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'linear-gradient(to bottom right, #4c1d95, #000000, #000000)',
                    zIndex: 0
                }}
            />

            {clips && clips.map((clip, index) => (
                <Sequence
                    key={clip.id}
                    from={clip.startFrame}
                    durationInFrames={clip.durationInFrames}
                    style={{ zIndex: 10 + index }}
                >
                    <RenderClip clip={clip} />
                </Sequence>
            ))}
        </div>
    );
};
