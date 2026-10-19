// PROTOTYPE entry: the shipped page with the annotated answer panel swapped in.
import { mount } from 'svelte';

import '../../src/app.css';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('mount target #app is missing from index.html');

export default mount(App, { target });
