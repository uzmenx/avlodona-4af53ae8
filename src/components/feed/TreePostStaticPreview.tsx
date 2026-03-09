import { useMemo } from 'react';
import { FamilyMember } from '@/types/family';
import { TreeOverlay } from '@/hooks/useTreePosts';
import { cn } from '@/lib/utils';

interface TreePostStaticPreviewProps {
  members: Record<string, FamilyMember>;
  positions: Record<string, { x: number; y: number }>;
  overlays?: TreeOverlay[];
  className?: string;
}

/**
 * Renders a static, non-interactive snapshot of the family tree for feed display.
 * Calculates bounding box from positions and renders nodes + edges as SVG/divs.
 */
export const TreePostStaticPreview = ({
  members,
  positions,
  overlays = [],
  className,
}: TreePostStaticPreviewProps) => {
  const memberList = Object.values(members);

  // Calculate bounding box and normalize positions to fit within the container
  const { normalizedPositions, viewBox } = useMemo(() => {
    const posEntries = Object.entries(positions);
    if (posEntries.length === 0) {
      // Fallback to member.position
      const fallback: Record<string, { x: number; y: number }> = {};
      memberList.forEach((m) => {
        if (m.position) fallback[m.id] = m.position;
      });
      if (Object.keys(fallback).length === 0) return { normalizedPositions: {}, viewBox: { minX: 0, minY: 0, width: 400, height: 500 } };
      return calcNormalized(fallback);
    }
    return calcNormalized(positions);
  }, [positions, memberList]);

  function calcNormalized(pos: Record<string, { x: number; y: number }>) {
    const entries = Object.entries(pos);
    if (entries.length === 0) return { normalizedPositions: pos, viewBox: { minX: 0, minY: 0, width: 400, height: 500 } };
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    entries.forEach(([, p]) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    
    const pad = 60;
    return {
      normalizedPositions: pos,
      viewBox: {
        minX: minX - pad,
        minY: minY - pad,
        width: Math.max(maxX - minX + pad * 2, 200),
        height: Math.max(maxY - minY + pad * 2, 200),
      },
    };
  }

  // Build edges
  const edges = useMemo(() => {
    const result: { from: string; to: string; type: 'spouse' | 'child' }[] = [];
    const processedCouples = new Set<string>();

    memberList.forEach((member) => {
      if (member.spouseId && members[member.spouseId]) {
        const key = [member.id, member.spouseId].sort().join('-');
        if (!processedCouples.has(key)) {
          processedCouples.add(key);
          result.push({ from: member.id, to: member.spouseId, type: 'spouse' });
        }
      }
      if (member.parentIds?.length) {
        const parentId = member.parentIds[0];
        if (parentId && members[parentId]) {
          result.push({ from: parentId, to: member.id, type: 'child' });
        }
      }
    });
    return result;
  }, [memberList, members]);

  const nodeRadius = 22;

  return (
    <div className={cn('relative w-full overflow-hidden bg-[#020d1a]', className)} style={{ aspectRatio: '3/4' }}>
      <svg
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Edges */}
        {edges.map((edge, i) => {
          const from = normalizedPositions[edge.from];
          const to = normalizedPositions[edge.to];
          if (!from || !to) return null;
          
          const fromX = from.x + nodeRadius;
          const fromY = from.y + nodeRadius;
          const toX = to.x + nodeRadius;
          const toY = to.y + nodeRadius;

          if (edge.type === 'spouse') {
            return (
              <line
                key={`e-${i}`}
                x1={fromX} y1={fromY}
                x2={toX} y2={toY}
                stroke="hsl(330, 70%, 60%)"
                strokeWidth={2}
                strokeDasharray="6 4"
                opacity={0.7}
              />
            );
          }
          
          // Child edge — vertical then horizontal
          const midY = fromY + (toY - fromY) * 0.5;
          return (
            <path
              key={`e-${i}`}
              d={`M${fromX},${fromY + nodeRadius} L${fromX},${midY} L${toX},${midY} L${toX},${toY - nodeRadius}`}
              fill="none"
              stroke="hsl(200, 70%, 55%)"
              strokeWidth={2}
              opacity={0.7}
            />
          );
        })}

        {/* Nodes */}
        {memberList.map((member) => {
          const pos = normalizedPositions[member.id];
          if (!pos) return null;
          
          const cx = pos.x + nodeRadius;
          const cy = pos.y + nodeRadius;
          const isMale = member.gender === 'male';
          const fillColor = isMale ? 'hsl(200, 70%, 50%)' : 'hsl(330, 70%, 55%)';

          return (
            <g key={member.id}>
              <circle
                cx={cx} cy={cy} r={nodeRadius}
                fill={fillColor}
                stroke="hsl(0, 0%, 100%)"
                strokeWidth={1.5}
                opacity={0.9}
              />
              {member.photoUrl ? (
                <>
                  <defs>
                    <clipPath id={`clip-${member.id}`}>
                      <circle cx={cx} cy={cy} r={nodeRadius - 2} />
                    </clipPath>
                  </defs>
                  <image
                    href={member.photoUrl}
                    x={cx - nodeRadius + 2}
                    y={cy - nodeRadius + 2}
                    width={(nodeRadius - 2) * 2}
                    height={(nodeRadius - 2) * 2}
                    clipPath={`url(#clip-${member.id})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                </>
              ) : (
                <text
                  x={cx} y={cy + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={12}
                  fontWeight="bold"
                >
                  {(member.name || '?')[0].toUpperCase()}
                </text>
              )}
              {/* Name label */}
              <text
                x={cx} y={cy + nodeRadius + 12}
                textAnchor="middle"
                fill="hsl(0, 0%, 70%)"
                fontSize={9}
                fontWeight="500"
              >
                {(member.name || '').slice(0, 10)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Overlays on top */}
      {overlays.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {overlays.map((overlay) => (
            <div
              key={overlay.id}
              className="absolute"
              style={{
                left: `${(overlay.x / 400) * 100}%`,
                top: `${(overlay.y / 500) * 100}%`,
                transform: `scale(${overlay.scale}) rotate(${overlay.rotation}deg)`,
              }}
            >
              {overlay.type === 'sticker' && <span className="text-2xl">{overlay.content}</span>}
              {overlay.type === 'text' && (
                <span className="px-1.5 py-0.5 rounded bg-background/70 text-foreground text-xs font-medium whitespace-nowrap" style={{ color: overlay.color }}>
                  {overlay.content}
                </span>
              )}
              {overlay.type === 'image' && (
                <img src={overlay.content} alt="" className="w-16 h-16 object-cover rounded-lg" draggable={false} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
