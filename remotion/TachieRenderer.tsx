import { useCurrentFrame, delayRender, continueRender, useVideoConfig } from 'remotion';
import React, { useEffect, useState, useMemo } from 'react';
import { readPsd, Psd, Layer } from 'ag-psd';
import { Clip } from '../types';
import { useAudioData, visualizeAudio } from "@remotion/media-utils";

interface TachieRendererProps {
    clip: Clip;
}

const psdCache: Record<string, Psd> = {};

export const TachieRenderer: React.FC<TachieRendererProps> = ({ clip }) => {
    const [psd, setPsd] = useState<Psd | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [handle] = useState(() => delayRender(`Loading Tachie: ${clip.title}`));

    // Audio analysis for Lip Sync
    const audioData = clip.audioUrl ? useAudioData(clip.audioUrl) : null;
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    let isMouthOpen = false;
    if (audioData) {
        const amplitude = visualizeAudio({
            audioData,
            frame,
            fps,
            numberOfSamples: 1,
        })[0];
        // Threshold for mouth opening (0-1)
        isMouthOpen = amplitude > 0.05;
    }

    useEffect(() => {
        let isMounted = true;
        const loadPsd = async () => {
            if (psdCache[clip.content]) {
                if (isMounted) {
                    setPsd(psdCache[clip.content]);
                    continueRender(handle);
                }
                return;
            }

            try {
                const response = await fetch(clip.content);
                if (!response.ok) throw new Error(`Failed to fetch PSD`);
                const buffer = await response.arrayBuffer();
                const parsedPsd = readPsd(buffer);
                psdCache[clip.content] = parsedPsd;
                if (isMounted) {
                    setPsd(parsedPsd);
                    continueRender(handle);
                }
            } catch (err: any) {
                console.error('Failed to load PSD:', err);
                if (isMounted) {
                    setError(`Failed to load PSD: ${err.message}`);
                    continueRender(handle);
                }
            }
        };

        loadPsd();
        return () => { isMounted = false; };
    }, [clip.content, handle]);

    const renderedImage = useMemo(() => {
        if (!psd) return null;

        const canvas = document.createElement('canvas');
        canvas.width = psd.width;
        canvas.height = psd.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const drawLayers = (layers: Layer[], parentPath: string = '') => {
            // Draw from bottom-most layer to top-most layer (back-to-front)
            // ag-psd returns layers in bottom-to-top order in some contexts, 
            // but standard PSD structure is often reported top-to-bottom.
            // Based on user feedback and structure analysis, 0 to length-1 is the correct back-to-front drawing order.
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                const currentPath = parentPath ? `${parentPath}/${layer.name}` : (layer.name || 'Unnamed Layer');

                // Visibility logic
                let isVisible = !layer.hidden;
                let shouldTraverse = true;

                if (clip.tachieLayers && clip.tachieLayers.length > 0) {
                    const inBaseList = clip.tachieLayers.includes(currentPath);
                    const isMandatory = clip.mandatoryLayers?.includes(currentPath);
                    const isOpenMouth = clip.mouthOpenLayers?.includes(currentPath);
                    const isClosedMouth = clip.mouthClosedLayers?.includes(currentPath);

                    const childInBase = !!(layer.children && clip.tachieLayers.some(p => p.startsWith(currentPath + '/')));
                    const childInMandatory = !!(layer.children && clip.mandatoryLayers?.some(p => p.startsWith(currentPath + '/')));
                    const childInOpen = !!(layer.children && clip.mouthOpenLayers?.some(p => p.startsWith(currentPath + '/')));
                    const childInClosed = !!(layer.children && clip.mouthClosedLayers?.some(p => p.startsWith(currentPath + '/')));

                    if (layer.children) {
                        // Traverse if any of our states need this folder
                        isVisible = inBaseList || childInBase || isMandatory || childInMandatory || isOpenMouth || childInOpen || isClosedMouth || childInClosed;
                        shouldTraverse = isVisible;
                    } else {
                        // Leaf logic
                        if (isOpenMouth) isVisible = !!isMouthOpen;
                        else if (isClosedMouth) isVisible = !isMouthOpen;
                        else isVisible = !!(inBaseList || isMandatory);

                        shouldTraverse = false;
                    }
                }

                if (layer.children) {
                    if (shouldTraverse) {
                        drawLayers(layer.children, currentPath);
                    }
                } else if (isVisible && layer.canvas) {
                    ctx.drawImage(layer.canvas, layer.left ?? 0, layer.top ?? 0);
                }
            }
        };

        if (psd.children) {
            drawLayers(psd.children);
        }

        return canvas.toDataURL();
    }, [psd, clip.tachieLayers, clip.mouthOpenLayers, clip.mouthClosedLayers, isMouthOpen]);

    if (error) return <div style={{ color: 'red' }}>{error}</div>;
    if (!renderedImage) return null;

    return (
        <img
            src={renderedImage}
            alt="tachie"
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                ...clip.style
            }}
        />
    );
};
