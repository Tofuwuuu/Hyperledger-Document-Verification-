// Imported first in main.jsx. In preview mode, every axios request and every
// fetch to an /api path is rejected before it leaves the browser.
import axios from 'axios';
import { PREVIEW_MODE } from './config';

export class PreviewModeError extends Error {
  constructor() {
    super('Login is turned off in this preview. The code is on GitHub.');
    this.name = 'PreviewModeError';
    this.isPreviewMode = true;
  }
}

if (PREVIEW_MODE) {
  // axios.create() copies defaults at creation time, so instances made after
  // this module runs (services/api.js and others) inherit the blocking adapter.
  axios.defaults.adapter = () => Promise.reject(new PreviewModeError());

  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const realFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const raw = typeof input === 'string' ? input : input?.url || String(input);
      const url = new URL(raw, window.location.href);
      const sameOriginAsset = url.origin === window.location.origin && !url.pathname.startsWith('/api');
      if (!sameOriginAsset) return Promise.reject(new PreviewModeError());
      return realFetch(input, init);
    };
  }
}
