import 'lit';
import '@webcomponents-preview/client';
import './index.js';

if (typeof EventSource !== 'undefined') {
  fetch('/esbuild', { mode: 'no-cors', headers: { accept: 'text/event-stream' } }).then(() => {
    new EventSource('/esbuild').addEventListener('change', () => location.reload());
  });
}
