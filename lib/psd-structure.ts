import type { Layer, Psd } from 'ag-psd';
import { z } from 'zod';

export const psdStructureSchema = z.object({
    width: z.number().positive(), height: z.number().positive(),
    nodes: z.array(z.object({
        id: z.string(), parentId: z.string().nullable(), path: z.string(), name: z.string(),
        group: z.boolean(), hidden: z.boolean(), visible: z.boolean(), drawable: z.boolean(),
    })).max(10_000),
}).superRefine((structure, ctx) => {
    const ids = new Map<string, boolean>();
    const paths = new Set<string>();
    for (const [index, node] of structure.nodes.entries()) {
        if (ids.has(node.id) || paths.has(node.path) || (node.parentId !== null && ids.get(node.parentId) !== true)) {
            ctx.addIssue({ code: 'custom', path: ['nodes', index], message: 'Layer IDs/paths must be unique and parents must be preceding folders.' });
        }
        ids.set(node.id, node.group);
        paths.add(node.path);
    }
});
export type PsdStructure = z.infer<typeof psdStructureSchema>;
export type LayerRules = { mandatory: string[]; exclusive: { name: string; path: string }[]; optional: string[] };
export type PsdCharacter = { name: string; role?: string; facing?: string; structure: PsdStructure; rules?: LayerRules };
type Node = PsdStructure['nodes'][number];

// Paths stay compatible with the layer UI while escaping actual slashes and
// distinguishing duplicate sibling names. The AI uses compact IDs, never paths.
export function indexPsdLayers(psd: Psd) {
    const entries: { node: Node; layer: Layer }[] = [];
    const visit = (layers: Layer[], parent: Node | null) => {
        for (const [index, layer] of layers.entries()) {
            const name = layer.name || 'Unnamed Layer';
            const duplicate = layers.filter(item => (item.name || 'Unnamed Layer') === name).length > 1;
            const segment = name.replaceAll('%', '%25').replaceAll('/', '%2F') + (duplicate ? `%00${index}` : '');
            const node: Node = {
                id: `L${entries.length}`, parentId: parent?.id || null,
                path: parent ? `${parent.path}/${segment}` : segment, name,
                group: !!layer.children, hidden: !!layer.hidden,
                visible: (!parent || parent.visible) && !layer.hidden,
                drawable: !layer.children && ((layer.right ?? 0) > (layer.left ?? 0) && (layer.bottom ?? 0) > (layer.top ?? 0) || !!layer.canvas || !!layer.imageData),
            };
            entries.push({ node, layer });
            if (layer.children) visit(layer.children, node);
        }
    };
    visit(psd.children || [], null);
    return entries;
}

export function describePsd(psd: Psd): PsdStructure {
    return { width: psd.width, height: psd.height, nodes: indexPsdLayers(psd).map(entry => entry.node) };
}

