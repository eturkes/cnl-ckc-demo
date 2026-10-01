// App restores `?q=` on mount, so a URL one test leaves behind would preselect a question in the
// next; every dom test starts at the bare origin.

import { beforeEach } from 'vitest';

beforeEach(() => {
  history.replaceState(null, '', '/');
});
