import type { EditorProject } from './ai-edit';

export function recordHistory(states: EditorProject[], index: number, ...snapshots: EditorProject[]) {
    const next = states.slice(0, index + 1);
    for (const snapshot of snapshots) {
        if (JSON.stringify(next.at(-1)) !== JSON.stringify(snapshot)) next.push(snapshot);
    }
    const limited = next.slice(-50);
    return { states: limited, index: limited.length - 1 };
}
