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
    // Calculate Animation Styles
    // Calculate Animation Styles
    let opacity = 1;
    let transformString = `rotate(${clip.rotate || 0}deg)`;

    if (clip.animation?.type === 'fade') {
        const animDuration = Math.max(1, clip.animation.duration || 10);
        const fadeIn = interpolate(frame, [0, animDuration], [0, 1], { extrapolateRight: 'clamp' });
        const fadeOut = interpolate(frame, [Math.max(animDuration, clip.durationInFrames - animDuration), clip.durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        opacity = fadeIn * fadeOut;
        transformString += ' scale(1)';
    } else if (clip.animation?.type === 'pop') {
        const scale = spring({
            fps,
            frame,
            config: { damping: 10 }
        });
        transformString += ` scale(${scale})`;
    } else if (clip.animation?.type === 'slide') {
        const slideY = interpolate(frame, [0, 20], [100, 0], { extrapolateRight: 'clamp', easing: (t) => t * (2 - t) }); // Slide up
        transformString += ` translateY(${slideY}%)`;
        opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
    } else {
        transformString += ' scale(1)';
    }

    const animationStyle: React.CSSProperties = { opacity, transform: transformString };

    // Calculate Effects Styles
    let filterString = '';
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
                    // Multi-shadow hack for better text outline
                    const w = width;
                    textShadowString += `${w}px ${w}px 0 ${color}, -${w}px ${w}px 0 ${color}, ${w}px -${w}px 0 ${color}, -${w}px -${w}px 0 ${color}, `;
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
        left: isPositioned ? clip.x : 0,
        top: isPositioned ? clip.y : 0,
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
