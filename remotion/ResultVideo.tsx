import { AbsoluteFill, Sequence, useCurrentFrame, Audio, Video, interpolate, spring, useVideoConfig, Img } from 'remotion';
import { resolveAssetUrl } from './utils';
import { getFadeOpacity, interpolateKeyframes } from './animations';
import { Gif } from '@remotion/gif';
import { Icon } from '@iconify/react';
import React from 'react';
import { Clip } from '../types';
import { CodeHighlighter } from '../components/CodeHighlighter';
import { TachieRenderer } from './TachieRenderer';
import { FlowRenderer } from './FlowRenderer';
import { FittedText } from './FittedText';
import { loadClipFonts } from './fonts';

const CodeClipRenderer: React.FC<{ clip: Clip }> = ({ clip }) => {
    const frame = useCurrentFrame();
    const steps = React.useMemo(() => [...(clip.steps || [])]
        .sort((a, b) => a.frameOffset - b.frameOffset)
        .reverse(), [clip.steps]);
    const displayCode = steps.find(step => step.frameOffset <= frame)?.code
        ?? steps.at(-1)?.code
        ?? clip.content;

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
    assetBaseUrl?: string;
}

const RenderClip: React.FC<RenderClipProps> = ({ clip, assetBaseUrl }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const fontReady = React.useMemo(() => loadClipFonts(clip), [clip]);

    // Calculate Animation Styles
    const animType = clip.animation?.type || 'none';
    const animDuration = Math.max(1, clip.animation?.duration || 15);

    // Initial values (static or from keyframes)
    const currentRotate = interpolateKeyframes(clip.keyframes?.rotate, frame, clip.rotate || 0);
    const currentOpacity = interpolateKeyframes(clip.keyframes?.opacity, frame, 1);
    const currentScale = interpolateKeyframes(clip.keyframes?.scale, frame, 1);
    const currentX = interpolateKeyframes(clip.keyframes?.x, frame, clip.x || 0);
    const currentY = interpolateKeyframes(clip.keyframes?.y, frame, clip.y || 0);
    const currentZ = interpolateKeyframes(clip.keyframes?.z, frame, 0);
    const currentSkewX = interpolateKeyframes(clip.keyframes?.skewX, frame, 0);
    const currentSkewY = interpolateKeyframes(clip.keyframes?.skewY, frame, 0);
    const currentPerspective = interpolateKeyframes(clip.keyframes?.perspective, frame, 1000);

    // Filter Keyframes
    const kfBlur = interpolateKeyframes(clip.keyframes?.blur, frame, 0);
    const kfBrightness = interpolateKeyframes(clip.keyframes?.brightness, frame, 1);
    const kfContrast = interpolateKeyframes(clip.keyframes?.contrast, frame, 1);
    const kfSaturate = interpolateKeyframes(clip.keyframes?.saturate, frame, 1);
    const kfGrayscale = interpolateKeyframes(clip.keyframes?.grayscale, frame, 0);
    const kfHueRotate = interpolateKeyframes(clip.keyframes?.hueRotate, frame, 0);
    const kfInvert = interpolateKeyframes(clip.keyframes?.invert, frame, 0);

    let opacity = currentOpacity;
    let transformString = `perspective(${currentPerspective}px) translateZ(${currentZ}px) rotate(${currentRotate}deg) skew(${currentSkewX}deg, ${currentSkewY}deg)`;

    if (clip.mirror) {
        transformString += ' scaleX(-1)';
    }

    if (animType === 'fade') {
        opacity *= getFadeOpacity(frame, clip.durationInFrames, clip.animation?.duration);
    } else if (animType === 'pop') {
        const popScale = spring({ fps, frame, config: { damping: 10 } });
        transformString += ` scale(${currentScale * popScale})`;
    } else if (animType === 'slide' || animType === 'slideUp') {
        const offset = interpolate(frame, [0, animDuration], [100, 0], { extrapolateRight: 'clamp', easing: (t) => t * (2 - t) });
        transformString += ` translateY(${offset}px)`;
        opacity *= interpolate(frame, [0, animDuration / 2], [0, 1], { extrapolateRight: 'clamp' });
    } else if (animType === 'slideDown') {
        const offset = interpolate(frame, [0, animDuration], [-100, 0], { extrapolateRight: 'clamp', easing: (t) => t * (2 - t) });
        transformString += ` translateY(${offset}px)`;
        opacity *= interpolate(frame, [0, animDuration / 2], [0, 1], { extrapolateRight: 'clamp' });
    } else if (animType === 'slideLeft') {
        const offset = interpolate(frame, [0, animDuration], [100, 0], { extrapolateRight: 'clamp', easing: (t) => t * (2 - t) });
        transformString += ` translateX(${offset}px)`;
        opacity *= interpolate(frame, [0, animDuration / 2], [0, 1], { extrapolateRight: 'clamp' });
    } else if (animType === 'slideRight') {
        const offset = interpolate(frame, [0, animDuration], [-100, 0], { extrapolateRight: 'clamp', easing: (t) => t * (2 - t) });
        transformString += ` translateX(${offset}px)`;
        opacity *= interpolate(frame, [0, animDuration / 2], [0, 1], { extrapolateRight: 'clamp' });
    } else if (animType === 'spin') {
        const rotation = interpolate(frame, [0, animDuration], [0, 360], { extrapolateRight: 'clamp' });
        transformString += ` rotate(${rotation}deg)`;
    } else if (animType === 'shake') {
        const offset = Math.sin(frame * 0.5) * 10 * interpolate(frame, [0, animDuration], [1, 0], { extrapolateRight: 'clamp' });
        transformString += ` translateX(${offset}px)`;
    } else if (animType === 'bounce') {
        const absOffset = Math.abs(Math.sin(frame * 0.2)) * 30 * interpolate(frame, [0, animDuration], [1, 0], { extrapolateRight: 'clamp' });
        transformString += ` translateY(${-absOffset}px)`;
    }

    if (!transformString.includes('scale')) transformString += ` scale(${currentScale})`;

    const animationStyle: React.CSSProperties = {
        opacity,
        transform: transformString,
        left: currentX,
        top: currentY
    };

    // Calculate Effects Styles
    let filterString = '';
    if (kfBlur > 0) filterString += ` blur(${kfBlur}px)`;
    if (kfBrightness !== 1) filterString += ` brightness(${kfBrightness * 100}%)`;
    if (kfContrast !== 1) filterString += ` contrast(${kfContrast * 100}%)`;
    if (kfSaturate !== 1) filterString += ` saturate(${kfSaturate * 100}%)`;
    if (kfGrayscale > 0) filterString += ` grayscale(${kfGrayscale * 100}%)`;
    if (kfHueRotate > 0) filterString += ` hue-rotate(${kfHueRotate}deg)`;
    if (kfInvert > 0) filterString += ` invert(${kfInvert * 100}%)`;

    let textOutline: { color: string; width: number } | undefined;

    if (clip.effects && clip.effects.length > 0) {
        clip.effects.forEach(effect => {
            const color = effect.color || '#ffffff';
            const width = effect.width ?? 5;
            const blur = effect.blur ?? 5;
            const opacity = effect.opacity ?? 1;

            if (effect.type === 'glow') {
                filterString += ` drop-shadow(0 0 ${blur}px ${color})`;
            } else if (effect.type === 'outline') {
                if (clip.type === 'text') {
                    textOutline = { color, width };
                } else {
                    filterString += ` drop-shadow(${width}px 0 0 ${color}) drop-shadow(-${width}px 0 0 ${color}) drop-shadow(0 ${width}px 0 ${color}) drop-shadow(0 -${width}px 0 ${color})`;
                }
            } else if (effect.type === 'shadow') {
                filterString += ` drop-shadow(${width}px ${width}px ${blur}px ${color})`;
            } else if (effect.type === 'blur') {
                filterString += ` blur(${blur}px)`;
            } else if (effect.type === 'sepia') {
                filterString += ` sepia(${opacity * 100}%)`;
            } else if (effect.type === 'grayscale') {
                filterString += ` grayscale(${opacity * 100}%)`;
            } else if (effect.type === 'pulse') {
                const scale = 1 + (Math.sin(frame * 0.2) * 0.1 * (effect.intensity ?? 1));
                transformString += ` scale(${scale})`;
            } else if (effect.type === 'float') {
                const bounce = Math.sin(frame * 0.1) * 10 * (effect.intensity ?? 1);
                transformString += ` translateY(${bounce}px)`;
            } else if (effect.type === 'hue-rotate') {
                filterString += ` hue-rotate(${opacity * 360}deg)`;
            } else if (effect.type === 'brightness') {
                filterString += ` brightness(${opacity * 200}%)`;
            } else if (effect.type === 'contrast') {
                filterString += ` contrast(${opacity * 200}%)`;
            } else if (effect.type === 'invert') {
                filterString += ` invert(${opacity * 100}%)`;
            } else if (effect.type === 'saturate') {
                filterString += ` saturate(${opacity * 300}%)`;
            } else if (effect.type === 'drop-shadow') {
                filterString += ` drop-shadow(${effect.x ?? 5}px ${effect.y ?? 5}px ${blur}px ${color})`;
            } else if (effect.type === 'blur-complex') {
                filterString += ` blur(${blur}px)`;
            }
        });
    }

    const effectsStyle: React.CSSProperties = {
        filter: filterString.trim() || undefined,
    };

    const finalStyle = { ...animationStyle, ...effectsStyle, transform: transformString };

    // Base positioning style
    const isPositioned = typeof clip.x === 'number' || typeof clip.y === 'number' || typeof clip.width === 'number' || typeof clip.height === 'number';
    const crop = clip.crop || { left: 0, top: 0, right: 0, bottom: 0 };

    const positionStyle: React.CSSProperties = {
        position: 'absolute',
        left: isPositioned ? (animationStyle.left ?? clip.x ?? 0) : 0,
        top: isPositioned ? (animationStyle.top ?? clip.y ?? 0) : 0,
        width: isPositioned ? (clip.width || 400) : '100%',
        height: isPositioned ? (clip.height || 400) : '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden', // Required for OBS-style crop
        ...finalStyle,
    };

    const innerMediaStyle: React.CSSProperties = isPositioned ? {
        position: 'absolute',
        left: -crop.left,
        top: -crop.top,
        width: (clip.width || 400) + crop.left + crop.right,
        height: (clip.height || 400) + crop.top + crop.bottom,
        objectFit: 'cover' as const,
        flexShrink: 0,
        maxWidth: 'none',
        maxHeight: 'none',
        ...clip.style
    } : {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
        ...clip.style
    };

    // Render text
    if (clip.type === 'text') {
        const baseShadow = clip.style?.textShadow ?? '0 4px 10px rgba(0,0,0,0.5)';

        return (
            <div style={{ ...positionStyle, textShadow: undefined }}>
                <FittedText fontReady={fontReady} text={clip.content} style={clip.style} shadow={baseShadow} outline={textOutline} />
            </div>
        );
    }

    if (clip.type === 'code') {
        return (
            <div style={positionStyle}>
                <div style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    minWidth: '300px',
                    width: '100%', // Fill the container
                    height: '100%', // Fill the container
                    backgroundColor: '#1e1e1e', // Fallback/Basis
                    display: 'flex',
                    flexDirection: 'column',
                    ...clip.style
                }}>
                    {/* Window Header */}
                    <div style={{
                        height: '36px',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 12px',
                        gap: '8px',
                        flexShrink: 0
                    }}>
                        {/* Mac Dots */}
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#27c93f' }} />

                        {/* Filename */}
                        <div style={{
                            flex: 1,
                            textAlign: 'center',
                            fontSize: '13px',
                            color: 'rgba(255,255,255,0.6)',
                            fontFamily: 'Inter, sans-serif',
                            marginRight: '38px', // Visual balance
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {clip.title}
                        </div>
                    </div>

                    <div style={{ flex: 1, padding: '20px', width: '100%', overflow: 'hidden', fontSize: '20px' }}>
                        <CodeClipRenderer clip={clip} />
                    </div>
                </div>
            </div>
        );
    }

    if (clip.type === 'video') {
        const videoSrc = resolveAssetUrl(clip.content, assetBaseUrl);
        return (
            <div style={positionStyle}>
                <Video
                    src={videoSrc}
                    startFrom={Math.round(clip.mediaStartOffset || 0)}
                    playbackRate={clip.playbackRate || 1}
                    volume={clip.volume ?? 1}
                    style={innerMediaStyle}
                />
            </div>
        );
    }

    if (clip.type === 'image') {
        // Handle GIF - Gif syncs with timeline; use Sequence for mediaStartOffset
        if (clip.content.toLowerCase().endsWith('.gif')) {
            const playbackRate = clip.playbackRate || 1;
            const startOffset = Math.round(clip.mediaStartOffset || 0);
            const gifSrc = resolveAssetUrl(clip.content, assetBaseUrl);

            return (
                <div style={positionStyle}>
                    <Sequence from={-startOffset} durationInFrames={Infinity} layout="none">
                        <Gif
                            src={gifSrc}
                            playbackRate={playbackRate}
                            fit="cover"
                            style={innerMediaStyle}
                        />
                    </Sequence>
                </div>
            );
        }

        const imgSrc = resolveAssetUrl(clip.content, assetBaseUrl);
        return (
            <div style={positionStyle}>
                <Img
                    src={imgSrc}
                    style={innerMediaStyle}
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

    if (clip.type === 'tachie') {
        return (
            <div style={positionStyle}>
                <div style={{ ...innerMediaStyle, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <TachieRenderer key={`${assetBaseUrl || ''}:${clip.content}`} clip={clip} assetBaseUrl={assetBaseUrl} />
                </div>
            </div>
        );
    }

    if (clip.type === 'flow') {
        return (
            <div style={positionStyle}>
                <FlowRenderer clip={clip} />
            </div>
        );
    }

    if (clip.type === 'browser') {
        return (
            <div style={positionStyle}>
                <div style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    ...clip.style
                }}>
                    {/* Browser Header */}
                    <div style={{
                        height: '36px',
                        backgroundColor: '#f1f1f1',
                        borderBottom: '1px solid #ddd',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 12px',
                        gap: '8px',
                        flexShrink: 0
                    }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#27c93f' }} />
                        {/* Fake Address Bar */}
                        <div style={{
                            flex: 1,
                            backgroundColor: '#fff',
                            borderRadius: '4px',
                            height: '24px',
                            marginLeft: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 8px',
                            fontSize: '11px',
                            color: '#666',
                            border: '1px solid #e0e0e0',
                            fontFamily: 'system-ui, sans-serif'
                        }}>
                            {clip.title || 'localhost:3000'}
                        </div>
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, position: 'relative', backgroundColor: 'white' }}>
                        <iframe
                            srcDoc={clip.content.startsWith('<') ? clip.content : undefined}
                            src={!clip.content.startsWith('<') ? resolveAssetUrl(clip.content, assetBaseUrl) : undefined}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            title="Browser Preview"
                            sandbox="allow-scripts"
                        />
                    </div>
                </div>
            </div>
        );
    }

    if (clip.type === 'icon') {
        return (
            <div style={positionStyle}>
                <div style={innerMediaStyle}>
                    <Icon icon={clip.content} style={{ width: '100%', height: '100%', color: clip.style?.color || '#ffffff' }} />
                </div>
            </div>
        );
    }

    if (clip.type === 'audio') {
        const audioSrc = resolveAssetUrl(clip.content, assetBaseUrl);
        return <Audio src={audioSrc} startFrom={Math.round(clip.mediaStartOffset || 0)} playbackRate={clip.playbackRate || 1} volume={clip.volume ?? 1} />;
    }

    return null;
}

export const ResultVideo: React.FC<{
    clips: Clip[];
    primaryColor: string;
    assetBaseUrl?: string;
}> = ({ clips, primaryColor, assetBaseUrl }) => {
    const { fps } = useVideoConfig();

    // Sort clips by trackId descending
    // Visually top tracks (Lower IDs) should be rendered last (Highest Z-index)
    // Track 1 (Top) -> Render Last -> Front
    // Track 4 (Bottom) -> Render First -> Back
    const sortedClips = React.useMemo(() => {
        return [...clips].sort((a, b) => b.trackId - a.trackId);
    }, [clips]);

    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            {/* Background - Inline Styles */}
            <div
                style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'linear-gradient(to bottom right, #4c1d95, #000000, #000000)',
                    zIndex: 0
                }}
            />

            {sortedClips.map((clip, index) => (
                <Sequence
                    key={clip.id}
                    from={clip.startFrame}
                    durationInFrames={clip.durationInFrames}
                    premountFor={Math.min(clip.durationInFrames, fps)} // Load before play per best practices
                    style={{ zIndex: 10 + index }}
                >
                    <RenderClip clip={clip} assetBaseUrl={assetBaseUrl} />
                </Sequence>
            ))}
        </AbsoluteFill>
    );
};
