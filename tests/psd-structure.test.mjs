import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describePsd, inspectStructure, defaultLayerRules, characterContext, getCharacterIssues, getCharacterSetupIssues, resolveCharacterLayers, psdStructureSchema } from '../lib/psd-structure.ts';

const leaf = (name, hidden = false) => ({ name, hidden, left: 0, top: 0, right: 10, bottom: 10 });
const folder = (name, children, hidden = false) => ({ name, children, hidden });
const psd = { width: 100, height: 200, children: [
    folder('体', [folder('*制服', [leaf('上着'), leaf('スカート')]), folder('*私服', [leaf('シャツ'), leaf('ズボン')], true)]),
    folder('髪', [leaf('前髪'), leaf('後ろ髪')]),
    folder('表情', [
        folder('*パーツ', [
            leaf('鼻'),
            folder('!目', [leaf('*普通'), leaf('*笑顔', true)]),
            folder('!眉', [leaf('*普通'), leaf('*にっこり', true)]),
            folder('!口', [leaf('*閉じ'), leaf('*あ', true), leaf('*い', true)]),
        ]),
        folder('*表情セット', [leaf('*普通の顔'), leaf('*笑った顔', true)], true),
    ]),
] };
const structure = describePsd(psd);
const id = path => structure.nodes.find(node => node.path === path).id;
const character = { name: '茜', structure, rules: defaultLayerRules(structure) };
const config = {
    neutral: [id('表情/*パーツ/鼻'), id('表情/*パーツ/!目/*普通'), id('表情/*パーツ/!眉/*普通'), id('表情/*パーツ/!口/*閉じ')],
    happy: [id('表情/*パーツ/鼻'), id('表情/*パーツ/!目/*笑顔'), id('表情/*パーツ/!眉/*にっこり'), id('表情/*パーツ/!口/*閉じ')],
    mouthOpen: [id('表情/*パーツ/!口/*あ')], mouthClosed: [id('表情/*パーツ/!口/*閉じ')],
};
function script(value = config, emotion = 'happy') { return { tachieConfigs: { 茜: value }, scenes: [{ character: '茜', emotion }] }; }

test('PSD inventory preserves initial visibility, hierarchy, duplicates and slash names', () => {
    const value = describePsd({ width: 10, height: 10, children: [folder('face', [leaf('///'), leaf('same'), leaf('same')], true)] });
    assert.equal(new Set(value.nodes.map(node => node.path)).size, value.nodes.length);
    assert.equal(value.nodes[1].name, '///');
    assert.equal(value.nodes[1].parentId, value.nodes[0].id);
    assert.equal(value.nodes[1].visible, false);
    assert.equal(value.nodes[1].hidden, false);
    assert.ok(!value.nodes[1].path.slice('face/'.length).includes('/'));
    assert.equal(psdStructureSchema.safeParse(value).success, true);
});

test('Baseline preserves every initial body/clothing leaf and supports multi-part branches', () => {
    const info = inspectStructure(structure, character.rules);
    assert.deepEqual(info.base.map(id => info.byId.get(id).name), ['上着', 'スカート', '前髪', '後ろ髪']);
    assert.deepEqual(getCharacterSetupIssues(character), []);
    assert.deepEqual(getCharacterIssues(script(), [character]), []);
    const selection = resolveCharacterLayers(character, config, 'happy');
    assert.ok(selection.tachieLayers.includes('体/*制服/上着'));
    assert.ok(selection.tachieLayers.includes('体/*制服/スカート'));
    assert.ok(selection.tachieLayers.includes('表情/*パーツ/!目/*笑顔'));
    assert.ok(!selection.tachieLayers.some(path => path.includes('/!口/')));
    assert.deepEqual(selection.mouthOpenLayers, ['表情/*パーツ/!口/*あ']);
    assert.deepEqual(selection.mouthClosedLayers, ['表情/*パーツ/!口/*閉じ']);
    const prompt = characterContext([character]);
    assert.match(prompt, /initialVisible/);
    assert.match(prompt, /preservedBase/);
    assert.match(prompt, /one direct CHILD BRANCH, not one leaf/);
    assert.match(prompt, /no images are provided/);
});

