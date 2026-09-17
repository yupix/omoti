import { z } from 'zod';
import type { Clip, Track } from '../types';
import { getTimelineIssues } from './generated-timeline';

export const MAX_EDIT_CLIPS = 1000;
export const MAX_EDIT_REQUEST_CHARS = 2_000_000;
export type EditorProject = { clips: Clip[]; tracks: Track[]; primaryColor: string };
const frame = z.number().int().min(0).max(10_000_000);
const trackId = z.number().int().min(1).max(100_000);
const id = z.string().min(1).max(200);
const clipType = z.enum(['text', 'image', 'video', 'audio', 'shape', 'code', 'tachie', 'flow', 'browser', 'icon']);
const safeCss = z.string().max(200).refine(value => !/url\s*\(|expression\s*\(/i.test(value), 'External CSS resources are not allowed');
const pixels = z.union([z.number().min(0).max(1280), z.string().regex(/^\d+(?:\.\d+)?px$/)]);
const styleSchema = z.object({
    color: safeCss, backgroundColor: safeCss, background: safeCss,
    fontFamily: z.string().max(100), fontSize: pixels,
    fontWeight: z.union([z.number().min(100).max(900), z.enum(['normal', 'bold'])]),
    textAlign: z.enum(['left', 'center', 'right', 'justify']),
    lineHeight: z.number().min(0.5).max(3), opacity: z.number().min(0).max(1),
    borderRadius: pixels, padding: pixels, borderColor: safeCss,
    borderWidth: pixels, borderStyle: z.enum(['none', 'solid', 'dashed', 'dotted']), textShadow: safeCss,
}).partial();
const nullableStyle = z.object(Object.fromEntries(Object.entries(styleSchema.shape).map(([key, value]) => [key, value.nullable()]))).strict();
const animation = z.object({
    type: z.enum(['fade', 'pop', 'slide', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'spin', 'shake', 'bounce', 'none']),
    duration: frame,
}).strict();
const keyframes = z.partialRecord(z.enum(['x', 'y', 'width', 'height', 'rotate', 'opacity', 'scale', 'blur', 'brightness', 'contrast', 'saturate', 'grayscale', 'hueRotate', 'invert', 'skewX', 'skewY', 'z', 'perspective']), z.array(z.object({ frame, value: z.number(), easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out']).optional() }).strict()).max(500).nullable());
const effects = z.array(z.object({
    type: z.enum(['glow', 'outline', 'shadow', 'blur', 'sepia', 'grayscale', 'pulse', 'float', 'hue-rotate', 'brightness', 'contrast', 'invert', 'saturate', 'drop-shadow', 'blur-complex']),
    color: safeCss.optional(), width: z.number().min(0).max(100).optional(), blur: z.number().min(0).max(100).optional(),
    opacity: z.number().min(0).max(1).optional(), intensity: z.number().min(0).max(10).optional(), x: z.number().optional(), y: z.number().optional(),
}).strict()).max(20);
export const editPatchSchema = z.object({
    content: z.string().max(50_000).optional(), title: z.string().max(200).optional(),
    startFrame: frame.optional(), durationInFrames: frame.min(1).optional(), trackId: trackId.optional(),
    x: z.number().min(-1280).max(1280).optional(), y: z.number().min(-720).max(720).optional(),
    width: z.number().positive().max(1280).optional(), height: z.number().positive().max(720).optional(),
    rotate: z.number().min(-360).max(360).optional(), mirror: z.boolean().optional(),
    volume: z.number().min(0).max(1).optional(), playbackRate: z.number().min(0.1).max(4).optional(), mediaStartOffset: frame.optional(),
    style: nullableStyle.optional(), animation: animation.nullable().optional(),
    keyframes: keyframes.nullable().optional(), effects: effects.nullable().optional(),
    language: z.string().min(1).max(100).optional(),
    steps: z.array(z.object({ code: z.string().max(50_000), frameOffset: frame }).strict()).max(200).nullable().optional(),
}).strict().refine(patch => Object.keys(patch).length > 0, 'The patch is empty');

// Preserve fields the editor already owns (PSD selections, audio links, flow
// nodes, crop, etc.). AI output is a strict patch, never a replacement project.
export const editorProjectSchema = z.object({
    clips: z.array(z.object({ id, type: clipType, trackId, startFrame: frame, durationInFrames: frame.min(1), content: z.string(),
        x: z.number().optional(), y: z.number().optional(), width: z.number().positive().optional(), height: z.number().positive().optional(),
    }).passthrough()).max(MAX_EDIT_CLIPS),
    tracks: z.array(z.object({ id: trackId, name: z.string().max(200) }).strict()).max(MAX_EDIT_CLIPS),
    primaryColor: z.string().max(100),
}).strict().superRefine((project, ctx) => {
    if (new Set(project.clips.map(clip => clip.id)).size !== project.clips.length) ctx.addIssue({ code: 'custom', message: 'Duplicate clip IDs' });
    const ids = new Set(project.tracks.map(track => track.id));
    if (ids.size !== project.tracks.length || project.clips.some(clip => !ids.has(clip.trackId))) ctx.addIssue({ code: 'custom', message: 'Invalid project tracks' });
});
const additionSchema = z.object({
    id, type: z.enum(['text', 'shape', 'icon', 'code']), content: z.string().min(1).max(50_000),
    title: z.string().max(200).optional(), trackId, startFrame: frame, durationInFrames: frame.min(1),
    x: z.number().min(0).max(1280), y: z.number().min(0).max(720),
    width: z.number().positive().max(1280), height: z.number().positive().max(720),
    style: styleSchema.strict().optional(), animation: animation.optional(), language: z.string().max(100).optional(),
}).strict();
export const editPlanSchema = z.object({
    summary: z.string().trim().min(1).max(2000),
    operations: z.array(z.discriminatedUnion('type', [
        z.object({ type: z.literal('update'), clipId: id, patch: editPatchSchema, reason: z.string().min(1).max(500) }).strict(),
        z.object({ type: z.literal('delete'), clipId: id, reason: z.string().min(1).max(500) }).strict(),
        z.object({ type: z.literal('add'), clip: additionSchema, reason: z.string().min(1).max(500) }).strict(),
    ])).min(1).max(MAX_EDIT_CLIPS),
}).strict();
export type EditPlan = z.infer<typeof editPlanSchema>;
export class EditValidationError extends Error {
    issues: string[];
    constructor(issues: string[]) { super(issues.join('\n')); this.issues = issues; }
}

function mergeFields(original: object | undefined, patch: Record<string, unknown>) {
    const result: Record<string, unknown> = { ...original };
    for (const [key, value] of Object.entries(patch)) {
        if (value === null) delete result[key]; else result[key] = value;
    }
    return result;
}

function box(clip: Clip) {
    const positioned = [clip.x, clip.y, clip.width, clip.height].some(value => typeof value === 'number');
    const xs = [clip.x || 0, ...(clip.keyframes?.x || []).map(key => key.value)];
    const ys = [clip.y || 0, ...(clip.keyframes?.y || []).map(key => key.value)];
    return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs) + (clip.width || (positioned ? 400 : 1280)), bottom: Math.max(...ys) + (clip.height || (positioned ? 400 : 720)) };
}

export function applyEditPlan(project: EditorProject, value: unknown, selectedIds?: string[]): EditorProject {
    const parsed = editPlanSchema.safeParse(value);
    if (!parsed.success) throw new EditValidationError(parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`));
    const plan = parsed.data;
    const original = new Map(project.clips.map(clip => [clip.id, clip]));
    const result = new Map(original);
    const touched = new Set<string>();
    const issues: string[] = [];
    if (selectedIds && (!selectedIds.length || selectedIds.some(id => !original.has(id)))) throw new EditValidationError(['The selected clip no longer exists.']);
    for (const operation of plan.operations) {
        const id = operation.type === 'add' ? operation.clip.id : operation.clipId;
        if (touched.has(id)) { issues.push(`${id}: use one operation per clip.`); continue; }
        touched.add(id);
        if (selectedIds && (operation.type === 'add' || !selectedIds.includes(id))) { issues.push(`${id}: outside the selected editing scope.`); continue; }
        if (operation.type === 'add') {
            if (original.has(id)) issues.push(`${id}: the new ID already exists.`);
            else result.set(id, operation.clip as Clip);
            continue;
        }
        const current = original.get(id);
        if (!current) { issues.push(`${id}: clip not found.`); continue; }
        if (operation.type === 'delete') { result.delete(id); continue; }
        const patch = operation.patch;
        if (patch.content !== undefined && !['text', 'code', 'shape', 'icon'].includes(current.type)) issues.push(`${id}: media URLs, browser content and PSD sources must be preserved.`);
        if (current.type === 'code' && current.steps?.length && patch.content !== undefined && patch.steps === undefined) issues.push(`${id}: code steps override content; update steps or set steps:null for a static code edit.`);
        const next = { ...current };
        for (const [key, value] of Object.entries(patch)) {
            if (value === null) delete (next as unknown as Record<string, unknown>)[key];
            else (next as unknown as Record<string, unknown>)[key] = key === 'style' || key === 'keyframes'
                ? mergeFields(current[key], value as Record<string, unknown>) : value;
        }
        result.set(id, next);
    }
    const clips = [...result.values()];
    if (clips.length > MAX_EDIT_CLIPS) issues.push(`The project can contain at most ${MAX_EDIT_CLIPS} clips for AI editing.`);
    issues.push(...getTimelineIssues(clips));
    for (const clip of clips.filter(clip => touched.has(clip.id))) {
        if (clip.type === 'shape' && !['rect', 'circle'].includes(clip.content)) issues.push(`${clip.id}: shape must be rect or circle.`);
        if (clip.type === 'icon' && !/^[\w-]+:[\w-]+$/.test(clip.content)) issues.push(`${clip.id}: use an icon ID such as lucide:star.`);
        if (clip.animation && clip.animation.type !== 'none' && (clip.animation.duration < 1 || clip.animation.duration > clip.durationInFrames)) issues.push(`${clip.id}: animation duration must fit the clip.`);
        for (const [key, frames] of Object.entries(clip.keyframes || {})) {
            if (frames.some((frame, i) => !Number.isFinite(frame.value) || frame.frame < 0 || (i > 0 && frame.frame <= frames[i - 1].frame))) issues.push(`${clip.id}.${key}: keyframes must have finite values and increasing frames.`);
        }
        if (clip.type === 'audio') continue;
        const rect = box(clip);
        if (rect.left < 0 || rect.top < 0 || rect.right > 1280 || rect.bottom > 720) issues.push(`${clip.id}: keep the clip and x/y keyframes inside the 1280x720 canvas.`);
        if (clip.type === 'text') {
            const positioned = [clip.x, clip.y, clip.width, clip.height].some(value => typeof value === 'number');
            const width = clip.width || (positioned ? 400 : 1280);
            const height = clip.height || (positioned ? 400 : 720);
            const lines = clip.content.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil([...line].length / Math.max(1, Math.floor(width / 20)))), 0);
            if (lines * 26 > height) issues.push(`${clip.id}: text is too long to remain readable. Shorten it or split it into consecutive text clips.`);
            for (const other of clips) {
                if (other.id === clip.id || other.type !== 'text' || clip.startFrame >= other.startFrame + other.durationInFrames || other.startFrame >= clip.startFrame + clip.durationInFrames) continue;
                const b = box(other);
                if (rect.left < b.right && b.left < rect.right && rect.top < b.bottom && b.top < rect.bottom) issues.push(`${clip.id}: text overlaps ${other.id}. Separate their boxes or display times.`);
            }
        }
    }
    if (JSON.stringify(clips) === JSON.stringify(project.clips)) issues.push('No changes were made. Return a concrete edit for the request.');
    const used = new Set(project.tracks.map(track => track.id));
    const extra = [...new Set(clips.map(clip => clip.trackId))].filter(id => !used.has(id)).sort((a, b) => a - b);
    if (project.tracks.length + extra.length > MAX_EDIT_CLIPS) issues.push(`The project can contain at most ${MAX_EDIT_CLIPS} tracks for AI editing. Reuse an existing free track.`);
    if (issues.length) throw new EditValidationError([...new Set(issues)]);
    return { ...project, clips, tracks: [...project.tracks, ...extra.map(id => ({ id, name: `AI ${id}` }))] };
}

export function sameProject(a: EditorProject, b: EditorProject) { return JSON.stringify(a) === JSON.stringify(b); }

export function getEditChanges(project: EditorProject, plan: EditPlan) {
    return plan.operations.map(operation => {
        const clip = operation.type === 'add' ? operation.clip : project.clips.find(clip => clip.id === operation.clipId)!;
        const fields = operation.type === 'update' ? Object.entries(operation.patch).flatMap<{ field: string; before: unknown; after: unknown }>(([key, value]) =>
            key === 'style' && value ? Object.entries(value).map(([style, next]) => ({ field: style, before: (clip as Clip).style?.[style as keyof React.CSSProperties], after: next }))
                : [{ field: key, before: (clip as unknown as Record<string, unknown>)[key], after: key === 'keyframes' && value ? mergeFields((clip as Clip).keyframes, value as Record<string, unknown>) : value }]) : Object.keys(clip).filter(field => field !== 'id').map(field => ({
                    field, before: operation.type === 'delete' ? (clip as unknown as Record<string, unknown>)[field] : undefined,
                    after: operation.type === 'add' ? (clip as unknown as Record<string, unknown>)[field] : undefined,
                }));
        return { type: operation.type, label: clip.title || clip.content.slice(0, 60) || clip.id, reason: operation.reason, fields };
    });
}
