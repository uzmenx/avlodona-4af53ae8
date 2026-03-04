$ErrorActionPreference = 'Stop'

$path = Join-Path $PSScriptRoot '..\src\components\feed\PostCard.tsx'
if (!(Test-Path $path)) { throw "PostCard.tsx not found: $path" }

$src = Get-Content -Raw -Path $path

function Replace-Once([string]$text, [string]$pattern, [string]$replacement, [string]$label) {
  $new = [regex]::Replace($text, $pattern, $replacement, 1, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($new -eq $text) { throw "Replace failed: $label" }
  return $new
}

# 1) Imports: lucide-react -> only Heart
$src = Replace-Once $src "import \{ Heart, Pause, Play \} from 'lucide-react';" "import { Heart } from 'lucide-react';" 'lucide import'

# 2) Add MusicOverlay + controller + saved hook imports after usePostLikes
$insertAfter = "import { usePostLikes } from '@/hooks/usePostLikes';"
if ($src -notmatch [regex]::Escape($insertAfter)) { throw 'Anchor import usePostLikes not found' }
$addition = "$insertAfter`r`n`r`nimport { MusicOverlay } from '@/components/music/MusicOverlay';`r`nimport { playExclusiveAudio, stopActiveAudio } from '@/lib/audioController';`r`nimport { useSavedMusic } from '@/hooks/useSavedMusic';"
$src = Replace-Once $src ([regex]::Escape($insertAfter)) [regex]::Escape($addition) 'add overlay imports'

# 3) Remove global activePostAudio variables
$src = Replace-Once $src "\r?\nlet activePostAudio: HTMLAudioElement \| null = null;\r?\nlet activePostAudioPostId: string \| null = null;\r?\n" "`r`n" 'remove activePostAudio globals'

# 4) Add useSavedMusic hook usage after isAudioPlaying state
$anchorState = "const [isAudioPlaying, setIsAudioPlaying] = useState(false);"
if ($src -notmatch [regex]::Escape($anchorState)) { throw 'Anchor isAudioPlaying state not found' }
$src = Replace-Once $src ([regex]::Escape($anchorState)) ($anchorState + "`r`n`r`n  const { isSaved, save, unsave } = useSavedMusic();") 'add useSavedMusic'

# 5) stopAudio: remove activePostAudio cleanup block
$src = Replace-Once $src "\r?\n\s*if \(activePostAudioPostId === post\.id\) \{\r?\n\s*activePostAudio = null;\r?\n\s*activePostAudioPostId = null;\r?\n\s*\}\r?\n" "`r`n" 'strip active cleanup in stopAudio'

# 6) playAudio: replace try/catch block with playExclusiveAudio
$patternPlay = "const playAudio = useCallback\(async \(\) => \{\s*\r?\n\s*if \(!post\.audio_url\) return;\s*\r?\n\s*if \(!audioRef\.current\) return;\s*\r?\n\s*try \{[\s\S]*?\}\s*catch \{[\s\S]*?\}\s*\r?\n\s*\}, \[post\.audio_url, post\.id\]\);"
$replacementPlay = @'
const playAudio = useCallback(async () => {
    if (!post.audio_url) return;
    if (!audioRef.current) return;

    await playExclusiveAudio(`post:${post.id}`, audioRef.current);
    setIsAudioPlaying(!audioRef.current.paused);
  }, [post.audio_url, post.id]);
'@
$src = Replace-Once $src $patternPlay $replacementPlay 'replace playAudio'

# 7) IntersectionObserver cleanup: replace activePostAudioPostId checks
$src = $src -replace "if \(activePostAudioPostId === post\.id\) stopAudio\(\);", "stopAudio();"
$src = $src -replace "if \(activePostAudioPostId === post\.id\) stopAudio\(\);", "stopAudio();"

# Return cleanup: replace final cleanup line
$src = $src -replace "\r?\n\s*if \(activePostAudioPostId === post\.id\) stopAudio\(\);", "`r`n      stopActiveAudio(`"post:$($null)`");" # placeholder to ensure pattern not used
# Instead do a targeted replace using an anchor block
$cleanupAnchor = "return () => {`r`n      obs.disconnect();`r`n      if (activePostAudioPostId === post.id) stopAudio();`r`n    };"
if ($src -match [regex]::Escape($cleanupAnchor)) {
  $src = $src.Replace($cleanupAnchor, "return () => {`r`n      obs.disconnect();`r`n      stopActiveAudio(`"post:${post.id}`");`r`n      stopAudio();`r`n    };")
} else {
  # fallback: simpler replace
  $src = $src -replace "obs\.disconnect\(\);\r?\n\s*if \(activePostAudioPostId === post\.id\) stopAudio\(\);", "obs.disconnect();`r`n      stopActiveAudio(`"post:${post.id}`");`r`n      stopAudio();"
}

# 8) Remove bottom audio player block in Actions section (the big {post.audio_url && ( ... )})
$patternBottomPlayer = "\r?\n\s*\{post\.audio_url && \(\r?\n\s*<div className=\"flex items-center gap-2[\s\S]*?<\/div>\r?\n\s*\)\}\r?\n"
$src = Replace-Once $src $patternBottomPlayer "`r`n" 'remove bottom audio player'

# 9) Add overlay inside media relative container right after </MediaCarousel> block
$needle = "              />\r\n              {showDoubleTapHeart && ("
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

# 10) Ensure stopActiveAudio is imported/used: update cleanup in observer effect
$src = $src -replace "if \(activePostAudioPostId === post\.id\) stopAudio\(\);", "stopAudio();"
$src = $src -replace "\r?\n\s*return \(\) => \{\r?\n\s*obs\.disconnect\(\);\r?\n\s*if \(activePostAudioPostId === post\.id\) stopAudio\(\);\r?\n\s*\};",
  "\r\n    return () => {\r\n      obs.disconnect();\r\n      stopActiveAudio(`\"post:${post.id}`\");\r\n      stopAudio();\r\n    };"

Set-Content -Path $path -Value $src -Encoding UTF8
Write-Host "Updated PostCard.tsx successfully" -ForegroundColor Green
