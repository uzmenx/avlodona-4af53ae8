$ErrorActionPreference = 'Stop'

$p = 'c:\Users\otabek\Desktop\avlodona\src\components\feed\PostCard.tsx'
$c = Get-Content -Raw -LiteralPath $p

# 1) Ensure Iconify import exists after Heart import
$heartLine = "import { Heart } from 'lucide-react';"
$iconImport = "import { Icon } from '@iconify/react';"

if ($c -notlike "*$heartLine*") { throw "Heart import not found" }

if ($c -notlike "*$iconImport*") {
  $c = $c.Replace($heartLine, $heartLine + "`r`n`r`n" + $iconImport)
}

# 2) Insert location parsing block after timeAgo
$timeAgoLine = '  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });'
if ($c -notlike "*$timeAgoLine*") { throw "timeAgo line not found" }

if ($c -notmatch 'const locationLine = post\.content\?\.match') {
  $insert = @'

  const locationLine = post.content?.match(/(?:^|\n)📍\s*(.+)\s*$/m)?.[1]?.trim() || '';
  const locationParts = locationLine.split('||').map((p) => p.trim()).filter(Boolean);
  const locationText = locationParts[0] || '';
  const coordsPart = locationParts[1] || '';
  const coordsMatch = coordsPart.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  const lat = coordsMatch?.[1] || '';
  const lon = coordsMatch?.[2] || '';
  const mapUrl = locationText
    ? (lat && lon
        ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lon}`)}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationText)}`)
    : '';

  const contentWithoutLocation = post.content
    ? post.content.replace(/(?:\n|^)📍\s*.+\s*$/m, '').trim()
    : post.content;
'@

  $c = $c.Replace($timeAgoLine, $timeAgoLine + $insert)
}

# 3) Replace caption/time block with time+location (before caption) and caption without location
$old = @"
          {post.content && (
            <PostCaption
              username={post.author?.username || 'user'}
              content={post.content}
              postId={post.id}
            />
          )}

          <p className=\"text-xs text-muted-foreground uppercase\">{timeAgo}</p>
"@

if ($c -notlike "*$old*") { throw "Old caption/time block not found" }

$new = @'
          <div className=\"flex items-center justify-between gap-2\">
            <p className=\"text-xs text-muted-foreground uppercase\">{timeAgo}</p>
            {locationText && mapUrl && (
              <a
                href={mapUrl}
                target=\"_blank\"
                rel=\"noreferrer\"
                className=\"flex items-center gap-1 text-xs text-muted-foreground min-w-0 max-w-[55%] hover:text-foreground transition-colors\"
                title={locationText}
              >
                <Icon icon=\"gis:location-poi\" className=\"h-3.5 w-3.5 flex-shrink-0\" />
                <span className=\"truncate\">{locationText}</span>
              </a>
            )}
          </div>

          {contentWithoutLocation && (
            <PostCaption
              username={post.author?.username || 'user'}
              content={contentWithoutLocation}
              postId={post.id}
            />
          )}
'@

$c = $c.Replace($old, $new)

Set-Content -LiteralPath $p -Value $c -Encoding UTF8 -NoNewline
Write-Host "Updated: $p"