import { EdgeProps, useInternalNode } from '@xyflow/react';
import { Heart } from 'lucide-react';

// Avatar size constant - must match FamilyMemberNode
const AVATAR_SIZE = 80;

const SpouseEdge = ({
  id,
  source,
  target,
}: EdgeProps) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) {
    return null;
  }

  // Get absolute positions
  const sourcePos = sourceNode.internals.positionAbsolute;
  const targetPos = targetNode.internals.positionAbsolute;

  // Calculate avatar centers
  const sourceCenterX = sourcePos.x + AVATAR_SIZE / 2;
  const sourceCenterY = sourcePos.y + AVATAR_SIZE / 2;
  const targetCenterX = targetPos.x + AVATAR_SIZE / 2;
  const targetCenterY = targetPos.y + AVATAR_SIZE / 2;

  // Determine which node is on the left
  const isSourceLeft = sourceCenterX < targetCenterX;
  
  // Edge starts from right side of left node, ends at left side of right node
  const startX = isSourceLeft ? sourcePos.x + AVATAR_SIZE : sourcePos.x;
  const startY = sourceCenterY;
  const endX = isSourceLeft ? targetPos.x : targetPos.x + AVATAR_SIZE;
  const endY = targetCenterY;

  // Calculate center point for heart
  const centerX = (startX + endX) / 2;
  const centerY = (startY + endY) / 2;

  // Create smooth curved path
  const dx = endX - startX;
  const controlOffset = Math.min(Math.abs(dx) * 0.3, 30);
  
  const path = `M ${startX} ${startY} C ${startX + controlOffset} ${startY - 10}, ${endX - controlOffset} ${endY + 10}, ${endX} ${endY}`;

  return (
    <g className="spouse-edge">
      {/* Defs for gradients and filters */}
      <defs>
        <filter id={`glow-spouse-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`gradient-spouse-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="50%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>

      {/* Hidden path for particle animation */}
      <path
        id={`motion-path-${id}`}
        d={path}
        fill="none"
        stroke="none"
      />

      {/* Glow background */}
      <path
        d={path}
        fill="none"
        stroke="#f472b6"
        strokeWidth={8}
        strokeOpacity={0.2}
        strokeLinecap="round"
        filter={`url(#glow-spouse-${id})`}
      />

      {/* Main dashed line */}
      <path
        d={path}
        fill="none"
        stroke={`url(#gradient-spouse-${id})`}
        strokeWidth={2.5}
        strokeDasharray="8 5"
        strokeLinecap="round"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-26"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </path>

      {/* Animated particles */}
      {[0, 1, 2, 3].map((i) => (
        <circle
          key={`particle-${id}-${i}`}
          r="3"
          fill="#f472b6"
          opacity={0.9}
        >
          <animateMotion
            dur={`${2 + i * 0.4}s`}
            repeatCount="indefinite"
            begin={`${i * 0.5}s`}
          >
            <mpath href={`#motion-path-${id}`} />
          </animateMotion>
        </circle>
      ))}

      {/* Heart at center */}
      <foreignObject
        x={centerX - 14}
        y={centerY - 14}
        width={28}
        height={28}
        className="pointer-events-none overflow-visible"
      >
        <div 
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(145deg, #ec4899, #f43f5e)',
            boxShadow: '0 0 16px rgba(236, 72, 153, 0.6), 0 2px 8px rgba(0, 0, 0, 0.3)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          <Heart className="w-3.5 h-3.5 text-white fill-white" />
        </div>
      </foreignObject>
    </g>
  );
};

export default SpouseEdge;
