// Paths are written for prototype/graph-overhaul/variants/<id>/ — copy, never run in place.
import '../../../../src/app.css';
import { mount } from 'svelte';
import { applyTheme } from '../../shared/data.js';
import App from './App.svelte';

applyTheme();
mount(App, { target: document.getElementById('app')! });
