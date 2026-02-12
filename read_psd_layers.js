const { readPsd } = require('ag-psd');
const fs = require('fs');

const psdPath = process.argv[2];
if (!psdPath) {
    console.error('Please provide a PSD path');
    process.exit(1);
}

const buffer = fs.readFileSync(psdPath);
const psd = readPsd(buffer, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });

function dump(layers, depth = 0) {
    layers.forEach(l => {
        console.log('  '.repeat(depth) + l.name + (l.children ? ' [FOLDER]' : ''));
        if (l.children) dump(l.children, depth + 1);
    });
}

if (psd.children) {
    dump(psd.children);
}
