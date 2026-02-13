/**
 * External store for editor frame - updates don't trigger Editor re-renders.
 * Use useEditorFrame() in components that need the current frame.
 */
let frame = 0;
const listeners = new Set<() => void>();

export function subscribe(callback: () => void) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

export function getSnapshot() {
    return frame;
}

export function getServerSnapshot() {
    return 0;
}

export function setFrame(f: number) {
    if (frame !== f) {
        frame = f;
        listeners.forEach((cb) => cb());
    }
}
