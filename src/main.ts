import { mount } from 'svelte';

import App from './App.svelte';
import './app.css';

const target = document.getElementById('app');
if (!target) throw new Error('mount target #app is missing from index.html');

// Offline caching is a build concern: the dev server serves unhashed modules a cache would pin.
// A failed registration leaves the online page whole, so it is dropped rather than surfaced.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}

export default mount(App, { target });
