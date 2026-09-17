import { z } from 'zod';
import type { Clip } from '../types';

export const MAX_LAYOUT_REPAIRS = 3;
export const SUBTITLE_TOP = 560;


type Rect = { x: number; y: number; width: number; height: number };
type SceneLayoutInput = {
    codeBlocks?: { code: string }[];
    codeContent?: string;
    previewContent?: string;
    previewLayout?: string;
    position?: string;
};

// Shared by validation and clip creation so the AI is checked against the boxes
// that will actually be rendered, including the application-generated panels.
export function getSceneLayout(scene: SceneLayoutInput, hasTachie = false) {
    const blocks = scene.codeBlocks || (scene.codeContent ? [{ code: scene.codeContent }] : []);
    const hasPanels = blocks.length > 0 || !!scene.previewContent;
    const character: Rect | undefined = hasTachie ? {
        x: scene.position === 'right' ? 880 : scene.position === 'center' && !hasPanels ? 460 : 40,
        y: 120, width: 360, height: 420,
    } : undefined;
    const content: Rect = { x: hasTachie && scene.position !== 'right' ? 440 : 40, y: 120, width: hasTachie ? 800 : 1200, height: 420 };
    const split = blocks.length > 0 && !!scene.previewContent && scene.previewLayout !== 'overlay';
    const codeWidth = split ? Math.floor((content.width - 24) * 0.6) : content.width;
    const blockHeight = (content.height - Math.max(0, blocks.length - 1) * 16) / Math.max(1, blocks.length);
    const code = blocks.map((_, index) => ({ ...content, width: codeWidth, y: content.y + index * (blockHeight + 16), height: blockHeight }));
    const preview = scene.previewContent ? {
        ...content, x: split ? content.x + codeWidth + 24 : content.x,
        width: split ? content.width - codeWidth - 24 : content.width,
    } : undefined;
    return { character, code, preview };
}

const keyframeSchema = z.object({ frame: z.number().nonnegative(), value: z.number() });
const overlaySchema = z.object({
    type: z.enum(['shape', 'icon', 'text', 'image']).optional(),
    content: z.string().min(1),
    x: z.number().default(100),
    y: z.number().default(100),
    width: z.number().positive().default(200),
    height: z.number().positive().default(200),
    keyframes: z.record(z.string(), z.array(keyframeSchema)).optional(),
}).passthrough();
const scriptSchema = z.object({
    title: z.string().trim().min(1),
    scenes: z.array(z.object({
        text: z.string().trim().min(1),
        action: z.enum(['intro', 'explain', 'code', 'summary', 'outro']),
        overlays: z.array(overlaySchema).optional(),
        codeBlocks: z.array(z.object({ code: z.string().trim().min(1) }).passthrough()).max(2).optional(),
        codeContent: z.string().optional(),
        previewContent: z.string().optional(),
        previewLayout: z.string().optional(),
        position: z.string().optional(),
        keyframes: z.record(z.string(), z.array(keyframeSchema)).optional(),
    }).passthrough()).min(1),
});

