import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { describePsd } from '../lib/psd-structure.ts';

// Run the editor's actual effect with controlled promises and state setters.
// Keeping the effect in Editor avoids adding a production abstraction for tests.
const source = ts.createSourceFile('Editor.tsx', readFileSync(new URL('../components/editor/Editor.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const effects = [];
function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('loadPsd(')) effects.push(node.arguments[0]);
    ts.forEachChild(node, visit);
}
visit(source);
assert.equal(effects.length, 1, 'find the PSD selection effect');
const effectSource = ts.transpileModule('const effect = ' + effects[0].getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const captures = ['selectedClip', 'selectedClipId', 'selectedClipContent', 'selectedClipType', 'loadPsd', 'describePsd', 'setAvailableLayers', 'setPathsWithChildren', 'setCollapsedPaths', 'setClips', 'handleUpdateClip', 'console'];
const createEffect = new Function(...captures, effectSource + '\nreturn effect;');
const clip = (id, content = id + '.psd') => ({ id, content, type: 'tachie' });
const psd = name => ({ width: 1, height: 1, children: [{ name, children: [{ name: 'visible' }, { name: 'hidden', hidden: true }] }] });
const tick = () => new Promise(resolve => setImmediate(resolve));

function editor(clips) {
    const state = { clips, selectedId: null, layers: [], folders: new Set(), collapsed: new Set() };
    const requests = [];
    const errors = [];
    let cleanup;
    let queueUpdates = false;
    const updates = [];
    const setClips = update => queueUpdates ? updates.push(update) : state.clips = update(state.clips);
    return {
        state, requests, errors,
        select(id) {
            cleanup?.();
            state.selectedId = id;
            const selected = state.clips.find(item => item.id === id);
            cleanup = createEffect(selected, id, selected?.content, selected?.type,
                (url, base, metadataOnly) => {
                    assert.equal(metadataOnly, true);
                    return new Promise((resolve, reject) => requests.push({ url, resolve, reject }));
                }, describePsd,
                layers => { state.layers = layers; },
                folders => { state.folders = folders; },
                collapsed => { state.collapsed = collapsed; }, setClips,
                (key, value) => setClips(prev => prev.map(item => item.id === state.selectedId ? { ...item, [key]: value } : item)),
                { error: (...args) => errors.push(args) })();
        },
        unmount: () => cleanup?.(),
        deferUpdates: () => { queueUpdates = true; },
        flushUpdates: () => { for (const update of updates.splice(0)) state.clips = update(state.clips); },
    };
}

test('a late PSD completion cannot replace the newly selected clip or its layer metadata', async () => {
    const run = editor([clip('a'), clip('b')]);
    run.select('a'); run.select('b');
    run.requests[1].resolve(psd('B')); await tick();
    const current = structuredClone(run.state);
    run.requests[0].resolve(psd('A')); await tick();
    assert.deepEqual(run.state, current);
    assert.deepEqual(run.state.clips[1].tachieLayers, ['B/visible', 'B']);
    assert.equal(run.state.clips[0].tachieLayers, undefined);
    assert.deepEqual(run.state.folders, new Set(['B']));
});

test('an obsolete failure does not clear the current layers or report an error', async () => {
    const run = editor([clip('a'), clip('b')]);
    run.select('a'); run.select('b');
    run.requests[1].resolve(psd('B')); await tick();
    const current = structuredClone(run.state);
    run.requests[0].reject(new Error('old request failed')); await tick();
    assert.deepEqual(run.state, current);
    assert.deepEqual(run.errors, []);
});

test('replacing the PSD of the same clip ignores the previous source and clears old metadata', async () => {
    const run = editor([clip('a')]);
    run.select('a');
    run.state.layers = ['old']; run.state.folders = new Set(['old']); run.state.collapsed = new Set(['old']);
    run.state.clips = [clip('a', 'replacement.psd')];
    run.select('a');
    assert.deepEqual([run.state.layers, [...run.state.folders], [...run.state.collapsed]], [[], [], []]);
    run.requests[0].resolve(psd('Old')); await tick();
    assert.deepEqual(run.state.layers, []);
    run.requests[1].resolve(psd('New')); await tick();
    assert.deepEqual(run.state.clips[0].tachieLayers, ['New/visible', 'New']);
});

test('deselecting, selecting a non-PSD clip, and unmounting discard pending results', async () => {
    for (const selection of [null, 'text', 'unmount']) {
        const run = editor([clip('a'), { id: 'text', type: 'text', content: 'hello' }]);
        run.select('a');
        if (selection === 'unmount') run.unmount(); else run.select(selection);
        const current = structuredClone(run.state);
        run.requests[0].resolve(psd('A')); await tick();
        assert.deepEqual(run.state, current);
    }
});

test('defaults preserve layer and mouth settings edited while metadata was loading', async () => {
    for (const key of ['tachieLayers', 'mouthOpenLayers', 'mouthClosedLayers']) {
        const run = editor([clip('a')]);
        run.select('a');
        run.state.clips = [{ ...clip('a'), [key]: ['manual'] }];
        run.requests[0].resolve(psd('A')); await tick();
        assert.deepEqual(run.state.clips, [{ ...clip('a'), [key]: ['manual'] }]);
        assert.ok(run.state.layers.includes('A/visible'));
    }
});

test('a queued default update cannot initialize a replacement source or deleted clip', async () => {
    for (const replacement of [[], [clip('a', 'replacement.psd')], [{ ...clip('a'), type: 'image' }]]) {
        const run = editor([clip('a')]);
        run.deferUpdates(); run.select('a');
        run.requests[0].resolve(psd('A')); await tick();
        run.state.clips = replacement;
        run.flushUpdates();
        assert.equal(run.state.clips, replacement);
    }
});

test('cleanup also invalidates a default update already queued before selection changed', async () => {
    const run = editor([clip('a'), clip('b')]);
    run.deferUpdates(); run.select('a');
    run.requests[0].resolve(psd('A')); await tick();
    run.select('b'); run.flushUpdates();
    assert.deepEqual(run.state.clips, [clip('a'), clip('b')]);
});

test('a current load failure leaves no stale layer groups or default selections', async () => {
    const run = editor([clip('a')]);
    run.state.layers = ['old']; run.state.folders = new Set(['old']);
    run.select('a'); run.requests[0].reject(new Error('failed')); await tick();
    assert.deepEqual(run.state.layers, []);
    assert.deepEqual(run.state.folders, new Set());
    assert.deepEqual(run.state.clips, [clip('a')]);
    assert.equal(run.errors.length, 1);
});
