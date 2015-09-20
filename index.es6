// Get stack traces that point to the original ES6 code.
import "source-map-support/register";

if (typeof _babelPolyfill === "undefined") {
  // Include babel polyfill
  require("babel/polyfill");
}

// Babel does not expose a proper main entry in its package.json. It seems that
// this causes the es6 import to fail.
const babel = require("babel-core");

import arrify from "arrify";
import chokidar from "chokidar";
import defaults from "lodash/object/defaults";
import fs from "fs-extra";
import path from "path";
import { EventEmitter } from "events";
import { Logger } from "eazy-logger";

const DEFAULT_OPTS = {
  logLevel: "off",
  persistent: true,
  delete: true,
  babel: {}
};

class BabelWatcher extends EventEmitter {
  constructor(srcDir, destDir, opts) {
    super();

    opts = defaults(opts || {}, DEFAULT_OPTS);
    this._srcDir = srcDir;
    this._destDir = destDir;

    this._logger = new Logger({
      level: opts.logLevel,
      prefix: "[{blue:watch-babel}] "
    });

    // Have we hit the ready state?
    this._ready = false;

    this._delete = opts.delete;
    this._babelOpts = opts.babel;

    const globs = arrify(opts.glob || ".");

    const chokidarOpts = {
      cwd: srcDir,
      persistent: opts.persistent
    };

    this._watcher = chokidar.watch(globs, chokidarOpts)
      .on("all", (e, p, s) => this._handleWatchEvent(e, p, s))
      .on("error", e => this._handleError(e))
      .on("ready", () => this._handleReady());
  }

  get ready() {
    return this._ready;
  }

  get srcDir() {
    return this._srcDir;
  }

  get destDir() {
    return this._destDir;
  }

  close() {
    this._watcher.close();
    this.removeAllListeners();
  }

  _handleReady() {
    this._ready = true;
    this._logger.info("{cyan:Watching} {magenta:%s}", this._srcDir);
    this.emit("ready");
  }

  _handleError(e) {
    this._logger.error("{red:Error: %s}", e);
    this.emit("error", e);
  }

  _handleWatchEvent(event, filePath) {
    if (!filePath.length) {
      filePath = ".";
    }
    const srcPath = path.join(this._srcDir, filePath);
    const destPath = path.join(this._destDir, filePath);

    switch (event) {
      case "add":
      case "change":
        let result;
        try {
          result = babel.transformFileSync(srcPath, this._babelOpts);
        } catch (e) {
          const frameDetails = e.codeFrame ? `\n${e.codeFrame}` : "";
          this._logger.error("{cyan:Transpilation {red:failed} for {red:%s}} " +
              "({magenta:%s} -> {magenta:%s}):\n{red:%s%s",
              filePath, this._srcDir, this._destDir, e, frameDetails);
          this.emit("failure", filePath, e);
          return;
        }

        // TODO handle external source maps
        fs.outputFileSync(destPath, result.code);
        this._logger.debug("{cyan:Transpiled} {green:%s} ({magenta:%s} -> {magenta:%s})",
            filePath, this._srcDir, this._destDir);
        this.emit("success", filePath);
        break;
      case "unlink":
        if (!this._delete) {
          return;
        }
        fs.removeSync(destPath);
        this._logger.debug("{cyan:Deleted} {green:%s} ({magenta:%s} -> {magenta:%s})",
            filePath, this._srcDir, this._destDir);
        this.emit("delete", filePath);
        break;
      case "unlinkDir":
        if (!this._delete) {
          return;
        }
        fs.removeSync(destPath);
        break;
    }
  }
}

function watchBabel(src, dest, opts) {
  return new BabelWatcher(src, dest, opts);
}
// Read version in from package.json
watchBabel.version = require("./package.json").version;

export default watchBabel;