export function getScriptIssues(value: unknown, hasTachie = false): string[] {
    const parsed = scriptSchema.safeParse(value);
    if (!parsed.success) return parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
    const issues: string[] = [];
    parsed.data.scenes.forEach((scene, sceneIndex) => {
        const layout = getSceneLayout(scene, hasTachie);
        if (layout.character && scene.keyframes && Object.keys(scene.keyframes).some(key => key !== 'opacity')) {
            issues.push(`scenes[${sceneIndex}].keyframes: keep the character in its reserved panel. Only opacity keyframes are allowed for the character; move decorative motion to overlays.`);
        }
        const panels = [
            ...layout.code.map((box, index) => ({ ...box, name: `codeBlocks[${index}]` })),
            ...(layout.preview ? [{ ...layout.preview, name: 'preview' }] : []),
            ...(layout.character ? [{ ...layout.character, name: 'character' }] : []),
        ];
        const blocks = scene.codeBlocks || (scene.codeContent ? [{ code: scene.codeContent }] : []);
        blocks.forEach((block, index) => {
            const box = layout.code[index];
            const columns = Math.max(1, Math.floor((box.width - 40) / 12));
            const rows = block.code.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil([...line].reduce((width, char) => width + (char.charCodeAt(0) > 255 ? 2 : char === '\t' ? 4 : 1), 0) / columns)), 0);
            if (rows * 30 > box.height - 76) issues.push(`scenes[${sceneIndex}].codeBlocks[${index}]: code exceeds the readable panel capacity. Shorten the example or divide it into more scenes.`);
        });
        const textBoxes: { index: number; left: number; top: number; right: number; bottom: number }[] = [];
        (scene.overlays || []).forEach((overlay, index) => {
            const values = (key: 'x' | 'y' | 'width' | 'height') => [overlay[key], ...(overlay.keyframes?.[key] || []).map(k => k.value)];
            const left = Math.min(...values('x'));
            const top = Math.min(...values('y'));
            const right = Math.max(...values('x')) + Math.max(...values('width'));
            const bottom = Math.max(...values('y')) + Math.max(...values('height'));
            const path = `scenes[${sceneIndex}].overlays[${index}]`;
            if (Object.keys(overlay.keyframes || {}).some(key => ['scale', 'z', 'perspective', 'rotate', 'skewX', 'skewY'].includes(key))) {
                issues.push(`${path}: use x/y/opacity keyframes instead of rotation, scale or perspective so the occupied area can be validated.`);
            }
            if (left < 0 || top < 0 || right > 1280 || bottom > SUBTITLE_TOP ||
                Math.min(...values('width')) <= 0 || Math.min(...values('height')) <= 0) {
                issues.push(`${path}: keep the entire overlay inside x=0..1280, y=0..${SUBTITLE_TOP}; the bottom area is reserved for subtitles, including during keyframe motion.`);
            }
            if (!(overlay.type === 'shape' && overlay.layer === 'background')) {
                for (const box of panels) {
                    if (left < box.x + box.width && box.x < right && top < box.y + box.height && box.y < bottom) {
                        issues.push(`${path}: overlaps the ${box.name} panel at x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}. Move the overlay outside this reserved area; place headings in y=24..96.`);
                    }
                }
            }
            if (overlay.type === 'text') {
                const effects = Array.isArray(overlay.effects) ? overlay.effects : [];
                if (effects.some(effect => ['outline', 'glow', 'blur', 'blur-complex'].includes(effect.type))) {
                    issues.push(`${path}: use plain readable text without outline, glow or blur effects.`);
                }
                const capacity = Math.floor(Math.min(...values('width')) / 20) * Math.floor(Math.min(...values('height')) / 26);
                if ([...overlay.content].length > capacity) {
                    issues.push(`${path}: the label is too long for a readable font. Shorten it or enlarge its text box (minimum readable font size: 20px).`);
                }
                textBoxes.push({ index, left, top, right, bottom });
            }
        });
        for (let i = 0; i < textBoxes.length; i++) {
            const a = textBoxes[i];
            for (const b of textBoxes.slice(i + 1)) {
                if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
                    issues.push(`scenes[${sceneIndex}].overlays[${a.index}] and overlays[${b.index}]: text boxes overlap. Move or resize them so the text boxes do not intersect.`);
                }
            }
        }
    });
    return issues;
}

// Conservative 32-grapheme lines leave room for wide Japanese glyphs at 30px.
// Caption timing is proportional to text length; it is not word-level alignment.
export function splitSubtitlePages(text: string): string[] {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
    const graphemes = [...segmenter.segment(text.trim().replace(/\r\n?/g, '\n'))].map(part => part.segment);
    const lines: string[] = [];
    let line = '';
    let count = 0;
    for (const grapheme of graphemes) {
        if (grapheme === '\n' || count === 32) {
            const word = /[A-Za-z0-9_]/.test(grapheme) ? line.match(/[A-Za-z0-9_]+$/)?.[0] : undefined;
            let carry = word && word.length < count ? word : '';
            if (!carry && /[、。，．！？）」』】]/.test(grapheme)) carry = [...segmenter.segment(line)].at(-1)?.segment || '';
            if (grapheme === '\n') carry = '';
            lines.push(carry ? line.slice(0, -carry.length) : line);
            line = carry;
            count = [...segmenter.segment(carry)].length;
            if (grapheme === '\n') continue;
        }
        line += grapheme;
        count++;
    }
    if (line) lines.push(line);
    const pages: string[] = [];
    for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2).join('\n'));
    return pages;
}

export function createSubtitleClips(text: string, startFrame: number, frames: number, sceneIndex: number): Clip[] {
    const pages = splitSubtitlePages(text);
    if (!pages.length || frames < pages.length) throw new Error('Not enough frames for subtitle pages');
    const weights = pages.map(page => [...page].length);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let weight = 0;
    let offset = 0;
    return pages.map((content, index) => {
        weight += weights[index];
        const end = Math.max(offset + 1, Math.min(frames - (pages.length - index - 1), Math.round(frames * weight / totalWeight)));
        const clip: Clip = {
            id: `sub-${sceneIndex}-${index}`, type: 'text', trackId: 1,
            startFrame: startFrame + offset, durationInFrames: end - offset,
            content, title: 'Subtitle',
            x: 80, y: SUBTITLE_TOP + 10, width: 1120, height: 120,
            style: {
                color: '#ffffff', fontSize: '30px', fontFamily: 'Noto Sans JP', fontWeight: 600,
                lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '12px', padding: '12px 20px',
                textAlign: 'center', textShadow: 'none',
            },
            animation: { type: 'none', duration: 0 },
        };
        offset = end;
        return clip;
    });
}
