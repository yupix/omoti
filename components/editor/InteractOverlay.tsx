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
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [initialClipState, setInitialClipState] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const [snapLines, setSnapLines] = useState<{ x: boolean, y: boolean }>({ x: false, y: false });

    // Safe access to clip properties for hooks/logic
    const x = clip?.x ?? 0;
    const y = clip?.y ?? 0;
    const w = clip?.width ?? (clip?.x === undefined ? compWidth : 400);
    const h = clip?.height ?? (clip?.x === undefined ? compHeight : 400);

    const handleMouseDown = (e: React.MouseEvent, mode: 'move' | 'resize') => {
        if (!clip) return; // Ensure clip exists before interaction
        e.preventDefault();
        e.stopPropagation();

        if (mode === 'move') setIsDragging(true);
        if (mode === 'resize') setIsResizing(true);

        setStartPos({ x: e.clientX, y: e.clientY });
        setInitialClipState({ x, y, w, h });
    };

    useEffect(() => {
        if (!isDragging && !isResizing) return;

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

                // Snap to Center Logic
                const centerX = compWidth / 2;
                const centerY = compHeight / 2;
                const threshold = 15;

                // Snap X
                const currentCenterX = newX + initialClipState.w / 2;
                let finalX = newX;
                let snappedX = false;

                if (Math.abs(currentCenterX - centerX) < threshold) {
                    finalX = centerX - initialClipState.w / 2;
                    snappedX = true;
                }

                // Snap Y
                const currentCenterY = newY + initialClipState.h / 2;
                let finalY = newY;
                let snappedY = false;

                if (Math.abs(currentCenterY - centerY) < threshold) {
                    finalY = centerY - initialClipState.h / 2;
                    snappedY = true;
                }

                setSnapLines({ x: snappedX, y: snappedY });
                onUpdate({ x: Math.round(finalX), y: Math.round(finalY), width: initialClipState.w, height: initialClipState.h });
            }

            if (isResizing) {
                // Determine new dimensions
                let newW = Math.max(10, initialClipState.w + dx);
                let newH = Math.max(10, initialClipState.h + dy);

                if (e.shiftKey) {
                    const ratio = initialClipState.w / initialClipState.h;
                    // Keep aspect ratio
                    if (Math.abs(dx) > Math.abs(dy)) {
                        newH = newW / ratio;
                    } else {
                        newW = newH * ratio;
                    }
                }

                onUpdate({ width: Math.round(newW), height: Math.round(newH) });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
            setInitialClipState(null);
            setSnapLines({ x: false, y: false });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, startPos, initialClipState, compWidth, compHeight, onUpdate]);

    if (!clip) return null;

    // Only text, image, shape, code support positioning for now
    if (!['text', 'image', 'shape', 'code'].includes(clip.type)) return null;

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
        justifyContent: 'flex-start'
    };

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none z-50">
            {/* Snap Lines */}
            {snapLines.x && (
                <div className="absolute top-0 bottom-0 w-px bg-red-500 left-1/2 -ml-[0.5px] z-40" />
            )}
            {snapLines.y && (
                <div className="absolute left-0 right-0 h-px bg-red-500 top-1/2 -mt-[0.5px] z-40" />
            )}

            {/* The Gizmo Box */}
            <div style={style} onMouseDown={(e) => handleMouseDown(e, 'move')}>

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
