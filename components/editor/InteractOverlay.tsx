import React, { useState, useEffect, useRef } from 'react';
import { Clip } from '@/types';
import { Move, CornerRightDown } from 'lucide-react';

interface InteractOverlayProps {
    clip: Clip | undefined;
    onUpdate: (updates: Partial<Clip>) => void;
    width: number; // Composition width (e.g. 1280)
    height: number; // Composition height (e.g. 720)
}

export const InteractOverlay: React.FC<InteractOverlayProps> = ({ clip, onUpdate, width: compWidth, height: compHeight }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [initialClipState, setInitialClipState] = useState<{ x: number, y: number, w: number, h: number, r: number } | null>(null);
    const [snapLines, setSnapLines] = useState<{ centerX: boolean, centerY: boolean, left: boolean, top: boolean, right: boolean, bottom: boolean }>({
        centerX: false, centerY: false, left: false, top: false, right: false, bottom: false
    });

    // Safe access to clip properties for hooks/logic
    const x = clip?.x ?? 0;
    const y = clip?.y ?? 0;
    const w = clip?.width ?? (clip?.x === undefined ?
        (clip?.type === 'text' ? 800 : (clip?.type === 'image' || clip?.type === 'tachie' || clip?.type === 'video') ? 600 : compWidth) : 400);
    const h = clip?.height ?? (clip?.x === undefined ?
        (clip?.type === 'text' ? 200 : (clip?.type === 'image' || clip?.type === 'tachie' || clip?.type === 'video') ? 600 : compHeight) : 400);
    const r = clip?.rotate ?? 0;

    const handleMouseDown = (e: React.MouseEvent, mode: 'move' | 'resize' | 'rotate') => {
        if (!clip) return; // Ensure clip exists before interaction
        e.preventDefault();
        e.stopPropagation();

        if (mode === 'move') setIsDragging(true);
        if (mode === 'resize') setIsResizing(true);
        if (mode === 'rotate') setIsRotating(true);

        setStartPos({ x: e.clientX, y: e.clientY });
        setInitialClipState({ x, y, w, h, r });
    };

    useEffect(() => {
        if (!isDragging && !isResizing && !isRotating) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current || !initialClipState) return;

            const rect = containerRef.current.getBoundingClientRect();
            const scaleX = compWidth / rect.width;
            const scaleY = compHeight / rect.height;

            const dx = (e.clientX - startPos.x) * scaleX;
            const dy = (e.clientY - startPos.y) * scaleY;

            if (isDragging) {
                const newX = initialClipState.x + dx;
                const newY = initialClipState.y + dy;

                // Snap Logic
                const centerX = compWidth / 2;
                const centerY = compHeight / 2;
                const threshold = 15;

                const currentCenterX = newX + initialClipState.w / 2;
                const currentCenterY = newY + initialClipState.h / 2;
                const currentLeft = newX;
                const currentRight = newX + initialClipState.w;
                const currentTop = newY;
                const currentBottom = newY + initialClipState.h;

                let finalX = newX;
                let snapXType: 'center' | 'left' | 'right' | null = null;

                if (Math.abs(currentCenterX - centerX) < threshold) {
                    finalX = centerX - initialClipState.w / 2;
                    snapXType = 'center';
                } else if (Math.abs(currentLeft - 0) < threshold) {
                    finalX = 0;
                    snapXType = 'left';
                } else if (Math.abs(currentRight - compWidth) < threshold) {
                    finalX = compWidth - initialClipState.w;
                    snapXType = 'right';
                }

                let finalY = newY;
                let snapYType: 'center' | 'top' | 'bottom' | null = null;

                if (Math.abs(currentCenterY - centerY) < threshold) {
                    finalY = centerY - initialClipState.h / 2;
                    snapYType = 'center';
                } else if (Math.abs(currentTop - 0) < threshold) {
                    finalY = 0;
                    snapYType = 'top';
                } else if (Math.abs(currentBottom - compHeight) < threshold) {
                    finalY = compHeight - initialClipState.h;
                    snapYType = 'bottom';
                }

                setSnapLines({
                    centerX: snapXType === 'center',
                    centerY: snapYType === 'center',
                    left: snapXType === 'left',
                    right: snapXType === 'right',
                    top: snapYType === 'top',
                    bottom: snapYType === 'bottom'
                });
                onUpdate({ x: Math.round(finalX), y: Math.round(finalY), width: initialClipState.w, height: initialClipState.h });
            }

            if (isResizing) {
                const theta = initialClipState.r * (Math.PI / 180);
                const cos = Math.cos(theta);
                const sin = Math.sin(theta);
                const localDx = dx * cos + dy * sin;
                const localDy = -dx * sin + dy * cos;
                let newW = Math.max(10, initialClipState.w + localDx);
                let newH = Math.max(10, initialClipState.h + localDy);

                const threshold = 15;
                let snapRight = false;
                let snapBottom = false;
                let snapCenterX = false;
                let snapCenterY = false;

                // Snapping for resize (only if rotation is 0 for simplicity)
                if (initialClipState.r === 0) {
                    const currentRight = initialClipState.x + newW;
                    if (Math.abs(currentRight - compWidth) < threshold) {
                        newW = compWidth - initialClipState.x;
                        snapRight = true;
                    } else if (Math.abs(currentRight - compWidth / 2) < threshold) {
                        newW = compWidth / 2 - initialClipState.x;
                        snapCenterX = true;
                    }

                    const currentBottom = initialClipState.y + newH;
                    if (Math.abs(currentBottom - compHeight) < threshold) {
                        newH = compHeight - initialClipState.y;
                        snapBottom = true;
                    } else if (Math.abs(currentBottom - compHeight / 2) < threshold) {
                        newH = compHeight / 2 - initialClipState.y;
                        snapCenterY = true;
                    }
                }

                if (e.shiftKey) {
                    const ratio = initialClipState.w / initialClipState.h;
                    if (Math.abs(localDx) > Math.abs(localDy)) {
                        newH = newW / ratio;
                        // Clear vertical snap if shift-resize changes H away from snap
                        if (snapBottom || snapCenterY) {
                            // This is tricky. For now, let's just let it be.
                        }
                    } else {
                        newW = newH * ratio;
                    }
                }

                setSnapLines({
                    centerX: snapCenterX,
                    centerY: snapCenterY,
                    left: false,
                    top: false,
                    right: snapRight,
                    bottom: snapBottom
                });

                onUpdate({ width: Math.round(newW), height: Math.round(newH) });
            }

            if (isRotating) {
                const rect = containerRef.current.getBoundingClientRect();
                const scaleX = compWidth / rect.width;
                const scaleY = compHeight / rect.height;
                const screenCX = rect.left + rect.width * ((initialClipState.x + initialClipState.w / 2) / compWidth);
                const screenCY = rect.top + rect.height * ((initialClipState.y + initialClipState.h / 2) / compHeight);
                const angleRad = Math.atan2(e.clientY - screenCY, e.clientX - screenCX);
                let angleDeg = (angleRad * 180 / Math.PI) + 90;
                if (e.shiftKey) {
                    angleDeg = Math.round(angleDeg / 15) * 15;
                }
                onUpdate({ rotate: Math.round(angleDeg) });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
            setIsRotating(false);
            setInitialClipState(null);
            setSnapLines({ centerX: false, centerY: false, left: false, top: false, right: false, bottom: false });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, isRotating, startPos, initialClipState, compWidth, compHeight, onUpdate]);

    if (!clip) return null;

    // Only text, image, shape, code support positioning for now
    if (!['text', 'image', 'shape', 'code', 'tachie', 'flow', 'video'].includes(clip.type)) return null;

    // Calculate percentage styles for the overlay box
    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${(x / compWidth) * 100}%`,
        top: `${(y / compHeight) * 100}%`,
        width: `${(w / compWidth) * 100}%`,
        height: `${(h / compHeight) * 100}%`,
        border: '2px solid #3b82f6', // blue-500
        boxSizing: 'border-box',
        pointerEvents: 'auto', // Allow catching clicks
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        transform: `rotate(${r}deg)`,
        transformOrigin: 'center center' // Match ResultVideo
    };

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none z-50">
            {/* Snap Lines */}
            {snapLines.centerX && (
                <div className="absolute top-0 bottom-0 w-px bg-red-500 left-1/2 -ml-[0.5px] z-40" />
            )}
            {snapLines.centerY && (
                <div className="absolute left-0 right-0 h-px bg-red-500 top-1/2 -mt-[0.5px] z-40" />
            )}
            {snapLines.left && (
                <div className="absolute top-0 bottom-0 w-px bg-red-500 left-0 z-40" />
            )}
            {snapLines.right && (
                <div className="absolute top-0 bottom-0 w-px bg-red-500 right-0 z-40" />
            )}
            {snapLines.top && (
                <div className="absolute left-0 right-0 h-px bg-red-500 top-0 z-40" />
            )}
            {snapLines.bottom && (
                <div className="absolute left-0 right-0 h-px bg-red-500 bottom-0 z-40" />
            )}

            {/* The Gizmo Box */}
            <div style={style} onMouseDown={(e) => handleMouseDown(e, 'move')}>

                {/* Rotate Handle (Top Center Stick) */}
                <div
                    className="absolute -top-6 left-1/2 -ml-[1px] h-6 w-0.5 bg-blue-500 z-50 flex flex-col items-center justify-start group"
                >
                    <div
                        className="w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-grab active:cursor-grabbing shadow-sm"
                        onMouseDown={(e) => handleMouseDown(e, 'rotate')}
                    />
                </div>

                {/* Drag Handle (Invisible full area, but cursor indicates) */}
                <div className="absolute inset-0 cursor-move hover:bg-blue-500/10 transition-colors" />

                {/* Resize Handle (Bottom Right) */}
                <div
                    className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-50 shadow-md flex items-center justify-center"
                    onMouseDown={(e) => handleMouseDown(e, 'resize')}
                >
                    <div className="w-1 h-1 bg-blue-500 rounded-full" />
                </div>

                {/* Info Label */}
                <div className="absolute -top-6 left-0 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
                    {Math.round(x)}, {Math.round(y)} ({Math.round(w)}x{Math.round(h)})
                </div>
            </div>
        </div>
    );
};
