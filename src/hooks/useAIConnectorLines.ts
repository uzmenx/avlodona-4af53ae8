import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

interface MemberPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  relationType: string;
}

interface HeartPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Fallback path generation when AI is not available
const generateFallbackPath = (from: Position, to: Position, type: 'parent' | 'child' | 'spouse'): string => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  
  if (type === 'spouse') {
    const midY = from.y;
    return `M ${from.x} ${from.y} Q ${from.x + dx / 2} ${midY - 10} ${to.x} ${to.y}`;
  }
  
  if (type === 'parent') {
    const controlY = from.y - Math.abs(dy) * 0.5;
    return `M ${from.x} ${from.y} C ${from.x} ${controlY}, ${to.x} ${to.y + Math.abs(dy) * 0.3}, ${to.x} ${to.y}`;
  }
  
  const controlY = from.y + Math.abs(dy) * 0.5;
  return `M ${from.x} ${from.y} C ${from.x} ${controlY}, ${to.x} ${to.y - Math.abs(dy) * 0.3}, ${to.x} ${to.y}`;
};

export const useAIConnectorLines = (
  containerRef: React.RefObject<HTMLDivElement>,
  memberElements: Map<string, HTMLElement | null>,
  members: any[],
  heartElements: Map<string, HTMLElement | null>,
  useAI: boolean = true
) => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const { toast } = useToast();
  const lastCalculationRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate positions from DOM elements
  const calculatePositions = useCallback(() => {
    if (!containerRef.current) return null;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    
    const memberPositions: MemberPosition[] = [];
    const heartPositions: HeartPosition[] = [];

    memberElements.forEach((el, id) => {
      if (el) {
        const rect = el.getBoundingClientRect();
        const member = members.find(m => m.id === id);
        memberPositions.push({
          id,
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
          relationType: member?.relation_type || 'unknown',
        });
      }
    });

    heartElements.forEach((el, id) => {
      if (el) {
        const rect = el.getBoundingClientRect();
        heartPositions.push({
          id,
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        });
      }
    });

    return {
      members: memberPositions,
      hearts: heartPositions,
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
    };
  }, [containerRef, memberElements, members, heartElements]);

  // Calculate connections using AI
  const calculateWithAI = useCallback(async () => {
    const positions = calculatePositions();
    if (!positions || positions.members.length === 0) return;

    // Create hash to avoid duplicate calculations
    const positionHash = JSON.stringify(positions);
    if (positionHash === lastCalculationRef.current) return;
    
    setIsCalculating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('calculate-family-lines', {
        body: positions,
      });

      if (error) throw error;

      if (data?.connections) {
        const aiConnections: Connection[] = data.connections.map((conn: any) => {
          // Find positions for from/to
          const fromMember = positions.members.find(m => m.id === conn.fromId);
          const toHeart = positions.hearts.find(h => h.id === conn.toId);
          const toMember = positions.members.find(m => m.id === conn.toId);
          const fromHeart = positions.hearts.find(h => h.id === conn.fromId);

          return {
            from: {
              x: fromMember?.x || fromHeart?.x || 0,
              y: fromMember?.y - (fromMember?.height || 0) / 2 || fromHeart?.y + (fromHeart?.height || 0) / 2 || 0,
            },
            to: {
              x: toMember?.x || toHeart?.x || 0,
              y: toMember?.y - (toMember?.height || 0) / 2 || toHeart?.y + (toHeart?.height || 0) / 2 || 0,
            },
            type: conn.type,
            path: conn.path,
            fromMemberId: conn.fromId,
            toMemberId: conn.toId,
          };
        });

        setConnections(aiConnections);
        lastCalculationRef.current = positionHash;
      }
    } catch (error: any) {
      console.error('AI calculation error:', error);
      // Fallback to standard calculation
      calculateFallback();
    } finally {
      setIsCalculating(false);
    }
  }, [calculatePositions]);

  // Fallback calculation without AI
  const calculateFallback = useCallback(() => {
    if (!containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newConnections: Connection[] = [];

    // Calculate parent-to-member connections
    members.forEach((member) => {
      const memberEl = memberElements.get(member.id);
      if (!memberEl) return;

      const memberRect = memberEl.getBoundingClientRect();
      const memberTop = {
        x: memberRect.left - containerRect.left + memberRect.width / 2,
        y: memberRect.top - containerRect.top,
      };

      // Check for parents-of-X heart element
      const parentsHeartEl = heartElements.get(`parents-of-${member.id}`);
      if (parentsHeartEl) {
        const heartRect = parentsHeartEl.getBoundingClientRect();
        const from = memberTop;
        const to = {
          x: heartRect.left - containerRect.left + heartRect.width / 2,
          y: heartRect.top - containerRect.top + heartRect.height,
        };
        
        newConnections.push({
          from,
          to,
          type: 'parent',
          path: generateFallbackPath(from, to, 'parent'),
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
            const from = memberTop;
            const to = {
              x: fatherRect.left - containerRect.left + fatherRect.width / 2,
              y: fatherRect.top - containerRect.top + fatherRect.height,
            };
            
            newConnections.push({
              from,
              to,
              type: 'parent',
              path: generateFallbackPath(from, to, 'parent'),
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
            const from = memberTop;
            const to = {
              x: motherRect.left - containerRect.left + motherRect.width / 2,
              y: motherRect.top - containerRect.top + motherRect.height,
            };
            
            newConnections.push({
              from,
              to,
              type: 'parent',
              path: generateFallbackPath(from, to, 'parent'),
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

      const parentMemberId = heartKey;
      const childMembers = members.filter(m => 
        m.relation_type.startsWith(`child_of_${parentMemberId}`)
      );

      childMembers.forEach((child) => {
        const childEl = memberElements.get(child.id);
        if (childEl) {
          const childRect = childEl.getBoundingClientRect();
          const from = heartCenter;
          const to = {
            x: childRect.left - containerRect.left + childRect.width / 2,
            y: childRect.top - containerRect.top,
          };
          
          newConnections.push({
            from,
            to,
            type: 'child',
            path: generateFallbackPath(from, to, 'child'),
            fromMemberId: parentMemberId,
            toMemberId: child.id,
          });
        }
      });
    });

    setConnections(newConnections);
  }, [containerRef, memberElements, members, heartElements]);

  // Main calculation function with debounce
  const calculate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (useAI) {
        calculateWithAI();
      } else {
        calculateFallback();
      }
    }, 200);
  }, [useAI, calculateWithAI, calculateFallback]);

  // Effect to trigger calculation
  useEffect(() => {
    const timer = setTimeout(calculate, 150);
    
    window.addEventListener('resize', calculate);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculate);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [calculate, members]);

  return { connections, isCalculating, recalculate: calculate };
};
