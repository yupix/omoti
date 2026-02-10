'use client';

import React from 'react';
import { ReactFlow, Edge, Node, ReactFlowProvider, Background } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Clip } from '../types';

interface FlowRendererProps {
    clip: Clip;
}

const FlowContent: React.FC<{ clip: Clip }> = ({ clip }) => {
    const nodes: Node[] = clip.nodes || [
        { id: '1', data: { label: 'Node 1' }, position: { x: 50, y: 50 } },
        { id: '2', data: { label: 'Node 2' }, position: { x: 200, y: 150 } },
    ];
    const edges: Edge[] = clip.edges || [
        { id: 'e1-2', source: '1', target: '2' },
    ];

    return (
        <div style={{ width: '100%', height: '100%', backgroundColor: '#1a1a1a', borderRadius: '8px', overflow: 'hidden' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                // Disable interactions for rendering
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                zoomOnScroll={false}
                zoomOnDoubleClick={false}
                panOnDrag={false}
                proOptions={{ hideAttribution: true }}
                colorMode="dark"
            >
                <Background color="#333" gap={20} />
            </ReactFlow>
        </div>
    );
};

export const FlowRenderer: React.FC<FlowRendererProps> = ({ clip }) => {
    return (
        <ReactFlowProvider>
            <FlowContent clip={clip} />
        </ReactFlowProvider>
    );
};
