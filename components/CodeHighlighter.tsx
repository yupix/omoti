import React, { useEffect, useState } from 'react';
import { createHighlighter, type Highlighter } from 'shiki';
import { ShikiMagicMove } from 'shiki-magic-move/react';
import 'shiki-magic-move/dist/style.css';
import { continueRender, delayRender } from 'remotion';

interface CodeHighlighterProps {
    code: string;
    language?: string;
    theme?: string;
    transitionDuration?: number; // ms
}

// Singleton to avoid re-creating the highlighter which is expensive
let highlighterInstance: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

export const CodeHighlighter: React.FC<CodeHighlighterProps> = ({
    code,
    language = 'typescript',
    theme = 'dark-plus',
    transitionDuration = 800
}) => {
    // Always initialize to null to ensure hydration matches server (which should be null)
    const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
    // Use a ref to track if we've already handled the delayRender
    const handleRef = React.useRef<number | null>(null);

    // Initialize/Load
    useEffect(() => {
        // If we have an instance already, check if it has the required language before setting
        if (highlighterInstance && !highlighter) {
            if (highlighterInstance.getLoadedLanguages().includes(language as any)) {
                setHighlighter(highlighterInstance);
            }
        }

        if (handleRef.current === null) {
            handleRef.current = delayRender('Highlight Code Load');
        }

        let mounted = true;

        const load = async () => {
            try {
                if (!highlighterPromise) {
                    highlighterPromise = createHighlighter({
                        themes: ['dark-plus', theme as any],
                        langs: ['javascript', 'typescript', 'css', 'html', 'json', 'tsx', 'jsx', 'bash', 'yaml', language as any],
                    });
                }

                const h = await highlighterPromise;
                highlighterInstance = h;

                // Ensure resource is loaded
                const promises = [];
                if (!h.getLoadedLanguages().includes(language as any)) {
                    promises.push(h.loadLanguage(language as any));
                }
                if (!h.getLoadedThemes().includes(theme as any)) {
                    promises.push(h.loadTheme(theme as any));
                }

                if (promises.length > 0) {
                    await Promise.all(promises);
                }

                if (mounted) {
                    setHighlighter(h);
                    if (handleRef.current !== null) {
                        continueRender(handleRef.current);
                        handleRef.current = null;
                    }
                }
            } catch (err) {
                console.error("Failed to load highlighter", err);
                if (handleRef.current !== null) {
                    continueRender(handleRef.current);
                    handleRef.current = null;
                }
            }
        };

        load();

        return () => {
            mounted = false;
        };
    }, [language, theme]);

    if (!highlighter) {
        // Render a placeholder with the raw code to reduce layout shift/flash, but hidden?
        // Or just null. Null is safer for hydration if we assume server renders null.
        return <pre className="opacity-0">{code}</pre>;
    }

    return (
        <ShikiMagicMove
            lang={language as any}
            theme={theme as any}
            highlighter={highlighter}
            code={code}
            options={{ duration: transitionDuration, stagger: 0.3, lineNumbers: false }}
        />
    );
};
