import { supabase } from '@/integrations/supabase/client';
import { uploadMedia } from '@/lib/r2Upload';

export type PublishTask = {
  id: string;
  userId: string;
  files: File[];
  storyFiles?: File[];
  audioFile?: File | null;
  audioMeta?: {
    audio_url: string;
    audio_title: string;
    audio_artist: string;
  } | null;
  caption: string;
  sharePost: boolean;
  shareStory: boolean;
  ringId: string;
  mentionIds: string[];
  collabIds: string[];
  postCollectionIds?: string[];
  storyHighlightId?: string | null;
  memoryMemberId?: string | null;
};

const ensureYearHighlight = async (userId: string) => {
  const year = new Date().getFullYear().toString();

  const { data: existing, error: findError } = await supabase
    .from('story_highlights')
    .select('id, name')
    .eq('user_id', userId)
    .eq('name', year)
    .maybeSingle();

  if (!findError && existing?.id) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from('story_highlights')
    .insert({ user_id: userId, name: year, cover_url: null, sort_order: 9999 })
    .select('id')
    .single();

  if (createError) throw createError;
  return created.id as string;
};

const addStoryToHighlight = async (highlightId: string, storyId: string, mediaUrl: string, mediaType: string, caption?: string | null) => {
  const { error } = await supabase.from('story_highlight_items').insert({
    highlight_id: highlightId,
    story_id: storyId,
    media_url: mediaUrl,
    media_type: mediaType,
    caption: caption || null,
  });
  if (error) throw error;
};

const mimeForAudio = (audio: File) => {
  const t = audio.type || '';
  if (t) return t;
  const name = audio.name.toLowerCase();
  if (name.endsWith('.mp3')) return 'audio/mpeg';
  if (name.endsWith('.wav')) return 'audio/wav';
  if (name.endsWith('.ogg')) return 'audio/ogg';
  if (name.endsWith('.m4a')) return 'audio/mp4';
  return 'audio/mpeg';
};

const getVideoDurationSeconds = async (file: File): Promise<number> => {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.src = url;
    video.preload = 'metadata';
    await new Promise<void>((resolve, reject) => {
      const ok = () => resolve();
      const err = () => reject(new Error('video load error'));
      video.addEventListener('loadedmetadata', ok, { once: true });
      video.addEventListener('error', err, { once: true });
      try {
        video.load();
      } catch {}
    });
    const d = Number.isFinite(video.duration) ? video.duration : 0;
    return d > 0 ? d : 0;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const recordVideoSegment = async (file: File, startSec: number, endSec: number): Promise<File> => {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.src = url;
    video.preload = 'auto';
    (video as any).playsInline = true;
    video.muted = false;

    await new Promise<void>((resolve, reject) => {
      const ok = () => resolve();
      const err = () => reject(new Error('video load error'));
      video.addEventListener('loadedmetadata', ok, { once: true });
      video.addEventListener('error', err, { once: true });
      try {
        video.load();
      } catch {}
    });

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };

      video.addEventListener('seeked', onSeeked);
      try {
        video.currentTime = Math.max(0, startSec);
      } catch {
        done();
      }
    });

    const stream = (video as any).captureStream?.() as MediaStream | undefined;
    if (!stream) return file;

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm');

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const done = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });

    recorder.start(250);
    await video.play().catch(() => undefined);

    await new Promise<void>((resolve) => {
      const stopIfPastEnd = () => {
        if (video.currentTime >= endSec || video.ended) {
          video.removeEventListener('timeupdate', stopIfPastEnd);
          resolve();
        }
      };
      video.addEventListener('timeupdate', stopIfPastEnd);
      stopIfPastEnd();
    });

    try {
      video.pause();
    } catch {}
    recorder.stop();

    const blob = await done;
    return new File([blob], `story-${Date.now()}-${Math.round(startSec)}.webm`, { type: 'video/webm' });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const splitVideoForStory = async (file: File, segmentSeconds = 60): Promise<File[]> => {
  const duration = await getVideoDurationSeconds(file);
  if (!duration || duration <= segmentSeconds) return [file];
  const segments: File[] = [];
  for (let s = 0; s < duration; s += segmentSeconds) {
    const seg = await recordVideoSegment(file, s, Math.min(duration, s + segmentSeconds));
    segments.push(seg);
  }
  return segments.length > 0 ? segments : [file];
};

