import { useCurrentFrame, useDelayRender, useVideoConfig, getRemotionEnvironment } from 'remotion';
import React, { useLayoutEffect, useRef, useState } from 'react';
import type { Psd } from 'ag-psd';
import type { Clip } from '../types';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { resolveAssetUrl } from './utils';
import { drawPsd, loadPsd } from '../lib/psd';

interface TachieRendererProps {
    clip: Clip;
    assetBaseUrl?: string;
}

function PsdTachie({ clip, assetBaseUrl, mouthOpen = false }: TachieRendererProps & { mouthOpen?: boolean }) {
    const { tachieLayers, mandatoryLayers, mouthOpenLayers, mouthClosedLayers } = clip;
    const [loaded, setLoaded] = useState<{ psd: Psd; content: string; baseUrl?: string; attempt: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { delayRender, continueRender, cancelRender } = useDelayRender();
    const [initialHandle] = useState(() => delayRender(`Loading PSD: ${clip.content}`, { timeoutInMilliseconds: 180_000 }));
    const renderHandle = useRef<number | null>(initialHandle);
    const psd = loaded?.content === clip.content && loaded.baseUrl === assetBaseUrl && loaded.attempt === attempt ? loaded.psd : null;
    useLayoutEffect(() => {
        let mounted = true;
        const handle = renderHandle.current ?? delayRender(`Loading PSD: ${clip.content}`, { timeoutInMilliseconds: 180_000 });
        renderHandle.current = handle;
        setError(null);
        setLoaded(null);
        loadPsd(clip.content, assetBaseUrl).then(result => {
            if (mounted) setLoaded({ psd: result, content: clip.content, baseUrl: assetBaseUrl, attempt });
        }).catch(error => {
            if (!mounted) return;
            if (getRemotionEnvironment().isRendering) cancelRender(error);
            else setError(error instanceof Error ? error.message : 'PSDを読み込めませんでした。');
            continueRender(handle);
            if (renderHandle.current === handle) renderHandle.current = null;
        });
        return () => {
            mounted = false;
            continueRender(handle);
            if (renderHandle.current === handle) renderHandle.current = null;
        };
    }, [clip.content, assetBaseUrl, attempt, delayRender, continueRender, cancelRender]);

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !psd) return;
        if (canvas.width !== psd.width) canvas.width = psd.width;
        if (canvas.height !== psd.height) canvas.height = psd.height;
        try {
            drawPsd(ctx, psd, { tachieLayers, mandatoryLayers, mouthOpenLayers, mouthClosedLayers }, mouthOpen);
        } catch (error) {
            cancelRender(error);
        } finally {
            if (renderHandle.current !== null) {
                continueRender(renderHandle.current);
                renderHandle.current = null;
            }
        }
    }, [psd, tachieLayers, mandatoryLayers, mouthOpenLayers, mouthClosedLayers, mouthOpen, continueRender, cancelRender]);

    if (error) return <div role="alert" style={{ font: '20px sans-serif', color: '#fff', background: '#3f2027', padding: 20, borderRadius: 12, textShadow: 'none' }}>
        <p style={{ margin: '0 0 12px' }}>{error}</p>
        <button onClick={() => setAttempt(value => value + 1)} style={{ textDecoration: 'underline' }}>再読み込み</button>
    </div>;
    return <canvas ref={canvasRef} aria-label="立ち絵" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
}

function TalkingTachie({ audioUrl, ...props }: TachieRendererProps & { audioUrl: string }) {
    const audio = useAudioData(audioUrl);
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const mouthOpen = audio ? visualizeAudio({ audioData: audio, frame, fps, numberOfSamples: 1 })[0] > 0.05 : false;
    return <PsdTachie {...props} mouthOpen={mouthOpen} />;
}

export const TachieRenderer: React.FC<TachieRendererProps> = props => props.clip.audioUrl
    ? <TalkingTachie {...props} audioUrl={resolveAssetUrl(props.clip.audioUrl, props.assetBaseUrl)} />
    : <PsdTachie {...props} />;
