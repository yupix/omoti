import { readPsd, type Psd, type Layer } from 'ag-psd';
import type { Clip } from '../types';
import { resolveAssetUrl } from '../remotion/utils';
import { indexPsdLayers } from './psd-structure';

const fullPsd = new Map<string, Promise<Psd>>();
const metadata = new Map<string, Promise<Psd>>();

// Share in-flight downloads as well as parsed PSDs across clips and settings.
export function loadPsd(url: string, baseUrl?: string, metadataOnly = false): Promise<Psd> {
    const resolved = resolveAssetUrl(url, baseUrl);
    const existing = fullPsd.get(resolved) || (metadataOnly ? metadata.get(resolved) : undefined);
    if (existing) return existing;
    const cache = metadataOnly ? metadata : fullPsd;
    const request = (async () => {
        const response = await fetch(resolved, { signal: AbortSignal.timeout(180_000) });
        if (!response.ok) throw new Error(response.status === 404
            ? 'PSDが見つかりません。素材からアップロードして参照先を選び直してください。'
            : `PSDを読み込めませんでした (HTTP ${response.status})`);
        const buffer = await response.arrayBuffer();
        return readPsd(buffer, { skipLayerImageData: metadataOnly, skipCompositeImageData: metadataOnly, skipThumbnail: true, useImageData: true });
    })();
    cache.set(resolved, request);
    request.catch(() => cache.delete(resolved));
    return request;
}

// Only materialize canvases for layers that are actually drawn.
const layerCanvases = new WeakMap<Layer, HTMLCanvasElement>();
function getCanvas(layer: Layer) {
    if (layer.canvas) return layer.canvas;
    if (!layer.imageData) return undefined;
    let canvas = layerCanvases.get(layer);
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = layer.imageData.width;
        canvas.height = layer.imageData.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;
        const data = ctx.createImageData(canvas.width, canvas.height);
        data.data.set(layer.imageData.data);
        ctx.putImageData(data, 0, 0);
        layerCanvases.set(layer, canvas);
    }
    return canvas;
}

const psdPaths = new WeakMap<Psd, Map<Layer, string>>();

export function drawPsd(ctx: CanvasRenderingContext2D, psd: Psd, clip: Pick<Clip, 'tachieLayers' | 'mandatoryLayers' | 'mouthOpenLayers' | 'mouthClosedLayers'>, mouthOpen = false) {
    let paths = psdPaths.get(psd);
    if (!paths) {
        paths = new Map(indexPsdLayers(psd).map(entry => [entry.layer, entry.node.path]));
        psdPaths.set(psd, paths);
    }
    const base = clip.tachieLayers || [];
    const mandatory = clip.mandatoryLayers || [];
    const open = clip.mouthOpenLayers || [];
    const closed = clip.mouthClosedLayers || [];
    const wanted = [...base, ...mandatory, ...(mouthOpen ? open : closed)];
    const hasSelection = base.length > 0 || open.length > 0 || closed.length > 0;
    const draw = (layers: Layer[], parent = '', inherited = false, opacity = 1) => {
        for (const layer of layers) {
            const legacyPath = parent ? `${parent}/${layer.name}` : (layer.name || 'Unnamed Layer');
            const path = paths!.get(layer)!;
            const selected = (list: string[]) => list.includes(path) || list.includes(legacyPath);
            const explicit = selected(wanted);
            let visible = explicit || ((!hasSelection || inherited) && !layer.hidden);
            if (selected(open)) visible = mouthOpen;
            else if (selected(closed)) visible = !mouthOpen;
            else if (mouthOpen && (open.length || closed.length) && selected(base) && /mouth|口/i.test(path) && !selected(mandatory) && !layer.children) visible = false;
            const alpha = opacity * (layer.opacity ?? 1);
            if (layer.children) {
                if (visible || wanted.some(item => item.startsWith(path + '/') || item.startsWith(legacyPath + '/'))) draw(layer.children, legacyPath, visible, alpha);
            } else if (visible) {
                const canvas = getCanvas(layer);
                if (canvas) {
                    ctx.globalAlpha = alpha;
                    ctx.drawImage(canvas, layer.left ?? 0, layer.top ?? 0);
                }
            }
        }
    };
    ctx.clearRect(0, 0, psd.width, psd.height);
    if (psd.children?.length) draw(psd.children);
    else {
        const canvas = getCanvas(psd);
        if (canvas) ctx.drawImage(canvas, 0, 0);
    }
    ctx.globalAlpha = 1;
}
