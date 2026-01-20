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
    const [snapLines, setSnapLines] = useState<{ x: boolean, y: boolean }>({ x: false, y: false });

    // Safe access to clip properties for hooks/logic
    const x = clip?.x ?? 0;
    const y = clip?.y ?? 0;
    const w = clip?.width ?? (clip?.x === undefined ? compWidth : 400);
    const h = clip?.height ?? (clip?.x === undefined ? compHeight : 400);
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
                // Project screen delta to local rotated space
                // Angle in radians (negative because Y is down in screen? No, standard rotation matrix)
                // Screen coord to Local: Rotate by -theta.
                // Theta is initialClipState.r (degrees).
                const theta = initialClipState.r * (Math.PI / 180);
                const cos = Math.cos(theta);
                const sin = Math.sin(theta);

                // standard 2d rotation
                const localDx = dx * cos + dy * sin;
                const localDy = -dx * sin + dy * cos;

                // Determine new dimensions
                let newW = Math.max(10, initialClipState.w + localDx);
                let newH = Math.max(10, initialClipState.h + localDy);

                if (e.shiftKey) {
                    const ratio = initialClipState.w / initialClipState.h;
                    // Keep aspect ratio
                    if (Math.abs(localDx) > Math.abs(localDy)) {
                        newH = newW / ratio;
                    } else {
                        newW = newH * ratio;
                    }
                }

                // We assume top-left anchor is fixed for now?
                // Rotating resize is tricky. If we just change W/H, it expands from CENTER if using transform-origin center?
                // Visual box is `transformOrigin: center`.
                // If I increase width, the box grows left AND right from center.
                // But dragging bottom-right corner usually implies Top-Left is anchored.
                // To achieve Corner Resize behavior with Center Keypoint:
                // We must Adjust Center (x, y) as well as Width/Height.

                // For simplicity MVP: Let it grow from center?
                // "Resize Handle (Bottom Right)". 
                // If I drag BR away, box grows.
                // If it grows from center, BR moves out, TL moves out.
                // The mouse cursor stays at BR.
                // So "Grow from Center" actually aligns well with "Drag BR away"?
                // Yes, if we consider `localDx` as full DeltaW (triggered by edge drag)?
                // No, `localDx` is Center-to-Mouse delta change? No, startPos is mouse.
                // It works for center-based scaling fairly intuitively if we mimic scaling.

                onUpdate({ width: Math.round(newW), height: Math.round(newH) });
            }

            if (isRotating) {
                const rect = containerRef.current.getBoundingClientRect();
                const scaleX = compWidth / rect.width;
                const scaleY = compHeight / rect.height;

                // Calculate angle relative to center
                const screenCX = rect.left + rect.width * ((initialClipState.x + initialClipState.w / 2) / compWidth);
                const screenCY = rect.top + rect.height * ((initialClipState.y + initialClipState.h / 2) / compHeight);

                const angleRad = Math.atan2(e.clientY - screenCY, e.clientX - screenCX);
                let angleDeg = (angleRad * 180 / Math.PI) + 90; // +90 because handle is at top (-90)

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
            setSnapLines({ x: false, y: false });
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
        justifyContent: 'flex-start',
        transform: `rotate(${r}deg)`,
        transformOrigin: 'center center' // Match ResultVideo
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
