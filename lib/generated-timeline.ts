import type { Clip } from '../types';

type TimedClip = Pick<Clip, 'id' | 'trackId' | 'startFrame' | 'durationInFrames'>;

export function getTimelineIssues(clips: TimedClip[]): string[] {
    const issues: string[] = [];
    const ids = new Set<string>();
    const tracks = new Map<number, TimedClip[]>();
    for (const clip of clips) {
        if (ids.has(clip.id)) issues.push(`Duplicate clip ID: ${clip.id}`);
        ids.add(clip.id);
        if (!Number.isInteger(clip.startFrame) || clip.startFrame < 0 ||
            !Number.isInteger(clip.durationInFrames) || clip.durationInFrames < 1 ||
            !Number.isInteger(clip.trackId) || clip.trackId < 1) {
            issues.push(`Invalid timing or track: ${clip.id}`);
        }
        const track = tracks.get(clip.trackId) || [];
        track.push(clip);
        tracks.set(clip.trackId, track);
    }
    for (const [id, track] of tracks) {
        const sorted = [...track].sort((a, b) => a.startFrame - b.startFrame);
        let previous: TimedClip | undefined;
        for (const clip of sorted) {
            if (previous && clip.startFrame < previous.startFrame + previous.durationInFrames) {
                issues.push(`Track ${id}: ${previous.id} overlaps ${clip.id}`);
            }
            if (!previous || clip.startFrame + clip.durationInFrames > previous.startFrame + previous.durationInFrames) previous = clip;
        }
    }
    return issues;
}

// Each input track is a visual layer. Split it into lanes without changing timing
// or placing a lower layer (especially the background) above a higher one.
export function arrangeGeneratedTracks<T extends TimedClip>(clips: T[]): T[] {
    const result = clips.map(clip => ({ ...clip }));
    const layers = new Map<number, T[]>();
    for (const clip of result) {
        const layer = layers.get(clip.trackId) || [];
        layer.push(clip);
        layers.set(clip.trackId, layer);
    }
    let nextTrack = 1;
    for (const layerId of [...layers.keys()].sort((a, b) => a - b)) {
        const lanes: T[][] = [];
        // Later input clips render in front. Preserve that order for overlapping
        // clips while reusing lanes for clips that are not shown together.
        // ponytail: quadratic per layer; use an interval index for thousands of clips.
        for (const clip of [...layers.get(layerId)!].reverse()) {
            let lane = 0;
            lanes.forEach((items, index) => {
                if (items.some(item => clip.startFrame < item.startFrame + item.durationInFrames &&
                    item.startFrame < clip.startFrame + clip.durationInFrames)) lane = index + 1;
            });
            (lanes[lane] ||= []).push(clip);
            clip.trackId = nextTrack + lane;
        }
        nextTrack += lanes.length;
    }
    return result;
}
