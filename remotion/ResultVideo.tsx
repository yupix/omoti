import { AbsoluteFill, Sequence, useCurrentFrame, Audio, interpolate, spring, useVideoConfig } from 'remotion';
import React from 'react';
import { Clip } from '../types';
import { CodeHighlighter } from '../components/CodeHighlighter';

const CodeClipRenderer: React.FC<{ clip: Clip }> = ({ clip }) => {
    const frame = useCurrentFrame();

    let displayCode = clip.content;

    // Logic to determine which step is active
    if (clip.steps && clip.steps.length > 0) {
        const localFrame = frame - clip.startFrame;
        // Find the last step that has frameOffset <= localFrame
        const activeStep = [...clip.steps]
            .sort((a, b) => a.frameOffset - b.frameOffset)
            .reverse() // check from latest
            .find(step => step.frameOffset <= localFrame);

        if (activeStep) {
            displayCode = activeStep.code;
        } else {
            // If before first step, maybe show first step or empty?
            // Let's show the first step if we are before it, or just empty?
            // Usually steps start at 0. If not, showing nothing or clip.content is safe.
            // If we have steps, we probably want to prioritize them.
            const firstStep = clip.steps.sort((a, b) => a.frameOffset - b.frameOffset)[0];
            if (firstStep) displayCode = firstStep.code;
        }
    }

    return (
        <CodeHighlighter
            code={displayCode}
            language={clip.language || 'typescript'}
            theme="dark-plus"
        />
    );
};

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
        const animDuration = Math.max(1, clip.animation.duration || 10);
        const fadeIn = interpolate(frame, [0, animDuration], [0, 1], { extrapolateRight: 'clamp' });
        const fadeOut = interpolate(frame, [Math.max(animDuration, clip.durationInFrames - animDuration), clip.durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
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
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    minWidth: '300px',
                    width: '100%', // Fill the container
                    height: '100%', // Fill the container
                    fontSize: '24px',
                    backgroundColor: '#1e1e1e', // Fallback/Basis
                    display: 'flex', // Ensure content alignment
                    alignItems: 'center', // Vertically center content? Or top? Usually code is top. Let's start with default/stretch.
                    // Actually, if height is 100%, we probably want the inner padding div to just flow.
                    ...clip.style
                }}>
                    <div style={{ padding: '30px', width: '100%' }}>
                        <CodeClipRenderer clip={clip} />
                    </div>
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