const mixAudioIntoVideo = async (videoFile: File, audioFile: File): Promise<File> => {
  const videoUrl = URL.createObjectURL(videoFile);
  const audioUrl = URL.createObjectURL(audioFile);

  try {
    const videoEl = document.createElement('video');
    videoEl.src = videoUrl;
    videoEl.crossOrigin = 'anonymous';
    (videoEl as any).playsInline = true;
    videoEl.preload = 'auto';
    videoEl.muted = false;
    videoEl.volume = 0;

    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => resolve();
      const onErr = () => reject(new Error('video load error'));
      videoEl.addEventListener('loadedmetadata', onLoaded, { once: true });
      videoEl.addEventListener('error', onErr, { once: true });
      try { videoEl.load(); } catch {}
    });

    const w = videoEl.videoWidth || 720;
    const h = videoEl.videoHeight || 1280;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return videoFile;

    const canvasStream = (canvas as any).captureStream?.(30) as MediaStream;
    const videoTrack = canvasStream?.getVideoTracks?.()[0];

    let mixedStream: MediaStream;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const destination = audioCtx.createMediaStreamDestination();

      const audioEl = document.createElement('audio');
      audioEl.src = audioUrl;
      audioEl.crossOrigin = 'anonymous';
      audioEl.preload = 'auto';

      // Decode/playback pipeline requires a user gesture in some browsers; background publish usually starts from a user click.
      await new Promise<void>((resolve, reject) => {
        const ok = () => resolve();
        const err = () => reject(new Error('audio load error'));
        audioEl.addEventListener('canplay', ok, { once: true });
        audioEl.addEventListener('error', err, { once: true });
        try { audioEl.load(); } catch {}
      });

      const audioSource = audioCtx.createMediaElementSource(audioEl);
      const gain = audioCtx.createGain();
      gain.gain.value = 0.35;
      audioSource.connect(gain);
      gain.connect(destination);

      mixedStream = new MediaStream([
        ...(videoTrack ? [videoTrack] : []),
        ...destination.stream.getAudioTracks(),
      ]);

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm');

      const recorder = new MediaRecorder(mixedStream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      });

      recorder.start(250);

      let raf = 0;
      const draw = () => {
        ctx.drawImage(videoEl, 0, 0, w, h);
        if (!videoEl.ended) raf = requestAnimationFrame(draw);
      };

      await videoEl.play().catch(() => undefined);
      await audioEl.play().catch(() => undefined);
      raf = requestAnimationFrame(draw);

      await new Promise<void>((resolve) => {
        const end = () => resolve();
        videoEl.addEventListener('ended', end, { once: true });
      });

      cancelAnimationFrame(raf);
      recorder.stop();
      const blob = await done;
      return new File([blob], `mixed-${Date.now()}.webm`, { type: 'video/webm' });
    } catch {
      return videoFile;
    }
  } finally {
    URL.revokeObjectURL(videoUrl);
    URL.revokeObjectURL(audioUrl);
  }
};

type PublishProgressEvent = {
  taskId: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  message?: string;
};

const emitter = new EventTarget();

export const onPublishProgress = (handler: (e: PublishProgressEvent) => void) => {
  const listener = (evt: Event) => handler((evt as CustomEvent<PublishProgressEvent>).detail);
  emitter.addEventListener('publish-progress', listener);
  return () => emitter.removeEventListener('publish-progress', listener);
};

const emit = (detail: PublishProgressEvent) => {
  emitter.dispatchEvent(new CustomEvent('publish-progress', { detail }));
};

export const startBackgroundPublish = (task: PublishTask) => {
  void runPublish(task);
};

