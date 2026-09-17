import { Easing, interpolate } from 'remotion';
import type { Keyframe } from '../types';

export function getFadeOpacity(frame: number, durationInFrames: number, animationDuration = 15): number {
    // A single-frame clip has no room for a fade; keep its only frame visible.
    if (durationInFrames <= 1) return 1;

    // Reserve room for both fades, including when an existing clip is shortened.
    const fadeDuration = Math.min(
        durationInFrames / 2,
        Number.isFinite(animationDuration) ? Math.max(1, animationDuration) : 15,
    );
    const options = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const fadeIn = interpolate(frame, [0, fadeDuration], [0, 1], options);
    const fadeOut = interpolate(frame, [durationInFrames - fadeDuration, durationInFrames], [1, 0], options);
    return fadeIn * fadeOut;
}

// Editor changes replace keyframe arrays. Weak keys release cached sorts when
// their source arrays are no longer referenced by clips or undo history.
const sortedKeyframes = new WeakMap<Keyframe[], Keyframe[]>();

export const interpolateKeyframes = (keyframes: Keyframe[] | undefined, frame: number, defaultValue: number) => {
    if (!keyframes || keyframes.length === 0) return defaultValue;
    if (keyframes.length === 1) return keyframes[0].value;

    let sorted = sortedKeyframes.get(keyframes);
    if (!sorted) {
        sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
        sortedKeyframes.set(keyframes, sorted);
    }

    if (frame <= sorted[0].frame) return sorted[0].value;
    if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].value;

    for (let i = 0; i < sorted.length - 1; i++) {
        const k1 = sorted[i];
        const k2 = sorted[i + 1];
        if (frame >= k1.frame && frame <= k2.frame) {
            let easing = Easing.linear;
            if (k1.easing === 'ease-in') easing = Easing.in(Easing.exp);
            if (k1.easing === 'ease-out') easing = Easing.out(Easing.exp);
            if (k1.easing === 'ease-in-out') easing = Easing.inOut(Easing.exp);

            return interpolate(frame, [k1.frame, k2.frame], [k1.value, k2.value], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing
            });
        }
    }
    return defaultValue;
};
