import { useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeTypes,
  EdgeTypes,
  NodeChange,
  ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import FamilyMemberNode, { FamilyMemberNodeData } from './FamilyMemberNode';
import SpouseEdge from './SpouseEdge';
import ChildEdge from './ChildEdge';
import { FamilyMember } from '@/types/family';
import { computeNewMemberPosition, MAX_SPOUSE_GAP, SPOUSE_GAP } from './layout';
 import { MergedProfile } from '@/hooks/useMergeMode';

interface FamilyTreeCanvasProps {
  members: Record<string, FamilyMember>;
  positions: Record<string, { x: number; y: number }>;
  onOpenProfile: (member: FamilyMember) => void;
  onPositionChange: (memberId: string, x: number, y: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  readOnly?: boolean;
  zoomEnabled?: boolean;
  panEnabled?: boolean;
   // Merge mode props
   isMergeMode?: boolean;
   mergeSelectedIds?: string[];
   mergedProfiles?: Map<string, MergedProfile>;
   onLongPress?: (memberId: string) => void;
   onToggleMergeSelect?: (memberId: string) => void;
   // Spouse lock props
   isPairLocked?: (id1: string, id2?: string) => boolean;
   initialViewport?: { x: number; y: number; zoom: number };
   onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
}

const nodeTypes = {
  familyMember: FamilyMemberNode,
} as unknown as NodeTypes;

const edgeTypes = {
  spouse: SpouseEdge,
  child: ChildEdge,
} as unknown as EdgeTypes;

const EMPTY_MAP = new Map();
const EMPTY_ARRAY: string[] = [];

export const FamilyTreeCanvas = ({
  members,
  positions,
  onOpenProfile,
  onPositionChange,
  onDragStart,
  onDragEnd,
  readOnly = false,
  zoomEnabled = true,
  panEnabled = true,
   isMergeMode = false,
   mergeSelectedIds = EMPTY_ARRAY,
   mergedProfiles = EMPTY_MAP,
   onLongPress,
   onToggleMergeSelect,
   // Spouse lock props
   isPairLocked,
   initialViewport,
   onViewportChange,
}: FamilyTreeCanvasProps) => {
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const isDraggingRef = useRef(false);
  const draggedNodeIdRef = useRef<string | null>(null);
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Handle node changes - support locked spouse pairs moving together
  const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    if (readOnly) {
      onNodesChange(changes);
      return;
    }
    // Process position changes for locked spouses
    const modifiedChanges = [...changes];
    const additionalChanges: NodeChange<Node>[] = [];
    
    changes.forEach((change) => {
      if (change.type === 'position' && change.dragging && change.position) {
        const draggedMember = members[change.id];
        
        if (draggedMember?.spouseId) {
          // Both locked and unlocked need to track start positions for delta/leash calculations
          if (!dragStartPositionsRef.current.has(change.id)) {
            const currentNode = nodes.find(n => n.id === change.id);
            const spouseNode = nodes.find(n => n.id === draggedMember?.spouseId);
            
            if (currentNode && spouseNode) {
              dragStartPositionsRef.current.set(change.id, { ...currentNode.position });
              dragStartPositionsRef.current.set(draggedMember.spouseId, { ...spouseNode.position });
              draggedNodeIdRef.current = change.id;
            }
          }
          
          const startPos = dragStartPositionsRef.current.get(change.id);
          const spouseStartPos = dragStartPositionsRef.current.get(draggedMember.spouseId);
          const isLocked = isPairLocked?.(change.id, draggedMember.spouseId);
          
          if (startPos && spouseStartPos) {
            if (isLocked) {
              // LOCKED: Maintain the same diagonal relationship, but clamp max distance
              const dx = spouseStartPos.x - startPos.x;
              const dy = spouseStartPos.y - startPos.y;
              const startDist = Math.sqrt(dx * dx + dy * dy);
              
              // If initial distance > 400, scale it down to 400 while keeping angle
              let scale = 1;
              if (startDist > MAX_SPOUSE_GAP) {
                scale = MAX_SPOUSE_GAP / startDist;
              }
              
              const finalDx = dx * scale;
              const finalDy = dy * scale;
              
              additionalChanges.push({
                type: 'position',
                id: draggedMember.spouseId,
                position: {
                  x: change.position.x + finalDx,
                  y: change.position.y + finalDy,
                },
                dragging: true,
              } as NodeChange<Node>);
            } else {
              // UNLOCKED: "Leash" effect. If dragged node moves > 400px away from spouse's CURRENT position, pull spouse.
              // We need the spouse's current position from `nodes` state since it might have been pulled already.
              const currentSpouseNode = nodes.find(n => n.id === draggedMember.spouseId);
              if (currentSpouseNode) {
                const currentSpousePos = { ...currentSpouseNode.position };
                
                const dx2 = currentSpousePos.x - change.position.x;
                const dy2 = currentSpousePos.y - change.position.y;
                const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                
                if (dist2 > MAX_SPOUSE_GAP) {
                  // Pull the spouse towards the dragged node so distance is exactly MAX_SPOUSE_GAP
                  const scale2 = MAX_SPOUSE_GAP / dist2;
                  additionalChanges.push({
                    type: 'position',
                    id: draggedMember.spouseId,
                    position: {
                      x: change.position.x + (dx2 * scale2),
                      y: change.position.y + (dy2 * scale2),
                    },
                    dragging: true,
                  } as NodeChange<Node>);
                }
              }
            }
          }
        }
      }
      
      // Handle drag start
      if (change.type === 'position') {
        if (change.dragging && !isDraggingRef.current) {
          isDraggingRef.current = true;
          onDragStart?.();
        }
        
        // Handle drag end
        if (!change.dragging && isDraggingRef.current && change.position) {
          isDraggingRef.current = false;
          
          // Save main node position
          onPositionChange(change.id, change.position.x, change.position.y);
          
          // Save spouse position if it was moved (via lock or leash)
          const draggedMember = members[change.id];
          if (draggedMember?.spouseId) {
            const spouseNode = nodes.find(n => n.id === draggedMember.spouseId);
            const startPosSpouse = dragStartPositionsRef.current.get(draggedMember.spouseId);
            
            if (spouseNode && startPosSpouse) {
              // If spouse position changed from drag start, save it
              if (spouseNode.position.x !== startPosSpouse.x || spouseNode.position.y !== startPosSpouse.y) {
                onPositionChange(draggedMember.spouseId, spouseNode.position.x, spouseNode.position.y);
              }
            }
          }
          
          // Clear drag tracking
          dragStartPositionsRef.current.clear();
          draggedNodeIdRef.current = null;
          
          onDragEnd?.();
        }
      }
    });
    
    onNodesChange([...modifiedChanges, ...additionalChanges]);
  }, [onNodesChange, onPositionChange, onDragStart, onDragEnd, members, isPairLocked, nodes, readOnly]);

  // Build edges from relationships
  const edgesMemo = useMemo(() => {
    const nextEdges: Edge[] = [];
    const processedCouples = new Set<string>();

    Object.values(members).forEach((member) => {
      // Spouse edges
      if (member.spouseId && members[member.spouseId]) {
        const coupleKey = [member.id, member.spouseId].sort().join('-');
        if (!processedCouples.has(coupleKey)) {
          processedCouples.add(coupleKey);
          const spouse = members[member.spouseId];
          const [left, right] = member.gender === 'male' ? [member, spouse] : [spouse, member];

          nextEdges.push({
            id: `spouse-${left.id}-${right.id}`,
            source: left.id,
            target: right.id,
            type: 'spouse',
          });
        }
      }

      // Child edges
      if (member.parentIds?.length) {
        const father = member.parentIds.find((pid) => members[pid]?.gender === 'male');
        const mother = member.parentIds.find((pid) => members[pid]?.gender === 'female');
        const parentId = father || member.parentIds[0];
        const spouseId = mother || (member.parentIds.length > 1 ? member.parentIds[1] : undefined);

        if (parentId && members[parentId]) {
          nextEdges.push({
            id: `child-${parentId}-${member.id}`,
            source: parentId,
            target: member.id,
            type: 'child',
            data: { spouseId },
          });
        }
      }
    });

    return nextEdges;
  }, [members]);

  // Update edges when members change
  useEffect(() => {
    setEdges(edgesMemo);
  }, [edgesMemo, setEdges]);

  // Update nodes - use cloud positions, fallback to computed
  useEffect(() => {
    setNodes((prevNodes) => {
      const prevMap = new Map(prevNodes.map((n) => [n.id, n] as const));
      const nextNodes: Node[] = [];

      for (const member of Object.values(members)) {
        const existing = prevMap.get(member.id);
        
        // Priority: 1) existing dragged position, 2) cloud position, 3) computed
        const position =
          (isDraggingRef.current && existing?.position) ||
          positions[member.id] ||
          existing?.position ||
          computeNewMemberPosition({ member, members, prevNodeMap: prevMap });

       // Get merged names - from member data (DB) + local merge state
       const mergedProfile = mergedProfiles.get(member.id);
       const dbMergedNames = member.mergedProfiles?.map(mp => mp.name) || [];
       const localMergedNames = mergedProfile?.mergedNames || [];
       const mergedNames = [...new Set([...dbMergedNames, ...localMergedNames])];
 
        nextNodes.push({
          ...(existing || {}),
          id: member.id,
          type: 'familyMember',
          position,
          data: { 
            member, 
            onOpenProfile,
            isMergeMode,
            readOnly,
            isSelected: mergeSelectedIds.includes(member.id),
            isPrimary: mergeSelectedIds[0] === member.id,
            mergedNames,
            onLongPress,
            onToggleSelect: onToggleMergeSelect,
          },
        });
      }

      return nextNodes;
    });
  }, [members, positions, onOpenProfile, setNodes, isMergeMode, mergeSelectedIds, mergedProfiles, onLongPress, onToggleMergeSelect, readOnly]);

  useEffect(() => {
    const onNavFamily = (e: Event) => {
      const ce = e as CustomEvent<{ action?: 'scrollTop' | 'refresh' }>;
      if (ce.detail?.action === 'refresh') {
        window.dispatchEvent(new Event('family-tree-reload'));
        return;
      }

      const inst = flowInstanceRef.current;
      if (inst && typeof inst.fitView === 'function') {
        setTimeout(() => inst.fitView({ padding: 0.4, duration: 600 }), 100);
      }
    };

    window.addEventListener('avlodona:nav:family', onNavFamily as EventListener);
    return () => window.removeEventListener('avlodona:nav:family', onNavFamily as EventListener);
  }, []);

  return (
    <div className="w-full h-full overflow-hidden bg-card/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        panOnDrag={panEnabled}
        zoomOnScroll={zoomEnabled}
        zoomOnPinch={zoomEnabled}
        zoomOnDoubleClick={zoomEnabled}
        onNodeClick={(_, node) => {
          const data = node.data as unknown as FamilyMemberNodeData;
          if (readOnly && data.onOpenProfile) {
            data.onOpenProfile(data.member);
          }
        }}
        fitView={!initialViewport}
        defaultViewport={initialViewport}
        fitViewOptions={{ padding: 0.4, duration: 600 }}
        style={{ touchAction: panEnabled || zoomEnabled ? 'none' : 'auto' }}
        onMove={(_, viewport) => onViewportChange?.(viewport)}
        onInit={(instance) => {
          flowInstanceRef.current = instance;
        }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={1.5}
          color="hsl(var(--muted-foreground) / 0.15)"
        />
      </ReactFlow>
    </div>
  );
};
