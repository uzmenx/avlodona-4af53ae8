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

export async function playExclusiveAudio(key: AudioKey, el: HTMLMediaElement) {
  if (!el) return;
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
    await el.play();
  } catch {
    // ignore
  }
}

export function isActiveAudio(key: AudioKey) {
  return state.key === key;
}