const runPublish = async (task: PublishTask) => {
  try {
    if (!task.sharePost && !task.shareStory) {
      emit({ taskId: task.id, progress: 0, status: 'error', message: 'Post yoki Story-dan kamida birini tanlang' });
      return;
    }

    emit({ taskId: task.id, progress: 5, status: 'uploading' });

    const storyInputFiles = Array.isArray(task.storyFiles) && task.storyFiles.length > 0 ? task.storyFiles : task.files.slice(0, 1);
    const total = (task.sharePost ? task.files.length : 0) + (task.shareStory ? storyInputFiles.length : 0) + 1 + (task.audioFile ? 1 : 0);
    let done = 0;
    const tick = () => {
      done += 1;
      const next = Math.min(95, Math.round((done / total) * 90) + 5);
      emit({ taskId: task.id, progress: next, status: 'uploading' });
    };

    // Upload audio file (optional)
    let audioUrl: string | null = null;
    if (task.audioFile) {
      audioUrl = await uploadMedia(new File([task.audioFile], task.audioFile.name, { type: mimeForAudio(task.audioFile) }), 'audio', task.userId);
      tick();
    }

    let postUrls: string[] = [];
    if (task.sharePost) {
      const uploads = await Promise.all(
        task.files.map(async (f) => {
          let fileToUpload = f;
          if (audioUrl && f.type.startsWith('video/')) {
            try {
              fileToUpload = await mixAudioIntoVideo(f, task.audioFile as File);
            } catch {
              fileToUpload = f;
            }
          }
          const url = await uploadMedia(fileToUpload, 'posts', task.userId);
          tick();
          return url;
        })
      );
      postUrls = uploads.filter(Boolean);

      // If we uploaded audio separately, keep it as part of post media urls as well.
      if (audioUrl) postUrls = [...postUrls, audioUrl];
    }

    const storyUrls: { url: string; mediaType: 'image' | 'video' }[] = [];
    if (task.shareStory) {
      for (const baseFile of storyInputFiles) {
        const isVideo = baseFile.type.startsWith('video/');
        let candidates: File[] = [baseFile];
        if (isVideo) {
          candidates = await splitVideoForStory(baseFile, 60);
        }

        for (const c of candidates) {
          let fileToUpload = c;
          if (audioUrl && c.type.startsWith('video/')) {
            try {
              fileToUpload = await mixAudioIntoVideo(c, task.audioFile as File);
            } catch {
              fileToUpload = c;
            }
          }
          const url = await uploadMedia(fileToUpload, 'stories', task.userId);
          storyUrls.push({ url, mediaType: (fileToUpload.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video' });
        }

        tick();
      }
    }

    if (task.sharePost && postUrls.length > 0) {
      const { data: post, error } = await supabase
        .from('posts')
        .insert({
          user_id: task.userId,
          content: task.caption || null,
          media_urls: postUrls,
          audio_url: task.audioMeta?.audio_url ?? null,
          audio_title: task.audioMeta?.audio_title ?? null,
          audio_artist: task.audioMeta?.audio_artist ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      if (post) {
        const captionMentions = (task.caption.match(/@(\w+)/g) || []).map((m) => m.slice(1));
        const allMentionIds = [...task.mentionIds];
        if (captionMentions.length > 0) {
          const { data: mp } = await supabase.from('profiles').select('id, username').in('username', captionMentions);
          if (mp) {
            for (const p of mp) {
              if (p.id !== task.userId && !allMentionIds.includes(p.id)) allMentionIds.push(p.id);
            }
          }
        }
        if (allMentionIds.length > 0) {
          await supabase
            .from('post_mentions')
            .insert(allMentionIds.map((uid) => ({ post_id: post.id, mentioned_user_id: uid })));
        }
        
        // Add memory post mention
        if (task.memoryMemberId) {
          await supabase
            .from('post_mentions')
            .insert({ post_id: post.id, family_member_id: task.memoryMemberId });
        }

        if (task.collabIds.length > 0) {
          await supabase.from('post_collabs').insert(task.collabIds.map((uid) => ({ post_id: post.id, user_id: uid })));
        }

        if (Array.isArray(task.postCollectionIds) && task.postCollectionIds.length > 0) {
          for (const colId of task.postCollectionIds) {
            await supabase.from('post_collection_items').insert({ collection_id: colId, post_id: post.id });
          }
        }
      }

      tick();
    }

    if (task.shareStory && storyUrls.length > 0) {
      for (const s of storyUrls) {
        const { data: story, error } = await supabase
          .from('stories')
          .insert({
            user_id: task.userId,
            media_url: s.url,
            media_type: s.mediaType,
            caption: task.caption || null,
            ring_id: task.ringId,
            audio_url: task.audioMeta?.audio_url ?? null,
            audio_title: task.audioMeta?.audio_title ?? null,
            audio_artist: task.audioMeta?.audio_artist ?? null,
          })
          .select('id')
          .single();

        if (error) throw error;

        try {
          const yearHighlightId = await ensureYearHighlight(task.userId);
          await addStoryToHighlight(yearHighlightId, story.id, s.url, s.mediaType, task.caption || null);

          if (task.storyHighlightId) {
            await addStoryToHighlight(task.storyHighlightId, story.id, s.url, s.mediaType, task.caption || null);
          }
        } catch (e) {
          console.error('Story highlight autosave error:', e);
        }

        tick();
      }
    }

    emit({ taskId: task.id, progress: 100, status: 'success' });
  } catch (err: any) {
    emit({ taskId: task.id, progress: 0, status: 'error', message: err?.message || 'Yuklashda xatolik yuz berdi' });
  }
};
