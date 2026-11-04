import '../../../../src/app.css';
import { mount } from 'svelte';
import { applyTheme } from '../../shared/data.js';
import App from './App.svelte';

applyTheme();
mount(App, { target: document.getElementById('app')! });
