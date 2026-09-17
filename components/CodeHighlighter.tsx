import React, { useLayoutEffect, useRef, useState } from 'react';
import { createHighlighter, type Highlighter, type BundledLanguage, type BundledTheme } from 'shiki';
import { useDelayRender } from 'remotion';

interface CodeHighlighterProps {
    code: string;
    language?: string;
    theme?: string;
}

let highlighterPromise: Promise<Highlighter> | null = null;

export const CodeHighlighter = React.memo(function CodeHighlighter({ code, language = 'typescript', theme = 'dark-plus' }: CodeHighlighterProps) {
    const [ready, setReady] = useState<{ highlighter: Highlighter; language: string; theme: string } | null>(null);
    const { delayRender, continueRender } = useDelayRender();
    const [initialHandle] = useState(() => delayRender('Load syntax highlighting'));
    const renderHandle = useRef<number | null>(initialHandle);
    useLayoutEffect(() => {
        const handle = renderHandle.current ?? delayRender('Load syntax highlighting');
        renderHandle.current = handle;
        let mounted = true;
        const load = async () => {
            try {
                if (!highlighterPromise) {
                    highlighterPromise = createHighlighter({ themes: ['dark-plus'], langs: ['typescript'] });
                    highlighterPromise.catch(() => { highlighterPromise = null; });
                }
                const highlighter = await highlighterPromise;
                await Promise.all([
                    highlighter.loadLanguage(language as BundledLanguage),
                    highlighter.loadTheme(theme as BundledTheme),
                ]);
                if (mounted) setReady({ highlighter, language, theme });
            } catch (error) {
                console.error('Failed to load syntax highlighting:', error);
                continueRender(handle);
                if (renderHandle.current === handle) renderHandle.current = null;
            }
        };
        void load();
        return () => {
            mounted = false;
            continueRender(handle);
            if (renderHandle.current === handle) renderHandle.current = null;
        };
    }, [language, theme, delayRender, continueRender]);

    useLayoutEffect(() => {
        if (ready?.language === language && ready.theme === theme && renderHandle.current !== null) {
            // Release only after the highlighted tokens have reached the DOM.
            continueRender(renderHandle.current);
            renderHandle.current = null;
        }
    }, [ready, language, theme, continueRender]);

    // Render the current frame's code directly. CSS transitions depend on playback
    // history and can leave tokens invisible when seeking or rendering a still.
    const tokens = ready?.language === language && ready.theme === theme
        ? ready.highlighter.codeToTokens(code, { lang: language as BundledLanguage, theme: theme as BundledTheme }).tokens : null;
    return <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: 'inherit', lineHeight: 1.5, color: '#d4d4d4', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        <code>{tokens ? tokens.map((line, index) => <React.Fragment key={index}>
            {index > 0 && '\n'}
            {line.map((token, tokenIndex) => <span key={tokenIndex} style={{ color: token.color }}>{token.content}</span>)}
        </React.Fragment>) : code}</code>
    </pre>;
});
