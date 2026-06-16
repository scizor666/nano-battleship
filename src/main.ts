import { createApp } from './ui/app.ts';

const root = document.querySelector('#app');
if (!(root instanceof HTMLElement)) {
  throw new Error('Missing #app root element');
}

createApp(root);
