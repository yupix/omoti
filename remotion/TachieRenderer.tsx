import { useCurrentFrame, delayRender, continueRender } from 'remotion';
import React, { useEffect, useState, useMemo } from 'react';
import { readPsd, Psd, Layer } from 'ag-psd';
import { Clip } from '../types';

interface TachieRendererProps {
    clip: Clip;
}

const psdCache: Record<string, Psd> = {};

export const TachieRenderer: React.FC<TachieRendererProps> = ({ clip }) => {
    const [psd, setPsd] = useState<Psd | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [handle] = useState(() => delayRender(`Loading Tachie: ${clip.title}`));

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
                console.log('Fetching PSD from:', clip.content);
                const response = await fetch(clip.content);
                if (!response.ok) {
                    throw new Error(`Failed to fetch PSD: ${response.status} ${response.statusText}`);
                }
                const buffer = await response.arrayBuffer();

                // Check for valid PSD signature (8BPS)
                const view = new DataView(buffer);
                // '8' = 56, 'B' = 66, 'P' = 80, 'S' = 83 in ASCII?
                // Actually readPsd throws if invalid.
                // But let's log if it looks like textual/html
                if (buffer.byteLength < 4) throw new Error('File too small');

                // Simple signature check: 8BPS
                const sig = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
                if (sig !== '8BPS') {
                    // Try to read as text to see what we got
                    const text = new TextDecoder().decode(buffer.slice(0, 100));
                    throw new Error(`Invalid PSD signature: '${sig}' (Content starts with: ${text})`);
                }

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
            // ag-psd returns layers from bottom to top. 
            // To render correctly, we draw them in that same order (bottom-most first).
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                const currentPath = parentPath ? `${parentPath}/${layer.name}` : (layer.name || 'Unnamed Layer');

                // Visibility logic
                let isVisible = !layer.hidden;
                let shouldTraverse = true;

                if (clip.tachieLayers && clip.tachieLayers.length > 0) {
                    const inList = clip.tachieLayers.includes(currentPath);
                    const childInList = !!(layer.children && clip.tachieLayers.some(p => p.startsWith(currentPath + '/')));

                    if (layer.children) {
                        isVisible = inList || childInList;
                        shouldTraverse = isVisible;
                    } else {
                        isVisible = inList;
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
    }, [psd, clip.tachieLayers]);

    if (error) {
        return <div style={{ color: 'red' }}>{error}</div>;
    }

    if (!renderedImage) {
        return <div style={{ width: '100%', height: '100%', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>Loading PSD...</div>;
    }

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
