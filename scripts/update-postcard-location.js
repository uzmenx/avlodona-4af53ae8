import fs from 'node:fs';

const filePath = 'c:/Users/otabek/Desktop/avlodona/src/components/feed/PostCard.tsx';
let c = fs.readFileSync(filePath, 'utf8');
const nl = c.includes('\r\n') ? '\r\n' : '\n';

// 1) Iconify import
const heartImport = "import { Heart } from 'lucide-react';";
const iconImport = "import { Icon } from '@iconify/react';";
if (!c.includes(heartImport)) {
  throw new Error('Heart import not found');
}
if (!c.includes(iconImport)) {
  c = c.replace(heartImport, heartImport + nl + nl + iconImport);
}

// 2) Location parsing block after timeAgo
const timeAgoLine = "  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });";
if (!c.includes(timeAgoLine)) {
  throw new Error('timeAgo line not found');
}
if (!c.includes('const rawContent = post.content')) {
  const insert = [
    '',
    "  const rawContent = post.content || '';",
    "  const locationMatch = rawContent.match(/(?:^|\\n)📍\\s*(.+?)\\s*$/m);",
    "  const locationLine = locationMatch ? locationMatch[1].trim() : '';",
    "  const locationParts = locationLine.split('||').map((p) => p.trim()).filter(Boolean);",
    "  const locationText = locationParts[0] || '';",
    "  const coordsPart = locationParts[1] || '';",
    "  const coordsMatch = coordsPart.match(/^(-?\\d+(?:\\.\\d+)?),\\s*(-?\\d+(?:\\.\\d+)?)$/);",
    "  const lat = coordsMatch?.[1] || '';",
    "  const lon = coordsMatch?.[2] || '';",
    "  const mapUrl = locationText",
    "    ? lat && lon",
    "      ? 'https://www.google.com/maps?q=' + encodeURIComponent(lat + ',' + lon)",
    "      : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(locationText)",
    "    : '';",
    "  const contentWithoutLocation = rawContent.replace(/(?:\\n|^)📍\\s*.+\\s*$/m, '').trim();",
  ].join(nl);

  c = c.replace(timeAgoLine, timeAgoLine + insert);
}

// 3) Replace caption/time block in Actions
const oldBlock = [
  "          {post.content && (",
  "            <PostCaption",
  "              username={post.author?.username || 'user'}",
  "              content={post.content}",
  "              postId={post.id}",
  "            />",
  "          )}",
  "",
  "          <p className=\"text-xs text-muted-foreground uppercase\">{timeAgo}</p>",
].join(nl);

if (!c.includes(oldBlock)) {
  throw new Error('Old caption/time block not found');
}

const newBlock = [
  "          <div className=\"flex items-center justify-between gap-2\">",
  "            <p className=\"text-xs text-muted-foreground uppercase\">{timeAgo}</p>",
  "            {locationText && mapUrl && (",
  "              <a",
  "                href={mapUrl}",
  "                target=\"_blank\"",
  "                rel=\"noreferrer\"",
  "                className=\"flex items-center gap-1 text-xs text-muted-foreground min-w-0 max-w-[55%] hover:text-foreground transition-colors\"",
  "                title={locationText}",
  "              >",
  "                <Icon icon=\"gis:location-poi\" className=\"h-3.5 w-3.5 flex-shrink-0\" />",
  "                <span className=\"truncate\">{locationText}</span>",
  "              </a>",
  "            )}",
  "          </div>",
  "",
  "          {contentWithoutLocation && (",
  "            <PostCaption",
  "              username={post.author?.username || 'user'}",
  "              content={contentWithoutLocation}",
  "              postId={post.id}",
  "            />",
  "          )}",
].join(nl);

c = c.replace(oldBlock, newBlock);

fs.writeFileSync(filePath, c, 'utf8');
console.log('Updated:', filePath);

