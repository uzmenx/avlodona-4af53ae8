import { supabase } from '@/integrations/supabase/client';
import { uploadMedia } from '@/lib/r2Upload';

export type PublishTask = {
  id: string;
  userId: string;
  files: File[];
  audioFile?: File | null;
  caption: string;
  sharePost: boolean;
  shareStory: boolean;
  ringId: string;
  mentionIds: string[];
  collabIds: string[];
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

    const total = (task.sharePost ? task.files.length : 0) + (task.shareStory ? 1 : 0) + 1 + (task.audioFile ? 1 : 0);
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

    let storyUrl: string | null = null;
    if (task.shareStory) {
      let fileToUpload = task.files[0];
      if (audioUrl && task.files[0]?.type.startsWith('video/')) {
        try {
          fileToUpload = await mixAudioIntoVideo(task.files[0], task.audioFile as File);
        } catch {
          fileToUpload = task.files[0];
        }
      }
      storyUrl = await uploadMedia(fileToUpload, 'stories', task.userId);
      tick();
    }

    if (task.sharePost && postUrls.length > 0) {
      const { data: post, error } = await supabase
        .from('posts')
        .insert({
          user_id: task.userId,
          content: task.caption || null,
          media_urls: postUrls,
        })
        .select()
        .single();

      if (error) throw error;

      if (post) {
        const captionMentions = (task.caption.match(/@(\w+)/g) || []).map((m) => m.slice(1));
        let allMentionIds = [...task.mentionIds];
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
        if (task.collabIds.length > 0) {
          await supabase.from('post_collabs').insert(task.collabIds.map((uid) => ({ post_id: post.id, user_id: uid })));
        }
      }

      tick();
    }

    if (task.shareStory && storyUrl) {
      const mediaType = task.files[0].type.startsWith('video/') ? 'video' : 'image';
      const { error } = await supabase.from('stories').insert({
        user_id: task.userId,
        media_url: storyUrl,
        media_type: mediaType,
        caption: task.caption || null,
        ring_id: task.ringId,
      });
      if (error) throw error;
      tick();
    }

    emit({ taskId: task.id, progress: 100, status: 'success' });
  } catch (err: any) {
    emit({ taskId: task.id, progress: 0, status: 'error', message: err?.message || 'Yuklashda xatolik yuz berdi' });
  }
};
