/*
 |--------------------------------------------------------------------------
 | Browser-sync config file
 |--------------------------------------------------------------------------
 |
 | For up-to-date information about the options:
 |   http://www.browsersync.io/docs/options/
 |
 | There are more options than you see here, these are just the ones that are
 | set internally. See the website for more info.
 |
 | Or https://github.com/BrowserSync/browser-sync/blob/master/packages/browser-sync/lib/default-config.js
 |
 */
module.exports = {
  files: 'dist',
  watch: true,
  single: true,
  server: 'dist',
  port: 3500,
  open: false,
  reloadOnRestart: true,
  notify: false
};
