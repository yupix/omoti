export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
export const UPLOAD_IDLE_TIMEOUT_MS = 120_000;

export type UploadProgress = {
    loaded: number;
    total: number;
    phase: 'uploading' | 'saving' | 'processing';
};

export function uploadFile(file: File, onProgress: (progress: UploadProgress) => void, signal: AbortSignal): Promise<{ name: string; url: string }> {
    if (signal.aborted) return Promise.reject(new DOMException('Upload cancelled', 'AbortError'));
    if (file.size === 0) return Promise.reject(new Error('The file is empty.'));
    if (file.size > MAX_UPLOAD_BYTES) return Promise.reject(new Error('Files must be 1 GiB or smaller.'));
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let idleTimer: ReturnType<typeof setTimeout>;
        let stalled = false;
        const cancel = () => xhr.abort();
        const cleanup = () => {
            clearTimeout(idleTimer);
            signal.removeEventListener('abort', cancel);
        };
        const resetTimer = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                stalled = true;
                xhr.abort();
            }, UPLOAD_IDLE_TIMEOUT_MS);
        };
        xhr.upload.onprogress = event => {
            resetTimer();
            onProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : file.size, phase: 'uploading' });
        };
        xhr.upload.onload = () => {
            resetTimer();
            onProgress({ loaded: file.size, total: file.size, phase: 'saving' });
        };
        xhr.onload = () => {
            cleanup();
            const data = xhr.response;
            if (xhr.status < 200 || xhr.status >= 300) reject(new Error(data?.error || `Upload failed (HTTP ${xhr.status})`));
            else if (typeof data?.url !== 'string' || typeof data?.name !== 'string') reject(new Error('Invalid upload response.'));
            else resolve(data);
        };
        xhr.onerror = () => { cleanup(); reject(new Error('Upload connection failed. Check the connection and try again.')); };
        xhr.onabort = () => {
            cleanup();
            reject(stalled ? new Error('Upload made no progress for 2 minutes. Check the connection and try again.') : new DOMException('Upload cancelled', 'AbortError'));
        };
        try {
            xhr.open('POST', '/api/upload');
            xhr.responseType = 'json';
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
            signal.addEventListener('abort', cancel, { once: true });
            onProgress({ loaded: 0, total: file.size, phase: 'uploading' });
            signal.throwIfAborted();
            resetTimer();
            xhr.send(file);
        } catch (error) {
            cleanup();
            reject(error);
        }
    });
}

// PSD dimensions are in the fixed 26-byte header; no full-file download/decoding.
export async function readPsdDimensions(file: Blob): Promise<{ width: number; height: number }> {
    const header = await file.slice(0, 26).arrayBuffer();
    if (header.byteLength !== 26) throw new Error('Invalid PSD header.');
    const view = new DataView(header);
    if (view.getUint32(0) !== 0x38425053 || view.getUint16(4) !== 1) throw new Error('Invalid PSD file.');
    const height = view.getUint32(14);
    const width = view.getUint32(18);
    if (width < 1 || height < 1 || width > 30_000 || height > 30_000) throw new Error('Invalid PSD dimensions.');
    return { width, height };
}