test('Unknown IDs, folder IDs, missing parts, duplicate eyes and mixed face modes fail', () => {
    const variants = [
        { ...config, happy: ['L9999'] },
        { ...config, happy: config.happy.filter(value => value !== id('表情/*パーツ/鼻')) },
        { ...config, happy: [id('表情')] },
        { ...config, happy: config.happy.filter(value => value !== id('表情/*パーツ/!目/*笑顔')) },
        { ...config, happy: [...config.happy, id('表情/*パーツ/!目/*普通')] },
        { ...config, happy: [...config.happy, id('表情/*表情セット/*笑った顔')] },
        { ...config, happy: [...config.happy, id('体/*私服/シャツ')] },
    ];
    for (const value of variants) assert.ok(getCharacterIssues(script(value), [character]).length, JSON.stringify(value));
    assert.match(getCharacterIssues({ ...script(), scenes: [{ character: '架空', emotion: 'happy' }] }, [character]).join(' '), /unknown PSD character/);
    assert.match(getCharacterIssues(script(config, 'surprised'), [character]).join(' '), /surprised/);
});

test('Combined face presets stay static; invalid lip sync never passes validation', () => {
    const face = [id('表情/*表情セット/*笑った顔')];
    const staticConfig = { neutral: face, happy: face, mouthOpen: [], mouthClosed: [] };
    assert.deepEqual(getCharacterIssues(script(staticConfig), [character]), []);
    for (const value of [
        { ...staticConfig, mouthOpen: face, mouthClosed: [id('表情/*表情セット/*普通の顔')] },
        { ...config, mouthClosed: [] },
        { ...config, mouthClosed: config.mouthOpen },
    ]) assert.ok(getCharacterIssues(script(value), [character]).length);
});

test('Stale or contradictory manual base rules are rejected before AI generation', () => {
    assert.ok(getCharacterSetupIssues({ ...character, rules: { mandatory: ['not in PSD'], exclusive: [], optional: [] } }).length);
    assert.ok(getCharacterSetupIssues({ ...character, rules: { mandatory: ['体/*制服', '体/*私服'], exclusive: [], optional: [] } }).length);
});

test('Inventory schema rejects invalid parents, duplicate IDs and node counts over its limit', () => {
    const node = { id: 'L0', path: 'a', name: 'a', parentId: null, group: false, visible: true, hidden: false, drawable: true };
    const make = nodes => ({ width: 1, height: 1, nodes });
    assert.equal(psdStructureSchema.safeParse(make([node, { ...node, path: 'b' }])).success, false);
    assert.equal(psdStructureSchema.safeParse(make([{ ...node, parentId: 'missing' }])).success, false);
    const nodes = Array.from({ length: 10_001 }, (_, i) => ({ ...node, id: `L${i}`, path: `p${i}` }));
    assert.equal(psdStructureSchema.safeParse(make(nodes.slice(0, 10_000))).success, true);
    assert.equal(psdStructureSchema.safeParse(make(nodes)).success, false);
});

test('A composite eye with several visible components is not mistaken for alternatives', () => {
    const structure = describePsd({ width: 10, height: 10, children: [folder('目', [leaf('白目'), leaf('瞳'), leaf('ハイライト')])] });
    const character = { name: 'Character', structure };
    const info = inspectStructure(structure);
    assert.equal(info.groups.length, 0);
    assert.equal(info.base.length, 3);
    assert.deepEqual(getCharacterIssues({ tachieConfigs: { Character: { neutral: [], mouthOpen: [], mouthClosed: [] } }, scenes: [{ character: 'Character', emotion: 'neutral' }] }, [character]), []);
});
