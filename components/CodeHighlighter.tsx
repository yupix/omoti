import React, { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';
import { continueRender, delayRender } from 'remotion';

interface CodeHighlighterProps {
    code: string;
    language?: string;
    theme?: string;
}

export const CodeHighlighter: React.FC<CodeHighlighterProps> = ({
    code,
    language = 'javascript',
    theme = 'dark-plus'
}) => {
    const [html, setHtml] = useState<string>('');
    const [handle] = useState(() => delayRender('Highlight Code'));

    useEffect(() => {
        let mounted = true;
        const highlight = async () => {
            try {
                // Determine language or fallback
                const lang = language || 'javascript';
                const out = await codeToHtml(code, {
                    lang: lang,
                    themes: {
                        light: 'github-light',
                        dark: theme
                    },
                    defaultColor: 'dark'
                });

                if (mounted) {
                    setHtml(out);
                    continueRender(handle);
                }
            } catch (e) {
                console.error("Shiki Highlight Error:", e);
                // On error, resolve anyway so video doesn't hang
                if (mounted) {
                    continueRender(handle);
                }
            }
        };

        highlight();

        return () => {
            mounted = false;
        };
    }, [code, language, theme, handle]);

    // If highlighting hasn't finished, show raw code.
    // Ideally we want to wait, but for preview/Remotion validation, delayRender handles the waiting.
    // However, during initial load, we might see a flash if we don't return null or something.
    // But since we use delayRender, Remotion player will wait until we call continueRender.
    if (!html) {
        return <pre style={{ opacity: 0 }}>{code}</pre>;
    }

    return (
        <div
            dangerouslySetInnerHTML={{ __html: html }}
            style={{
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace'
            }}
        />
    );
};
