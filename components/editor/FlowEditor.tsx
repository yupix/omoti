'use client';

import React, { useCallback, useMemo } from 'react';
import {
    ReactFlow,
    addEdge,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    Connection,
    Edge,
    Node,
    ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface FlowEditorProps {
    initialNodes: Node[];
    initialEdges: Edge[];
    onUpdate: (nodes: Node[], edges: Edge[]) => void;
}

const FlowEditorComponent: React.FC<FlowEditorProps> = ({ initialNodes, initialEdges, onUpdate }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Sync from props if changed externally (e.g. undo/redo)
    React.useEffect(() => {
        // Deep compare/check if really needed to avoid reset loops?
        // But for now simple sync.
        if (JSON.stringify(nodes) !== JSON.stringify(initialNodes)) {
            setNodes(initialNodes);
        }
        if (JSON.stringify(edges) !== JSON.stringify(initialEdges)) {
            setEdges(initialEdges);
        }
    }, [initialNodes, initialEdges, setNodes, setEdges]); // Watch out for JSON.stringify in deps, but here we want to avoid loops.

    const onConnect = useCallback(
        (params: Connection) => {
            setEdges((eds) => {
                const newEdges = addEdge(params, eds);
                onUpdate(nodes, newEdges);
                return newEdges;
            });
        },
        [nodes, onUpdate, setEdges]
    );

    const addNode = () => {
        const newNode: Node = {
            id: Math.random().toString(36).substr(2, 9),
            data: { label: 'New Node' },
            position: { x: 100, y: 100 },
        };
        const newNodes = [...nodes, newNode];
        setNodes(newNodes);
        onUpdate(newNodes, edges);
    };

    return (
        <div className="flex flex-col gap-2 h-full">
            <div className="flex justify-between items-center px-1">
                <button
                    onClick={addNode}
                    className="text-[10px] bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90 transition-colors"
                >
                    + Add Node
                </button>
                <span className="text-[9px] text-muted-foreground uppercase">Nodes: {nodes.length} • Edges: {edges.length}</span>
            </div>
            <div style={{ width: '100%', height: '300px', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden' }} className="bg-zinc-950">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeDragStop={() => onUpdate(nodes, edges)}
                    onNodesDelete={() => onUpdate(nodes, edges)}
                    onEdgesDelete={() => onUpdate(nodes, edges)}
                    fitView
                    colorMode="dark"
                >
                    <Background color="#222" gap={20} />
                    <Controls />
                </ReactFlow>
            </div>
        </div>
    );
};

export const FlowEditor: React.FC<FlowEditorProps> = (props) => {
    return (
        <ReactFlowProvider>
            <FlowEditorComponent {...props} />
        </ReactFlowProvider>
    );
};
