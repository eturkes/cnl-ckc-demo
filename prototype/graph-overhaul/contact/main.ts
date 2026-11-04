import '../../../src/app.css';
import { mount } from 'svelte';
import { applyTheme } from '../shared/data.js';
import Contact from './Contact.svelte';

applyTheme();
mount(Contact, { target: document.getElementById('app')! });
