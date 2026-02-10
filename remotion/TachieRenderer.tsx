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
        const loadPsd = async () => {
            if (psdCache[clip.content]) {
                setPsd(psdCache[clip.content]);
                continueRender(handle);
                return;
            }

            try {
                const response = await fetch(clip.content);
                const buffer = await response.arrayBuffer();
                const parsedPsd = readPsd(buffer);
                psdCache[clip.content] = parsedPsd;
                setPsd(parsedPsd);
                continueRender(handle);
            } catch (err) {
                console.error('Failed to load PSD:', err);
                setError('Failed to load PSD');
                continueRender(handle);
            }
        };

        loadPsd();
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
