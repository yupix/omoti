import { loadFontFromInfo } from '@remotion/google-fonts/from-info';
import type { Clip } from '../types';
import { getInfo as NotoSansJP } from '@remotion/google-fonts/NotoSansJP';
import { getInfo as NotoSerifJP } from '@remotion/google-fonts/NotoSerifJP';
import { getInfo as ZenKakuGothicNew } from '@remotion/google-fonts/ZenKakuGothicNew';
import { getInfo as MPLUS1p } from '@remotion/google-fonts/MPLUS1p';
import { getInfo as KaiseiTokumin } from '@remotion/google-fonts/KaiseiTokumin';
import { getInfo as Inter } from '@remotion/google-fonts/Inter';
import { getInfo as Roboto } from '@remotion/google-fonts/Roboto';
import { getInfo as Montserrat } from '@remotion/google-fonts/Montserrat';
import { getInfo as PlayfairDisplay } from '@remotion/google-fonts/PlayfairDisplay';
import { getInfo as Oswald } from '@remotion/google-fonts/Oswald';
import { getInfo as BebasNeue } from '@remotion/google-fonts/BebasNeue';
import { getInfo as PermanentMarker } from '@remotion/google-fonts/PermanentMarker';

const fonts = [NotoSansJP(), NotoSerifJP(), ZenKakuGothicNew(), MPLUS1p(), KaiseiTokumin(),
    Inter(), Roboto(), Montserrat(), PlayfairDisplay(), Oswald(), BebasNeue(), PermanentMarker()];
// Keep the Latin weights/subsets previously loaded by ResultVideo unchanged.
const latinWeights: Record<string, string[]> = {
    Inter: ['400', '600', '700'], Roboto: ['400', '700'], Montserrat: ['400', '700'],
    'Playfair Display': ['400', '700'], Oswald: ['400', '700'],
    'Bebas Neue': ['400'], 'Permanent Marker': ['400'],
};

// Google Fonts describes the characters in each file. Avoid downloading CJK
// files for glyphs the clip never uses; unknown content keeps every subset.
function neededSubsets(info: typeof fonts[number], subsets: string[], text?: string) {
    if (text === undefined) return subsets;
    const points = [...new Set(Array.from(text, char => char.codePointAt(0)!))];
    const ranges = info.unicodeRanges as Record<string, string>;
    return subsets.filter(subset => !ranges[subset] || ranges[subset].split(',').some(range => {
        const [start, end = start] = range.trim().replace(/^U\+/i, '').split('-');
        const low = parseInt(start.replace(/\?/g, '0'), 16);
        const high = parseInt(end.replace(/\?/g, 'f'), 16);
        return points.some(point => point >= low && point <= high);
    }));
}

export function getClipFontRequests(clip: Clip) {
    const requests = new Map<string, { info: typeof fonts[number]; style: string; weights: string[]; subsets: string[] }>();
    const add = (family: React.CSSProperties['fontFamily'], weight: React.CSSProperties['fontWeight'], style: React.CSSProperties['fontStyle'], text?: string) => {
        for (const name of (typeof family === 'string' ? family : '').split(',').map(name => name.trim().replace(/^['"]|['"]$/g, ''))) {
            const info = fonts.find(font => font.fontFamily.toLowerCase() === name.toLowerCase());
            if (!info) continue;
            const variants = info.fonts as Record<string, Record<string, Record<string, string>>>;
            const fontStyle = style === 'italic' && variants.italic && !latinWeights[info.fontFamily] ? 'italic' : 'normal';
            const available = latinWeights[info.fontFamily] || Object.keys(variants[fontStyle]);
            const requested = weight === 'bold' ? '700' : weight === 'normal' ? '400' : String(weight || 400);
            // Let CSS retain its existing fallback when an exact weight is unavailable.
            const weights = available.includes(requested) ? [requested] : available;
            const subsets = neededSubsets(info, latinWeights[info.fontFamily] ? ['latin'] : Object.keys(variants[fontStyle][weights[0]]), text);
            const key = `${info.fontFamily}:${fontStyle}:${weights.join(',')}`;
            requests.set(key, { info, style: fontStyle, weights, subsets });
        }
    };
    add(clip.style?.fontFamily, clip.style?.fontWeight ?? (clip.type === 'text' ? 800 : 400), clip.style?.fontStyle, clip.type === 'text' ? clip.content : undefined);
    if (clip.type === 'code') add('Inter', clip.style?.fontWeight, undefined, clip.title);
    if (clip.type === 'flow') {
        for (const node of clip.nodes || []) add(node.style?.fontFamily, node.style?.fontWeight, node.style?.fontStyle);
    }
    return [...requests.values()];
}

export async function loadClipFonts(clip: Clip): Promise<void> {
    await Promise.all(getClipFontRequests(clip).map(({ info, style, weights, subsets }) =>
        loadFontFromInfo(info, style, { weights, subsets }).waitUntilDone()));
}