function part(name: string) {
    if (/^(?:[!*\s]*)(?:[左右]?(?:口|くち)|mouth)(?:$|[（(])/i.test(name)) return 'mouth';
    if (/^(?:[!*\s]*)(?:[左右]?(?:目|眼)|eyes?)(?:$|[（(])/i.test(name)) return 'eyes';
    if (/^(?:[!*\s]*)(?:[左右]?(?:眉|眉毛)|brows?|eyebrows?)(?:$|[（(])/i.test(name)) return 'brows';
    return null;
}

export function inspectStructure(structure: PsdStructure, rules?: LayerRules) {
    const { nodes } = structure;
    const byId = new Map(nodes.map(node => [node.id, node]));
    const byPath = new Map(nodes.map(node => [node.path, node]));
    const ancestors = (node: Node) => {
        const result: Node[] = [];
        let parent = node.parentId ? byId.get(node.parentId) : undefined;
        while (parent && !result.includes(parent)) { result.push(parent); parent = parent.parentId ? byId.get(parent.parentId) : undefined; }
        return result;
    };
    const legacyPaths = new Map<string, Node[]>();
    for (const node of nodes) {
        const path = [...ancestors(node).reverse(), node].map(item => item.name).join('/');
        legacyPaths.set(path, [...(legacyPaths.get(path) || []), node]);
    }
    for (const [path, matches] of legacyPaths) if (matches.length === 1 && !byPath.has(path)) byPath.set(path, matches[0]);
    const under = (id: string, parent: string) => id === parent || !!byId.get(id) && ancestors(byId.get(id)!).some(node => node.id === parent);
    const expression = (node: Node) => [node, ...ancestors(node)].some(item => !!part(item.name) || /表情|expression|face|顔/i.test(item.name));
    const defaults = nodes.filter(node => !node.group && node.visible).map(node => node.id);
    const groups = nodes.filter(node => node.group).flatMap(node => {
        const children = nodes.filter(child => child.parentId === node.id);
        const starred = children.filter(child => child.name.startsWith('*'));
        const mixedParts = new Set(children.map(child => part(child.name)).filter(Boolean)).size > 1;
        const manual = rules?.exclusive.some(group => group.path === node.path);
        const namedAlternatives = !!part(node.name) && children.filter(child => !child.hidden).length <= 1;
        const options = starred.length >= 2 ? starred : !mixedParts && (namedAlternatives || manual) ? children : [];
        if (options.length < 2) return [];
        return [{ id: node.id, options: options.map(option => option.id), required: options.some(option => option.visible) || !!part(node.name) || !!manual }];
    });
    // Preserve the actual initial body/hair/outfit rather than guessing a leaf
    // from an entire body/pose folder. Expression deltas are selected by AI.
    let base = defaults.filter(id => !expression(byId.get(id)!) || !groups.some(group => group.options.some(option => under(id, option))));
    const mandatory = (rules?.mandatory || []).flatMap(path => {
        const node = byPath.get(path);
        if (!node) return [];
        return nodes.filter(leaf => {
            if (leaf.group || !under(leaf.id, node.id)) return false;
            const lineage = [leaf, ...ancestors(leaf)];
            return !lineage.slice(0, lineage.findIndex(item => item.id === node.id)).some(item => item.hidden);
        }).map(leaf => leaf.id);
    });
    for (const group of groups) {
        const chosen = group.options.filter(option => mandatory.some(id => under(id, option)));
        if (chosen.length === 1) base = base.filter(id => !group.options.some(option => option !== chosen[0] && under(id, option)));
    }
    base = [...new Set([...base, ...mandatory])];
    return { byId, byPath, ancestors, under, expression, defaults, base, groups };
}

export function defaultLayerRules(structure: PsdStructure): LayerRules {
    const info = inspectStructure(structure);
    return { mandatory: info.base.map(id => info.byId.get(id)!.path), exclusive: [], optional: [] };
}

export function getCharacterSetupIssues(character: PsdCharacter) {
    const info = inspectStructure(character.structure, character.rules);
    const issues: string[] = [];
    for (const path of [...(character.rules?.mandatory || []), ...(character.rules?.exclusive.map(group => group.path) || []), ...(character.rules?.optional || [])]) {
        if (!info.byPath.has(path)) issues.push(`${character.name}: 設定中のレイヤー ${path} が見つかりません。「構造を再解析」で初期表示の設定に戻してください。`);
    }
    for (const group of info.groups) {
        const branches = group.options.filter(option => info.base.some(id => info.under(id, option)));
        if (branches.length > 1) issues.push(`${character.name}: 必須パーツの設定で ${info.byId.get(group.id)!.name} の差分が重複しています。「構造を再解析」で設定を見直してください。`);
    }
    return issues;
}

export function characterContext(characters: PsdCharacter[]) {
    if (!characters.length) return '';
    return `PSD CHARACTERS (structure and initial visibility; no images are provided):\n${characters.map(character => {
        const info = inspectStructure(character.structure, character.rules);
        return JSON.stringify({
            name: character.name, role: character.role || '', facing: character.facing || 'right',
            initialVisible: info.defaults, preservedBase: info.base,
            // Parent IDs retain hierarchy even when layer names contain '/'.
            nodes: character.structure.nodes.map(node => [node.id, node.parentId, node.group ? 'folder' : 'layer', node.name, node.hidden ? 'hidden' : 'shown']),
            exclusiveBranches: info.groups,
        });
    }).join('\n')}
For every scene name the exact character and emotion. Provide tachieConfigs[characterName] with neutral, each used emotion, mouthOpen and mouthClosed arrays of LEAF IDs (L0, L1, ...).
The app always adds preservedBase. Keep fixed components such as a nose or skin when their branch is active; only decorative extras such as sweat or blush may be omitted. Start neutral from initialVisible minus preservedBase. Preserve identity, outfit and pose; change expression parts to match the dialogue. Do not invent IDs or select folders.
exclusiveBranches means choose at most one direct CHILD BRANCH, not one leaf in the whole folder. A selected branch may require several leaves (eyes, brows, mouth, etc.). Never combine alternative poses, outfits, full-face presets or multiple mouths.
Prefer the initial face preset when uncertain. Do not combine a full-face preset with separate face parts. Use named alternatives only when their meaning is clear; do not claim to have seen the images.
Use separate mouthOpen/mouthClosed only if actual standalone mouth layers exist and can coexist with the chosen expression. Otherwise leave BOTH empty and keep a static face; never fabricate lip sync for a combined face image.
`;
}

export function getCharacterIssues(script: unknown, characters: PsdCharacter[]): string[] {
    if (!characters.length) return [];
    const schema = z.object({
        tachieConfigs: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
        scenes: z.array(z.object({ character: z.string(), emotion: z.string().default('neutral') }).passthrough()),
    });
    const parsed = schema.safeParse(script);
    if (!parsed.success) return parsed.error.issues.map(issue => `PSD ${issue.path.join('.')}: ${issue.message}`);
    const { tachieConfigs, scenes } = parsed.data;
    const issues: string[] = [];
    for (const [index, scene] of scenes.entries()) {
        if (!characters.some(character => character.name === scene.character)) issues.push(`scenes[${index}].character: unknown PSD character ${scene.character}. Use an exact supplied character name.`);
    }
    for (const character of characters) {
        const used = scenes.filter(scene => scene.character === character.name);
        if (!used.length) continue;
        const config = tachieConfigs[character.name];
        const prefix = `tachieConfigs[${character.name}]`;
        if (!config) { issues.push(`${prefix}: missing character configuration.`); continue; }
        const info = inspectStructure(character.structure, character.rules);
        const emotions = [...new Set(['neutral', ...used.map(scene => scene.emotion)])];
        if (used.some(scene => ['mouthOpen', 'mouthClosed'].includes(scene.emotion))) issues.push(`${prefix}: mouthOpen/mouthClosed are lip-sync states, not scene emotions.`);
        for (const key of [...emotions, 'mouthOpen', 'mouthClosed']) {
            if (!config[key]) issues.push(`${prefix}.${key}: supply an array of actual leaf IDs, empty only when no matching parts exist.`);
        }
        for (const [key, selected] of Object.entries(config)) {
            if (new Set(selected).size !== selected.length) issues.push(`${prefix}.${key}: duplicate layer IDs.`);
            for (const id of selected) {
                const node = info.byId.get(id);
                if (!node || node.group) issues.push(`${prefix}.${key}: ${id} is not an available leaf ID. Use the supplied inventory.`);
            }
        }
        const open = config.mouthOpen || [];
        const closed = config.mouthClosed || [];
        if (!!open.length !== !!closed.length || open.some(id => closed.includes(id))) issues.push(`${prefix}: mouthOpen/mouthClosed must be different, nonempty alternatives, or both empty for a static face.`);
        const mouthGroup = (id: string) => {
            const node = info.byId.get(id);
            return node ? [node, ...info.ancestors(node)].find(item => part(item.name) === 'mouth') : undefined;
        };
        for (const id of [...open, ...closed]) {
            if (!mouthGroup(id)) issues.push(`${prefix}: ${id} is not a standalone mouth part. Leave mouth arrays empty for combined face presets.`);
        }
        const mouthRoots = new Set([...open, ...closed].map(id => mouthGroup(id)?.id).filter(Boolean));
        if (mouthRoots.size > 1) issues.push(`${prefix}: use open/closed mouths from the same mouth group.`);
        for (const emotion of emotions) {
            if (!config[emotion]) continue;
            const chosen = [...new Set([...info.base, ...config[emotion]])].filter(id => info.byId.has(id));
            if (character.structure.nodes.some(node => node.drawable) && !chosen.some(id => info.byId.get(id)?.drawable)) issues.push(`${prefix}.${emotion}: the resulting character has no visible pixels.`);
            const states = open.length ? [closed, open] : [[]];
            for (const mouth of states) {
                const selected = mouth.length ? [...chosen.filter(id => !mouthGroup(id)), ...mouth] : chosen;
                const activeParents = (node: Node) => info.ancestors(node).every(parent => {
                    const choice = info.groups.some(group => group.options.includes(parent.id));
                    return choice ? selected.some(id => info.under(id, parent.id)) : !parent.hidden || parent.name.startsWith('!') || selected.some(id => info.under(id, parent.id));
                });
                for (const leaf of character.structure.nodes) {
                    const optional = [leaf, ...info.ancestors(leaf)].some(node => /汗|影|頬紅|赤面|効果|涙|blush|sweat|shadow|effect/i.test(node.name)) || character.rules?.optional.some(path => {
                        const node = info.byPath.get(path);
                        return node && info.under(leaf.id, node.id);
                    });
                    if (!leaf.group && leaf.drawable && (!leaf.hidden || leaf.name.startsWith('!')) && !optional &&
                        info.expression(leaf) && !info.groups.some(group => group.options.includes(leaf.id)) &&
                        activeParents(leaf) && !selected.includes(leaf.id)) {
                        issues.push(`${prefix}.${emotion}: missing fixed component ${leaf.name} (${leaf.id}) in the active expression branch.`);
                    }
                }
                for (const group of info.groups) {
                    const node = info.byId.get(group.id)!;
                    const branches = group.options.filter(option => selected.some(id => info.under(id, option)));
                    if (branches.length > 1) issues.push(`${prefix}.${emotion}: conflicting alternatives in ${node.name} (${group.id}): ${branches.join(', ')}. Choose one branch, retaining its required component leaves.`);
                    const active = activeParents(node);
                    if (group.required && active && !branches.length && (!node.hidden || selected.some(id => info.under(id, group.id)))) issues.push(`${prefix}.${emotion}: missing required part ${node.name} (${group.id}). Select one of ${group.options.join(', ')}.`);
                }
            }
        }
    }
    return [...new Set(issues)];
}

export function resolveCharacterLayers(character: PsdCharacter, config: Record<string, string[]>, emotion: string) {
    const info = inspectStructure(character.structure, character.rules);
    const paths = (ids: string[]) => [...new Set(ids)].map(id => info.byId.get(id)!.path);
    const mouthIds = [...(config.mouthOpen || []), ...(config.mouthClosed || [])];
    const mouthParents = new Set(mouthIds.flatMap(id => {
        const node = info.byId.get(id);
        return node ? [node, ...info.ancestors(node)].filter(item => part(item.name) === 'mouth').map(item => item.id) : [];
    }));
    const layers = [...info.base, ...config[emotion]].filter(id => ![...mouthParents].some(parent => info.under(id, parent)));
    return { tachieLayers: paths(layers), mouthOpenLayers: paths(config.mouthOpen || []), mouthClosedLayers: paths(config.mouthClosed || []) };
}
