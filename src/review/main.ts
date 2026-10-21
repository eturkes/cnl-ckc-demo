import { mount } from 'svelte';

import ComparisonReview from './ComparisonReview.svelte';
import '../app.css';

const target = document.getElementById('review');
if (!target) throw new Error('mount target #review is missing from review.html');

export default mount(ComparisonReview, { target });
