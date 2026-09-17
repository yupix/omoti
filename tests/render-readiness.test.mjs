import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Server rendering deliberately does not run effects: the initial frame must
// already be blocked before asynchronous loaders can register their callbacks.
const remotionMock = `export const useDelayRender = () => ({
    delayRender: label => { globalThis.initialRenderHandles.push(label); return globalThis.initialRenderHandles.length; },
    continueRender: () => {}, cancelRender: error => { throw error; },
});
export const useCurrentFrame = () => 0;
export const useVideoConfig = () => ({ fps: 30 });
export const getRemotionEnvironment = () => ({ isRendering: true });`;
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === 'remotion') return { url: 'data:text/javascript,' + encodeURIComponent(remotionMock), shortCircuit: true };
        if (specifier === '@remotion/media-utils') return { url: 'data:text/javascript,export const useAudioData = () => null; export const visualizeAudio = () => [0];', shortCircuit: true };
        if (specifier === '../lib/psd') return { url: 'data:text/javascript,export const loadPsd = () => {}; export const drawPsd = () => {};', shortCircuit: true };
        if (specifier === './utils') return nextResolve(new URL('../remotion/utils.ts', import.meta.url).href, context);
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (!url.endsWith('.tsx')) return nextLoad(url, context);
        const source = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
            compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        }).outputText;
        return { format: 'module', source, shortCircuit: true };
    },
});
const { CodeHighlighter } = await import('../components/CodeHighlighter.tsx');
const { TachieRenderer } = await import('../remotion/TachieRenderer.tsx');

test('code holds the initial frame before highlighting effects start', () => {
    globalThis.initialRenderHandles = [];
    const html = renderToStaticMarkup(React.createElement(CodeHighlighter, { code: 'const answer = 42;' }));
    assert.match(html, /const answer = 42;/);
    assert.deepEqual(globalThis.initialRenderHandles, ['Load syntax highlighting']);
});

test('PSD holds the initial frame before its download effect starts', () => {
    globalThis.initialRenderHandles = [];
    const html = renderToStaticMarkup(React.createElement(TachieRenderer, { clip: { type: 'tachie', content: '/avatar.psd' } }));
    assert.match(html, /<canvas/);
    assert.deepEqual(globalThis.initialRenderHandles, ['Loading PSD: /avatar.psd']);
});
