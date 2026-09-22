"use client";

import React, { useState, useRef, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EditorSidebar({
    collapsed,
    title,
    onCollapse,
    children,
}: {
    collapsed: boolean;
    title: string;
    onCollapse: () => void;
    children: React.ReactNode;
}) {
    const [sidebarWidth, setSidebarWidth] = useState(380);
    const isResizingSidebar = useRef(false);

    const handleMouseMoveSidebar = useCallback((e: MouseEvent) => {
        if (!isResizingSidebar.current) return;
        const newWidth = Math.max(300, Math.min(600, e.clientX));
        setSidebarWidth(newWidth);
    }, []);

    const stopResizing = useCallback(() => {
        isResizingSidebar.current = false;
        document.removeEventListener('mousemove', handleMouseMoveSidebar);
        document.body.style.cursor = 'default';
    }, [handleMouseMoveSidebar]);

    const startResizing = useCallback(() => {
        isResizingSidebar.current = true;
        document.addEventListener('mousemove', handleMouseMoveSidebar);
        document.addEventListener('mouseup', stopResizing, { once: true });
        document.body.style.cursor = 'col-resize';
    }, [handleMouseMoveSidebar, stopResizing]);

    return (
        <>
            {/* Resizable Content Panel (Folding Animation) */}
            <aside
                style={{ width: collapsed ? '0px' : `${sidebarWidth}px` }}
                className={`bg-card/50 backdrop-blur-sm flex flex-col z-20 shadow-inner overflow-hidden shrink-0 transition-[width] duration-300 ease-in-out ${!collapsed ? 'border-r border-border' : ''}`}
            >
                <div className="min-w-[300px] h-full flex flex-col" style={{ width: `${sidebarWidth}px` }}>
                    <div className="p-4 border-b border-border/50 flex items-center justify-between bg-card/30 sticky top-0 font-sans h-14 shrink-0">
                        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground truncate">
                            {title}
                        </h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                            onClick={onCollapse}
                            title="Collapse Sidebar"
                        >
                            <ChevronLeft size={18} />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {children}
                    </div>
                </div>
            </aside>

            {/* Splitter/Resizer for side panel - Smoothly hides with panel */}
            <div
                onMouseDown={startResizing}
                style={{
                    opacity: collapsed ? 0 : 1,
                    width: collapsed ? 0 : '4px',
                    visibility: collapsed ? 'hidden' : 'visible'
                }}
                className="h-full bg-border/30 hover:bg-primary/40 transition-all cursor-col-resize active:bg-primary flex flex-col justify-center items-center group/sep z-30 shrink-0"
            >
                <div className="h-10 w-0.5 bg-muted-foreground/10 group-hover/sep:bg-primary/40 rounded-full transition-colors" />
            </div>
        </>
    );
}
