import atImport from 'postcss-import';

import breakpoints from './packages/ui/scripts/postcss-breakpoints.js';

// vite picks this up for every css it processes, in both packages
export default { plugins: [atImport(), breakpoints()] };
