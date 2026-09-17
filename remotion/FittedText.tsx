import React, { useLayoutEffect, useRef } from 'react';
import { useDelayRender } from 'remotion';

export function FittedText({ text, style, shadow, outline, fontReady }: {
    text: string;
    fontReady?: Promise<void>;
    style?: React.CSSProperties;
    shadow: string;
    outline?: { color: string; width: number };
}) {
    const ref = useRef<HTMLHeadingElement>(null);
    const { delayRender, continueRender, cancelRender } = useDelayRender();
    useLayoutEffect(() => {
        const element = ref.current;
        const container = element?.parentElement;
        if (!element || !container) return;
        const handle = delayRender('Fit text after fonts load');
        let cancelled = false;
        const fit = async () => {
            try {
                await fontReady;
                await document.fonts.ready;
                if (cancelled) return;
                // Own the text node alongside the fitted size: do not shape CJK
                // text using incomplete fallback fonts while its files load.
                element.textContent = text;
                const requestedSize = style?.fontSize ?? 80;
                element.style.fontSize = typeof requestedSize === 'number' ? `${requestedSize}px` : requestedSize;
                let low = 1;
                let high = parseFloat(getComputedStyle(element).fontSize);
                const fits = () => element.scrollWidth <= container.clientWidth && element.scrollHeight <= container.clientHeight;
                if (!fits()) {
                    while (high - low > 0.5) {
                        const mid = (low + high) / 2;
                        element.style.fontSize = `${mid}px`;
                        if (fits()) low = mid;
                        else high = mid;
                    }
                    element.style.fontSize = `${low}px`;
                }
            } catch (error) {
                cancelRender(error);
            } finally {
                continueRender(handle);
            }
        };
        void fit();
        const observer = new ResizeObserver(() => { void fit(); });
        observer.observe(container);
        return () => {
            cancelled = true;
            observer.disconnect();
            continueRender(handle);
        };
    }, [text, style, fontReady, delayRender, continueRender, cancelRender]);

    return <h1 ref={ref} style={{
        fontFamily: 'sans-serif', fontSize: '80px', color: 'white', fontWeight: 800,
        margin: 0, width: '100%', boxSizing: 'border-box', flexShrink: 0,
        whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.3,
        ...style, textShadow: shadow,
        WebkitTextStrokeColor: outline?.color,
        WebkitTextStrokeWidth: outline ? `min(${Math.max(0, outline.width)}px, 0.06em)` : undefined,
        paintOrder: 'stroke fill',
    }} />;
}
