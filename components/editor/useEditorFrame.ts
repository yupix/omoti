import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, getServerSnapshot } from './editorFrameStore';

export function useEditorFrame() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
