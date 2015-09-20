"use strict";

var defaults = require("lodash/object/defaults");
var expect = require("chai").expect;
var fs = require("fs-extra");
var path = require("path");
var vm = require("vm");
var watchBabel = require("./");

describe("watchBabel", function() {
  var nextId = 0;
  var tempRoot;
  var testSrcDir;
  var testDestDir;
  var createdWatchers;

  beforeEach(function(done) {
    tempRoot = path.join("tmp", String(nextId++));
    fs.removeSync(tempRoot);
    fs.mkdirsSync(tempRoot);

    testSrcDir = path.join(tempRoot, "src");
    fs.mkdirSync(testSrcDir);

    testDestDir = path.join(tempRoot, "dest");
    fs.mkdirsSync(testDestDir);

    createdWatchers = [];

    // I've observed an apparent race occassionally on OSX where we copy the
    // test-fs directory synchronously above, add a watcher in tests below, and
    // get duplicated watch events. I've only reproduced this with `useFsEvents
    // = true`, so it may be a problem with fsevents. For now, this incredibly
    // lame timeout seems to have stabilized the tests.
    setTimeout(function() { done(); }, 10);
  });

  afterEach(function() {
    createdWatchers.forEach(function(watcher) {
      watcher.close();
    });
  });

  it("exposes the srcDir property", function() {
    expect(createWatcher(testSrcDir, testDestDir, { peristent: false }).srcDir)
      .equals(testSrcDir);
  });

  it("exposes the destDir property", function() {
    expect(createWatcher(testSrcDir, testDestDir, { peristent: false }).destDir)
      .equals(testDestDir);
  });

  it("runs babel on existing files before 'ready' event", function(done) {
    fs.writeFileSync(path.join(testSrcDir, "script.js"), "const x = 10;");
    createWatcher(testSrcDir, testDestDir, { persistent: false })
      .on("ready", function() {
        expect(runScript("script.js").x).equals(10);
        done();
      });
  });

  it("runs babel on new files after 'ready' event", function(done) {
    createWatcher(testSrcDir, testDestDir)
      .on("ready", function() {
        this.on("success", function(fp) {
          expect(fp).equals("script.js");
          expect(runScript("script.js").x).equals(10);
          done();
        });
        fs.writeFileSync(path.join(testSrcDir, "script.js"), "const x = 10;");
      });
  });

  it("runs babel on updated files after 'ready' event", function(done) {
    fs.writeFileSync(path.join(testSrcDir, "script.js"), "const x = 10;");
    createWatcher(testSrcDir, testDestDir)
      .on("ready", function() {
        this.on("success", function(fp) {
          expect(fp).equals("script.js");
          expect(runScript("script.js").x).equals(50);
          done();
        });
        fs.writeFileSync(path.join(testSrcDir, "script.js"), "const x = 50;");
      });
  });

  it("deletes removed scripts if delete=true", function(done) {
    fs.writeFileSync(path.join(testSrcDir, "script.js"), "const x = 10;");
    createWatcher(testSrcDir, testDestDir, { delete: true })
      .on("ready", function() {
        this.on("delete", function(fp) {
          expect(fp).equals("script.js");
          expectNotExists("script.js");
          done();
        });
        fs.removeSync(path.join(testSrcDir, "script.js"));
      });
  });

  it("does not delete removed scripts if delete=false", function(done) {
    fs.writeFileSync(path.join(testSrcDir, "script.js"), "const x = 10;");
    createWatcher(testSrcDir, testDestDir, { delete: false })
      .on("ready", function() {
        this.on("delete", function() {
          done(new Error("Should not have deleted file with delete=true"));
          done();
        });
        fs.removeSync(path.join(testSrcDir, "script.js"));
        setTimeout(function() {
          expect(runScript("script.js").x).equals(10);
          done();
        }, 200);
      });
  });

  it("does not replace a file if the change fails transpilation", function(done) {
    fs.writeFileSync(path.join(testSrcDir, "script.js"), "const x = 10;");
    createWatcher(testSrcDir, testDestDir)
      .on("ready", function() {
        this.on("success", function() {
          done(new Error("Should not have changed file with transpilation error"));
        });
        this.on("failure", function(fp) {
          expect(fp).equals("script.js");
          expect(runScript("script.js").x).equals(10);
          done();
        });
        fs.writeFileSync(path.join(testSrcDir, "script.js"), "let const x = 1;");
      });
  });

  function runScript(relativePath) {
    var destFile = path.join(testDestDir, relativePath);
    var sandbox = {};
    var code = fs.readFileSync(destFile, "utf8");
    vm.runInNewContext(code, sandbox);
    return sandbox;
  }

  function expectNotExists(relativePath) {
    expect(function() {
      fs.statSync(path.join(testDestDir, relativePath));
    }).to.throw();
  }

  function createWatcher(srcDir, destDir, opts) {
    opts = defaults(opts || {}, { logLevel: "off" });
    var watcher = watchBabel(srcDir, destDir, opts);
    createdWatchers.push(watcher);
    return watcher;
  }
});

describe("watchBabel.version", function() {
  it("returns the current version in package.json", function() {
    var version = JSON.parse(fs.readFileSync("package.json")).version;
    expect(watchBabel.version).equals(version);
  });
});

