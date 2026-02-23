import { AbsoluteFill, Sequence, useCurrentFrame, Audio, Video, interpolate, spring, useVideoConfig, Img } from 'remotion';
import { resolveAssetUrl } from './utils';
import { Gif } from '@remotion/gif';
import { Icon } from '@iconify/react';
import React from 'react';
import { Clip } from '../types';
import { CodeHighlighter } from '../components/CodeHighlighter';
import { TachieRenderer } from './TachieRenderer';
import { FlowRenderer } from './FlowRenderer';
import { loadFont as loadNotoSansJP } from "@remotion/google-fonts/NotoSansJP";
import { loadFont as loadNotoSerifJP } from "@remotion/google-fonts/NotoSerifJP";
import { loadFont as loadZenKakuGothicNew } from "@remotion/google-fonts/ZenKakuGothicNew";
import { loadFont as loadMPLUS1p } from "@remotion/google-fonts/MPLUS1p";
import { loadFont as loadKaiseiTokumin } from "@remotion/google-fonts/KaiseiTokumin";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadPlayfairDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue";
import { Easing } from 'remotion';

const interpolateKeyframes = (keyframes: any[] | undefined, frame: number, defaultValue: number) => {
    if (!keyframes || keyframes.length === 0) return defaultValue;
    if (keyframes.length === 1) return keyframes[0].value;

    const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

    if (frame <= sorted[0].frame) return sorted[0].value;
    if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].value;

    for (let i = 0; i < sorted.length - 1; i++) {
        const k1 = sorted[i];
        const k2 = sorted[i + 1];
        if (frame >= k1.frame && frame <= k2.frame) {
            let easing = Easing.linear;
            if (k1.easing === 'ease-in') easing = Easing.in(Easing.exp);
            if (k1.easing === 'ease-out') easing = Easing.out(Easing.exp);
            if (k1.easing === 'ease-in-out') easing = Easing.inOut(Easing.exp);

            return interpolate(frame, [k1.frame, k2.frame], [k1.value, k2.value], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing
            });
        }
    }
    return defaultValue;
};
import { loadFont as loadPermanentMarker } from "@remotion/google-fonts/PermanentMarker";

// Preload fonts - Japanese fonts use default (no japanese subset in @remotion/google-fonts)
loadNotoSansJP();
loadNotoSerifJP();
loadZenKakuGothicNew();
loadMPLUS1p();
loadKaiseiTokumin();
// Latin fonts: specify weights/subsets to reduce bundle size
loadInter('normal', { weights: ['400', '600', '700'], subsets: ['latin'] });
loadRoboto('normal', { weights: ['400', '700'], subsets: ['latin'] });
loadMontserrat('normal', { weights: ['400', '700'], subsets: ['latin'] });
loadPlayfairDisplay('normal', { weights: ['400', '700'], subsets: ['latin'] });
loadOswald('normal', { weights: ['400', '700'], subsets: ['latin'] });
loadBebasNeue('normal', { weights: ['400'], subsets: ['latin'] });
loadPermanentMarker('normal', { weights: ['400'], subsets: ['latin'] });

const CodeClipRenderer: React.FC<{ clip: Clip }> = ({ clip }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    let displayCode = clip.content;

    // Logic to determine which step is active
    if (clip.steps && clip.steps.length > 0) {
        const localFrame = frame; // Frame is already relative inside Sequence
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
            transitionDuration={(clip.transitionDuration || 24) * (1000 / fps)}
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
        const fadeIn = interpolate(frame, [0, animDuration], [0, 1], { extrapolateRight: 'clamp' });
        const fadeOut = interpolate(frame, [Math.max(animDuration, clip.durationInFrames - animDuration), clip.durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        opacity *= (fadeIn * fadeOut);
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

    let textShadowString = '';
    let extraStyles: React.CSSProperties = {};

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
                    const w = width;
                    // Use 32 points for a truly circular and anti-aliased look
                    // Adding a tiny 0.5px blur acts as anti-aliasing for the shadow layers
                    for (let i = 0; i < 32; i++) {
                        const angle = (i * 2 * Math.PI) / 32;
                        const x = (Math.cos(angle) * w).toFixed(2);
                        const y = (Math.sin(angle) * w).toFixed(2);
                        textShadowString += `${x}px ${y}px 0.5px ${color}, `;
                    }
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
        textShadow: textShadowString.replace(/, $/, '') || undefined,
        ...extraStyles
    };

    const finalStyle = { ...animationStyle, ...effectsStyle };

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
        const baseShadow = '0 4px 10px rgba(0,0,0,0.5)';
        const effectShadow = effectsStyle.textShadow;
        const combinedShadow = effectShadow ? `${effectShadow}, ${baseShadow}` : baseShadow;

        return (
            <div style={{ ...positionStyle, textShadow: undefined }}>
                <h1 style={{
                    fontFamily: 'sans-serif',
                    fontSize: '80px',
                    color: 'white',
                    fontWeight: 800,
                    margin: 0,
                    ...clip.style,
                    textShadow: combinedShadow,
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
                    <TachieRenderer clip={clip} assetBaseUrl={assetBaseUrl} />
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
