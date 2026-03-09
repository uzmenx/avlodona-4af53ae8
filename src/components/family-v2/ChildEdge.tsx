import { EdgeProps, useInternalNode } from '@xyflow/react';

interface ChildEdgeData {
  spouseId?: string;
}

const ChildEdge = ({
  id,
  source,
  target,
  style,
  data,
}: EdgeProps) => {
  const edgeData = data as ChildEdgeData | undefined;
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const spouseNode = useInternalNode(edgeData?.spouseId || '');

  if (!sourceNode || !targetNode) {
    return null;
  }

  // Get node dimensions - match FamilyMemberNode avatar size
  const sourceWidth = sourceNode.measured?.width || 80;
  const sourceHeight = sourceNode.measured?.height || 120;
  const targetWidth = targetNode.measured?.width || 80;

  // Target position (child node center top)
  const targetX = targetNode.internals.positionAbsolute.x + targetWidth / 2;
  const targetY = targetNode.internals.positionAbsolute.y;

  // Calculate start point - should be at the center of spouse line (where heart is)
  let startX: number;
  let startY: number;
  
  if (spouseNode) {
    const spouseWidth = spouseNode.measured?.width || 80;
    
    // Get the right edge of source (where spouse line ends)
    const sourceRightX = sourceNode.internals.positionAbsolute.x + sourceWidth;
    const sourceRightY = sourceNode.internals.positionAbsolute.y + 40; // Avatar center
    
    // Get the left edge of spouse (where spouse line starts)
    const spouseLeftX = spouseNode.internals.positionAbsolute.x;
    const spouseLeftY = spouseNode.internals.positionAbsolute.y + 40; // Avatar center
    
    // Start from below the heart (so line goes behind heart)
    startX = (sourceRightX + spouseLeftX) / 2;
    startY = ((sourceRightY + spouseLeftY) / 2) + 16; // Start below heart center
  } else {
    // Fallback: start from bottom center of parent
    startX = sourceNode.internals.positionAbsolute.x + sourceWidth / 2;
    startY = sourceNode.internals.positionAbsolute.y + sourceHeight;
  }

  // Calculate intermediate point (below couple center)
  const midY = startY + 35;

  // Create smooth flowing path with bezier curves
  const path = `
    M ${startX} ${startY}
    L ${startX} ${midY}
    C ${startX} ${midY + 40}, 
      ${targetX} ${(midY + targetY) / 2}, 
      ${targetX} ${targetY}
  `;

  // Generate animated dots along the path
  const dots = [];
  const numDots = 4;
  for (let i = 0; i < numDots; i++) {
    dots.push(
      <circle
        key={`dot-child-${id}-${i}`}
        r="2"
        fill="hsl(210, 70%, 60%)"
        opacity={0.9}
      >
        <animateMotion
          dur={`${2.5 + i * 0.4}s`}
          repeatCount="indefinite"
          begin={`${i * 0.5}s`}
        >
          <mpath href={`#child-path-${id}`} />
        </animateMotion>
      </circle>
    );
  }

  return (
    <g>
      {/* Glow filter */}
      <defs>
        <filter id={`glow-child-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`gradient-child-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(210, 80%, 70%)" />
          <stop offset="40%" stopColor="hsl(200, 75%, 55%)" />
          <stop offset="100%" stopColor="hsl(190, 70%, 50%)" />
        </linearGradient>
      </defs>

      {/* Hidden path for motion */}
      <path
        id={`child-path-${id}`}
        d={path}
        fill="none"
        stroke="none"
      />

      {/* Background glow */}
      <path
        d={path}
        fill="none"
        stroke="hsl(210, 60%, 55%)"
        strokeWidth={5}
        strokeOpacity={0.25}
        filter={`url(#glow-child-${id})`}
        strokeLinecap="round"
        style={style}
      />

      {/* Main gradient line */}
      <path
        id={id}
        d={path}
        fill="none"
        stroke={`url(#gradient-child-${id})`}
        strokeWidth={2}
        strokeLinecap="round"
        style={style}
      />

      {/* Animated particles */}
      {dots}

      {/* Start point glow dot */}
      <circle
        cx={startX}
        cy={startY}
        r="4"
        fill="hsl(210, 70%, 60%)"
        opacity={0.6}
      >
        <animate
          attributeName="r"
          values="3;5;3"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.4;0.8;0.4"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
};

export default ChildEdge;
