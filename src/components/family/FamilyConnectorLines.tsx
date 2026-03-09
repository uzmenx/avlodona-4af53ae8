import { useEffect, useRef, useState } from 'react';

interface Position {
  x: number;
  y: number;
}

interface Connection {
  from: Position;
  to: Position;
  type: 'parent' | 'child' | 'spouse';
  path?: string; // AI-generated SVG path
  fromMemberId?: string;
  toMemberId?: string;
}

interface FamilyConnectorLinesProps {
  containerRef: React.RefObject<HTMLDivElement>;
  connections: Connection[];
}

// Generate smooth curved path between two points
const generateCurvedPath = (from: Position, to: Position, type: 'parent' | 'child' | 'spouse'): string => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  
  if (type === 'spouse') {
    // For spouse - simple straight line with slight curve
    const midY = from.y;
    return `M ${from.x} ${from.y} Q ${from.x + dx / 2} ${midY - 10} ${to.x} ${to.y}`;
  }
  
  if (type === 'parent') {
    // For parent - elegant bezier curve going UP from child to parent
    const controlY = from.y - Math.abs(dy) * 0.5;
    
    return `M ${from.x} ${from.y} C ${from.x} ${controlY}, ${to.x} ${to.y + Math.abs(dy) * 0.3}, ${to.x} ${to.y}`;
  }
  
  // For child - elegant bezier curve going DOWN from heart to child
  const controlY = from.y + Math.abs(dy) * 0.5;
  
  return `M ${from.x} ${from.y} C ${from.x} ${controlY}, ${to.x} ${to.y - Math.abs(dy) * 0.3}, ${to.x} ${to.y}`;
};

export const FamilyConnectorLines = ({ containerRef, connections }: FamilyConnectorLinesProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.scrollWidth,
          height: containerRef.current.scrollHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
    };
  }, [containerRef, connections]);

  if (connections.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none z-0"
      width={dimensions.width}
      height={dimensions.height}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Gradient for parent lines - going up */}
        <linearGradient id="parentLineGradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
        </linearGradient>
        
        {/* Gradient for child lines - going down */}
        <linearGradient id="childLineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.4" />
        </linearGradient>
        
        {/* Filter for subtle glow effect */}
        <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {connections.map((connection, index) => {
        // Use AI-generated path if available, otherwise generate fallback
        const path = connection.path || generateCurvedPath(connection.from, connection.to, connection.type);
        
        return (
          <g key={`connection-${index}`}>
            {/* Shadow/glow path */}
            <path
              d={path}
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="3"
              strokeOpacity="0.1"
              strokeLinecap="round"
            />
            
            {/* Main path */}
            <path
              d={path}
              fill="none"
              stroke={connection.type === 'child' ? 'url(#childLineGradient)' : 'url(#parentLineGradient)'}
              strokeWidth="2"
              strokeLinecap="round"
              className="transition-all duration-300"
              filter="url(#lineGlow)"
            />
          </g>
        );
      })}
    </svg>
  );
};

// Hook to calculate connection positions
export const useConnectionPositions = (
  containerRef: React.RefObject<HTMLDivElement>,
  memberElements: Map<string, HTMLElement | null>,
  members: any[],
  heartElements: Map<string, HTMLElement | null>
) => {
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    const calculateConnections = () => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newConnections: Connection[] = [];

      // Calculate parent-to-member connections (parent above, member below)
      members.forEach((member) => {
        const memberEl = memberElements.get(member.id);
        if (!memberEl) return;

        const memberRect = memberEl.getBoundingClientRect();
        const memberTop = {
          x: memberRect.left - containerRect.left + memberRect.width / 2,
          y: memberRect.top - containerRect.top,
        };

        // Check for parents-of-X heart element (combined heart for both parents)
        const parentsHeartEl = heartElements.get(`parents-of-${member.id}`);
        if (parentsHeartEl) {
          const heartRect = parentsHeartEl.getBoundingClientRect();
          newConnections.push({
            from: memberTop,
            to: {
              x: heartRect.left - containerRect.left + heartRect.width / 2,
              y: heartRect.top - containerRect.top + heartRect.height,
            },
            type: 'parent',
            fromMemberId: member.id,
            toMemberId: 'parents',
          });
        } else {
          // Find fathers of this member
          const fathers = members.filter(m => 
            m.relation_type === `father_of_${member.id}` || 
            m.relation_type === `father_2_of_${member.id}`
          );

          fathers.forEach((father) => {
            const fatherEl = memberElements.get(father.id);
            if (fatherEl) {
              const fatherRect = fatherEl.getBoundingClientRect();
              newConnections.push({
                from: memberTop,
                to: {
                  x: fatherRect.left - containerRect.left + fatherRect.width / 2,
                  y: fatherRect.top - containerRect.top + fatherRect.height,
                },
                type: 'parent',
                fromMemberId: member.id,
                toMemberId: father.id,
              });
            }
          });

          // Find mothers of this member
          const mothers = members.filter(m => 
            m.relation_type === `mother_of_${member.id}` || 
            m.relation_type === `mother_2_of_${member.id}`
          );

          mothers.forEach((mother) => {
            const motherEl = memberElements.get(mother.id);
            if (motherEl) {
              const motherRect = motherEl.getBoundingClientRect();
              newConnections.push({
                from: memberTop,
                to: {
                  x: motherRect.left - containerRect.left + motherRect.width / 2,
                  y: motherRect.top - containerRect.top + motherRect.height,
                },
                type: 'parent',
                fromMemberId: member.id,
                toMemberId: mother.id,
              });
            }
          });
        }
      });

      // Calculate child connections (from heart to child)
      heartElements.forEach((heartEl, heartKey) => {
        if (!heartEl || heartKey.startsWith('parent-') || heartKey.startsWith('parents-of-')) return;

        const heartRect = heartEl.getBoundingClientRect();
        const heartCenter = {
          x: heartRect.left - containerRect.left + heartRect.width / 2,
          y: heartRect.top - containerRect.top + heartRect.height,
        };

        // The heartKey is the parent member ID
        const parentMemberId = heartKey;

        // Find children of this member
        const childMembers = members.filter(m => 
          m.relation_type.startsWith(`child_of_${parentMemberId}`)
        );

        childMembers.forEach((child) => {
          const childEl = memberElements.get(child.id);
          if (childEl) {
            const childRect = childEl.getBoundingClientRect();
            newConnections.push({
              from: heartCenter,
              to: {
                x: childRect.left - containerRect.left + childRect.width / 2,
                y: childRect.top - containerRect.top,
              },
              type: 'child',
              fromMemberId: parentMemberId,
              toMemberId: child.id,
            });
          }
        });
      });

      setConnections(newConnections);
    };

    // Delay to ensure DOM is rendered
    const timer = setTimeout(calculateConnections, 150);
    
    // Recalculate on resize
    window.addEventListener('resize', calculateConnections);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateConnections);
    };
  }, [containerRef, memberElements, members, heartElements]);

  return connections;
};