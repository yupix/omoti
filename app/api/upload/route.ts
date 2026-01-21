
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        // Clean filename to prevent traversal or weird chars
        const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueFilename = `${Date.now()}-${filename}`;

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filepath = path.join(uploadDir, uniqueFilename);
        await writeFile(filepath, buffer);

        // Return the public URL
        const url = `/uploads/${uniqueFilename}`;
        return NextResponse.json({ success: true, url, name: uniqueFilename });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');

        if (!fs.existsSync(uploadDir)) {
            return NextResponse.json({ files: [] });
        }

        const files = fs.readdirSync(uploadDir);
        // Filter likely media files
        const mediaFiles = files.filter(f => /\.(jpg|jpeg|png|gif|mp4|webm|mp3)$/i.test(f));

        const fileData = mediaFiles.map(f => ({
            name: f,
            url: `/uploads/${f}`
        }));

        return NextResponse.json({ files: fileData });

    } catch (error) {
        console.error('List files error:', error);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }
}
