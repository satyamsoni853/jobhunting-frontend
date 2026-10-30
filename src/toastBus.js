export const TOAST_EVENT = 'app-toast';

// toast('ok' | 'err' | 'info', 'text'): can be called from anywhere, <Toasts /> renders it
export function toast(type, text) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { type, text } }));
}
