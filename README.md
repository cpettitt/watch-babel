# watch-babel

Watch for changes to ES6 javascript files and transpile them to ES5.

## Getting Started

Install `watch-babel` via `NPM`:

```
npm install watch-babel
```

Then require it to use it:

```js
var watchBabel = require("watch-babel");

var srcDir = ".";
var destDir = "/tmp/watchBabel";
var options = { glob: "**/*.js" };
var watcher = watchBabel(srcDir, destDir, options);
watcher.on("ready", function() { console.log("ready"); });
watcher.on("success", function(filepath) {
  console.log("Transpiled ", filepath);
});
watcher.on("failure", function(filepath, e) {
  console.log("Failed to transpile", filepath, "(Error: ", e);
});
watcher.on("delete", function(filepath) {
  console.log("Deleted file", filepath);
});
```

By default watchBabel is persistent, which means it will run even after the
initial transpile pass. You can close the watcher with `watcher.close()`.

## API

### `watchBabel(srcDir, destDir, [options])`

- `srcDir` is the source directory to watch.
- `destDir` is the path to the destination directory. The directory will be
  created if it does not already exist.
- `options` is an optional set of configuration entries, as described in the
  Options section below.

#### Options

- `persistent` (default: `true`). If `true` continue to watch the srcDir for
  changes after the initial transpilation. To close a persistent watcher use
  `watcher.close()`.
- `delete` (default: `false`). When `true` a delete of a file in `srcDir` after
  the `ready` event will cause the associated file in `destDir` to be removed.

#### Events

- `ready` is fired after the initial transpilation pass.
- `success` is fired when transpilation of a file succeeded.
- `failure` is fired when transpilation of a file failed.
- `delete` is fired when a file is deleted.
- `error` is fired if setting up the watcher failed.

### `watchBabel.version()`

Returns the version of the `watchBabel` library.
