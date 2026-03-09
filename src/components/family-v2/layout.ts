import type { Node } from '@xyflow/react';
import type { FamilyMember } from '@/types/family';

const HORIZONTAL_GAP = 250;
const VERTICAL_GAP = 200;
const SPOUSE_GAP = 180;

function avg(a: number, b: number) {
  return (a + b) / 2;
}

function getFallbackPosition(prevNodeMap: Map<string, Node>) {
  // place new nodes to the right of the current "max X" to avoid overlaps
  let maxX = 0;
  let maxY = 0;
  for (const n of prevNodeMap.values()) {
    maxX = Math.max(maxX, n.position.x);
    maxY = Math.max(maxY, n.position.y);
  }
  return { x: maxX + HORIZONTAL_GAP, y: maxY };
}

export function computeNewMemberPosition(args: {
  member: FamilyMember;
  members: Record<string, FamilyMember>;
  prevNodeMap: Map<string, Node>;
}) {
  const { member, members, prevNodeMap } = args;

  // 1) If this member is a newly created PARENT (has a child already positioned): place ABOVE child
  const firstChildId = member.childrenIds?.find((cid) => prevNodeMap.has(cid));
  if (firstChildId) {
    const childPos = prevNodeMap.get(firstChildId)!.position;
    const x = childPos.x + (member.gender === 'male' ? -SPOUSE_GAP / 2 : SPOUSE_GAP / 2);
    const y = childPos.y - VERTICAL_GAP;
    return { x, y };
  }

  // 2) If spouse already exists/positioned: place NEXT to spouse
  if (member.spouseId && prevNodeMap.has(member.spouseId)) {
    const spousePos = prevNodeMap.get(member.spouseId)!.position;
    const x = spousePos.x + (member.gender === 'male' ? -SPOUSE_GAP : SPOUSE_GAP);
    const y = spousePos.y;
    return { x, y };
  }

  // 3) If this member is a newly created CHILD: place BELOW parents, "shaxmat" (grid) style
  if (member.parentIds?.length) {
    const p1 = prevNodeMap.get(member.parentIds[0] ?? '');
    const p2 = prevNodeMap.get(member.parentIds[1] ?? '');

    if (p1 && p2) {
      const centerX = avg(p1.position.x, p2.position.x);
      const topY = Math.min(p1.position.y, p2.position.y);
      const baseY = topY + VERTICAL_GAP;

      // sibling index from whichever parent has children list
      const fatherId = member.parentIds.find((pid) => members[pid]?.gender === 'male') ?? member.parentIds[0];
      const father = fatherId ? members[fatherId] : undefined;
      const siblings = father?.childrenIds ?? [];
      const idx = Math.max(0, siblings.indexOf(member.id));
      const count = Math.max(1, siblings.length);
      const offset = (idx - (count - 1) / 2) * HORIZONTAL_GAP;

      // chess-like slight vertical staggering
      const y = baseY + (idx % 2 === 0 ? 0 : 40);
      const x = centerX + offset;
      return { x, y };
    } else if (p1) {
      // Single parent positioned
      const baseY = p1.position.y + VERTICAL_GAP;
      const siblings = members[member.parentIds[0]]?.childrenIds ?? [];
      const idx = Math.max(0, siblings.indexOf(member.id));
      const count = Math.max(1, siblings.length);
      const offset = (idx - (count - 1) / 2) * HORIZONTAL_GAP;
      const y = baseY + (idx % 2 === 0 ? 0 : 40);
      const x = p1.position.x + offset;
      return { x, y };
    }
  }

  // 4) Otherwise fallback
  return getFallbackPosition(prevNodeMap);
}
