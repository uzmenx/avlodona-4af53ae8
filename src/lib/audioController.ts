type AudioKey = string;

type ControllerState = {
  key: AudioKey | null;
  el: HTMLMediaElement | null;
};

const state: ControllerState = {
  key: null,
  el: null,
};

export function stopActiveAudio(exceptKey?: AudioKey) {
  if (!state.el) return;
  if (exceptKey && state.key === exceptKey) return;
  try {
    state.el.pause();
  } catch {
    // ignore
  }
  state.el = null;
  state.key = null;
}

export async function playExclusiveAudio(key: AudioKey, el: HTMLMediaElement): Promise<boolean> {
  if (!el) return false;
  if (state.el && state.el !== el) {
    try {
      state.el.pause();
    } catch {
      // ignore
    }
  }

  state.el = el;
  state.key = key;

  try {
    el.muted = false;
    el.volume = 1;
  } catch {
    // ignore
  }

  try {
    await el.play();
    return true;
  } catch (err) {
    // If playback fails (autoplay restriction, invalid URL, etc)
    try {
      el.pause();
    } catch {
      // ignore
    }
    if (state.el === el) {
      state.el = null;
      state.key = null;
    }
    console.error('Audio playback failed:', err);
    return false;
  }
}

export function isActiveAudio(key: AudioKey) {
  return state.key === key;
}
