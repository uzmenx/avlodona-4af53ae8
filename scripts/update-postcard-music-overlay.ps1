$ErrorActionPreference = 'Stop'

$path = Join-Path $PSScriptRoot '..\src\components\feed\PostCard.tsx'
if (!(Test-Path $path)) { throw "PostCard.tsx not found: $path" }

$src = Get-Content -Raw -Path $path

function Replace-Once([string]$text, [string]$pattern, [string]$replacement, [string]$label) {
  $new = [regex]::Replace(
    $text,
    $pattern,
    $replacement,
    1,
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  if ($new -eq $text) { throw "Replace failed: $label" }
  return $new
}

# 1) lucide import: remove Pause/Play
$src = Replace-Once $src 'import \{ Heart, Pause, Play \} from ''lucide-react'';' 'import { Heart } from ''lucide-react'';' 'lucide import'

# 2) add imports after usePostLikes
$anchorImport = "import { usePostLikes } from '@/hooks/usePostLikes';"
if ($src -notmatch [regex]::Escape($anchorImport)) { throw 'Anchor import usePostLikes not found' }

$addedImports = @"
$anchorImport

import { MusicOverlay } from '@/components/music/MusicOverlay';
import { playExclusiveAudio, stopActiveAudio } from '@/lib/audioController';
import { useSavedMusic } from '@/hooks/useSavedMusic';
"@

$src = Replace-Once $src ([regex]::Escape($anchorImport)) [regex]::Escape($addedImports.TrimEnd()) 'add overlay imports'

# 3) remove global activePostAudio vars
$src = Replace-Once $src "(?s)\r?\nlet activePostAudio: HTMLAudioElement \| null = null;\r?\nlet activePostAudioPostId: string \| null = null;\r?\n" "`r`n" 'remove activePostAudio globals'

# 4) add useSavedMusic usage after isAudioPlaying state
$stateAnchor = 'const [isAudioPlaying, setIsAudioPlaying] = useState(false);'
if ($src -notmatch [regex]::Escape($stateAnchor)) { throw 'Anchor isAudioPlaying state not found' }
$src = Replace-Once $src ([regex]::Escape($stateAnchor)) ($stateAnchor + "`r`n`r`n  const { isSaved, save, unsave } = useSavedMusic();") 'add useSavedMusic hook'

# 5) stopAudio: remove activePostAudio cleanup block
$src = [regex]::Replace(
  $src,
  "(?s)\r?\n\s*if \(activePostAudioPostId === post\.id\) \{\r?\n\s*activePostAudio = null;\r?\n\s*activePostAudioPostId = null;\r?\n\s*\}\r?\n",
  "`r`n",
  1
)

# 6) playAudio: replace function body with controller version
$playAudioPattern = @'
const playAudio = useCallback\(async \(\) => \{
\s*if \(!post\.audio_url\) return;
\s*if \(!audioRef\.current\) return;

(?s).*?
\}, \[post\.audio_url, post\.id\]\);
'@

$playAudioReplacement = @'
const playAudio = useCallback(async () => {
    if (!post.audio_url) return;
    if (!audioRef.current) return;

    await playExclusiveAudio(`post:${post.id}`, audioRef.current);
    setIsAudioPlaying(!audioRef.current.paused);
  }, [post.audio_url, post.id]);
'@

$src = Replace-Once $src $playAudioPattern $playAudioReplacement 'replace playAudio'

# 7) IntersectionObserver: leaving view -> just stopAudio()
$src = $src -replace 'if \(activePostAudioPostId === post\.id\) stopAudio\(\);', 'stopAudio();'

# observer cleanup block: add stopActiveAudio(...)
$cleanupAnchor = @'
return () => {
      obs.disconnect();
      if (activePostAudioPostId === post.id) stopAudio();
    };
'@

if ($src -match [regex]::Escape($cleanupAnchor)) {
  $cleanupReplacement = @'
return () => {
      obs.disconnect();
      stopActiveAudio(`post:${post.id}`);
      stopAudio();
    };
'@
  $src = $src.Replace($cleanupAnchor, $cleanupReplacement)
}

# 8) remove bottom audio player block in Actions section
$bottomPlayerPattern = @'
(?s)\r?\n\s*\{post\.audio_url && \(\s*\r?\n\s*<div className="flex items-center gap-2.*?</div>\s*\r?\n\s*\)\}\s*\r?\n
'@
$src = Replace-Once $src $bottomPlayerPattern "`r`n" 'remove bottom audio player'

# 9) insert overlay right after MediaCarousel closing "/>"
$needle = "              />`r`n              {showDoubleTapHeart && ("
if ($src -notmatch [regex]::Escape($needle)) { throw 'Needle after MediaCarousel not found' }

$overlayBlock = @'
              />

              {post.audio_url && (
                <div className="absolute bottom-3 right-3 z-30">
                  <MusicOverlay
                    audioTitle={post.audio_title}
                    audioArtist={post.audio_artist}
                    isPlaying={isAudioPlaying}
                    isSaved={isSaved(post.audio_url)}
                    onTogglePlay={() => toggleAudio()}
                    onToggleSave={() => {
                      if (!post.audio_url) return;
                      if (isSaved(post.audio_url)) {
                        void unsave(post.audio_url);
                      } else {
                        void save({
                          audio_url: post.audio_url,
                          audio_title: post.audio_title,
                          audio_artist: post.audio_artist,
                        });
                      }
                    }}
                  />

                  <audio
                    ref={audioRef}
                    src={post.audio_url}
                    preload="none"
                    onPlay={() => setIsAudioPlaying(true)}
                    onPause={() => setIsAudioPlaying(false)}
                    onEnded={() => setIsAudioPlaying(false)}
                  />
                </div>
              )}

              {showDoubleTapHeart && (
'@

$src = Replace-Once $src ([regex]::Escape($needle)) $overlayBlock 'insert overlay block'

Set-Content -Path $path -Value $src -Encoding UTF8
Write-Host "Updated PostCard.tsx successfully" -ForegroundColor Green