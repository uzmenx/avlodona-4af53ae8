import type { Notification } from '@/hooks/useNotifications';

/**
 * Instagram uslubidagi guruhlash:
 *   - bir xil POST/STORY ga kelgan like/story_like/comment/mention birlashadi
 *     → "Rassom va yana 4 kishi yoqtirdi"
 *   - follow lar oxirgi 24 soatda birlashadi
 *     → "5 kishi sizni kuzata boshladi"
 *   - message va invitation lar ALOHIDA qoladi (har biri o'z kontekstiga ega)
 *
 * Vaqt cheklovi: bitta guruh ichidagi notif lar bir-biridan ≤ 24 soat farqlanishi kerak.
 */

export type GroupedNotification =
  | { kind: 'single'; key: string; notification: Notification }
  | {
      kind: 'group';
      key: string;
      type: Notification['type'];
      items: Notification[];          // eng yangi → eng eski
      latest: Notification;
      actors: Notification['actor'][]; // unikal actorlar (max 5 ko'rsatamiz)
      actorCount: number;             // jami unikal actor soni
      isRead: boolean;                // hech bir element o'qilmagan bo'lsa false
      latestAt: string;
    };

const GROUPING_WINDOW_MS = 24 * 60 * 60 * 1000;

// Qaysi turdagilar guruhlanadi
const GROUP_BY_POST = new Set<Notification['type']>(['like', 'story_like', 'comment', 'mention']);
const GROUP_BY_DAY = new Set<Notification['type']>(['follow']);

function groupKey(n: Notification): string | null {
  if (GROUP_BY_POST.has(n.type) && n.post_id) {
    return `${n.type}:post:${n.post_id}`;
  }
  if (GROUP_BY_DAY.has(n.type)) {
    return `${n.type}:day:${new Date(n.created_at).toISOString().slice(0, 10)}`;
  }
  return null;
}

export function groupNotifications(notifications: Notification[]): GroupedNotification[] {
  // Eng yangi birinchi (kelgan tartibida shunday bo'lishi kerak)
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const buckets = new Map<string, Notification[]>();
  const result: GroupedNotification[] = [];

  for (const n of sorted) {
    const key = groupKey(n);

    if (!key) {
      result.push({ kind: 'single', key: n.id, notification: n });
      continue;
    }

    const bucket = buckets.get(key);
    if (!bucket) {
      buckets.set(key, [n]);
      // Placeholder — keyinroq to'ldiramiz
      result.push({
        kind: 'group',
        key,
        type: n.type,
        items: [],
        latest: n,
        actors: [],
        actorCount: 0,
        isRead: true,
        latestAt: n.created_at,
      });
      continue;
    }

    // Vaqt oynasi ichida bo'lsa qo'shamiz
    const firstTime = new Date(bucket[0].created_at).getTime();
    const thisTime = new Date(n.created_at).getTime();
    if (firstTime - thisTime <= GROUPING_WINDOW_MS) {
      bucket.push(n);
    } else {
      // Eski guruh — alohida qatorga ajratamiz
      const altKey = `${key}:older:${n.id}`;
      buckets.set(altKey, [n]);
      result.push({
        kind: 'group',
        key: altKey,
        type: n.type,
        items: [],
        latest: n,
        actors: [],
        actorCount: 0,
        isRead: true,
        latestAt: n.created_at,
      });
    }
  }

  // Bucketlarni placeholderlarga joylaymiz
  return result
    .map((g): GroupedNotification | null => {
      if (g.kind === 'single') return g;
      const items = buckets.get(g.key) ?? [];
      if (items.length === 0) return null;
      if (items.length === 1) {
        return { kind: 'single', key: items[0].id, notification: items[0] };
      }
      // Unikal actorlar (oxirgi tartibda)
      const seen = new Set<string>();
      const uniqueActors: Notification['actor'][] = [];
      for (const it of items) {
        if (it.actor && !seen.has(it.actor_id)) {
          seen.add(it.actor_id);
          uniqueActors.push(it.actor);
        }
      }
      return {
        kind: 'group',
        key: g.key,
        type: g.type,
        items,
        latest: items[0],
        actors: uniqueActors,
        actorCount: uniqueActors.length,
        isRead: items.every(i => i.is_read),
        latestAt: items[0].created_at,
      };
    })
    .filter((x): x is GroupedNotification => x !== null);
}
