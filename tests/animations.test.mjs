import assert from 'node:assert/strict';
import test from 'node:test';
import { getFadeOpacity, interpolateKeyframes } from '../remotion/animations.ts';

test('fade duration longer than or equal to a clip stays finite and visible', () => {
    for (const animationDuration of [500, 399, 398, 199.5]) {
        for (let frame = 0; frame <= 399; frame++) {
            const opacity = getFadeOpacity(frame, 399, animationDuration);
            assert.ok(Number.isFinite(opacity) && opacity >= 0 && opacity <= 1);
        }
        assert.equal(getFadeOpacity(0, 399, animationDuration), 0);
        assert.equal(getFadeOpacity(199.5, 399, animationDuration), 1);
        assert.equal(getFadeOpacity(399, 399, animationDuration), 0);
    }
});

test('normal fades retain their timing and clamp outside the clip', () => {
    for (const [frame, expected] of [[-1, 0], [0, 0], [5, 0.5], [10, 1], [60, 1], [110, 1], [115, 0.5], [120, 0], [121, 0]]) {
        assert.equal(getFadeOpacity(frame, 120, 10), expected);
    }
    assert.equal(getFadeOpacity(15, 120), 1);
});

test('very short clips have valid fades and a one-frame clip remains visible', () => {
    assert.equal(getFadeOpacity(0, 1, 500), 1);
    for (const duration of [2, 3, 4]) {
        for (let frame = 0; frame < duration; frame++) {
            const opacity = getFadeOpacity(frame, duration, 500);
            assert.ok(Number.isFinite(opacity) && opacity >= 0 && opacity <= 1);
        }
        assert.ok(getFadeOpacity(1, duration, 500) > 0);
    }
});

test('invalid fade durations cannot produce empty or reversed interpolation ranges', () => {
    for (const animationDuration of [0, -10, NaN, Infinity, -Infinity]) {
        for (let frame = 0; frame <= 30; frame++) {
            const opacity = getFadeOpacity(frame, 30, animationDuration);
            assert.ok(Number.isFinite(opacity) && opacity >= 0 && opacity <= 1);
        }
        assert.equal(getFadeOpacity(15, 30, animationDuration), 1);
    }
});


test('keyframes preserve values and easing through forward and backward seeks', () => {
    assert.equal(interpolateKeyframes(undefined, 5, 42), 42);
    assert.equal(interpolateKeyframes([], 5, 42), 42);
    assert.equal(interpolateKeyframes([{ frame: 4, value: 9 }], -2, 0), 9);
    const frames = [{ frame: 20, value: 100 }, { frame: 0, value: 0 }, { frame: 10, value: 20 }];
    const original = structuredClone(frames);
    for (const [frame, expected] of [[-1, 0], [0, 0], [5, 10], [10, 20], [15, 60], [20, 100], [21, 100], [5, 10]]) {
        assert.equal(interpolateKeyframes(frames, frame, -1), expected);
    }
    assert.deepEqual(frames, original);
    for (const easing of ['ease-in', 'ease-out', 'ease-in-out']) {
        const eased = [{ frame: 0, value: 0, easing }, { frame: 20, value: 100 }];
        const quarter = interpolateKeyframes(eased, 5, 0);
        assert.ok(quarter >= 0 && quarter <= 100);
        assert.ok(easing === 'ease-out' ? quarter > 25 : quarter < 25);
        assert.equal(interpolateKeyframes(eased, 20, 0), 100);
    }
});

test('edited arrays and undo update cached interpolation without changing the original', () => {
    const original = [{ frame: 20, value: 100 }, { frame: 0, value: 0 }];
    assert.equal(interpolateKeyframes(original, 10, 0), 50);
    const edited = [{ frame: 40, value: 200 }, original[1]];
    assert.equal(interpolateKeyframes(edited, 20, 0), 100);
    const added = [...edited, { frame: 10, value: 100 }];
    assert.equal(interpolateKeyframes(added, 10, 0), 100);
    assert.equal(interpolateKeyframes(original, 10, 0), 50);
});
