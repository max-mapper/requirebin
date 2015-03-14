var events = require('events');
var extend = require('extend');
var CodeMirror = require('codemirror');
require('./codemirror_modes/xml.js')(CodeMirror);
require('./codemirror_modes/css.js')(CodeMirror);
require('./codemirror_modes/javascript.js')(CodeMirror);
require('./codemirror_modes/htmlmixed.js')(CodeMirror);

function Editor(opts) {
  var self = this;
  opts = opts || {};
  if (!opts.container) opts.container = document.body;
  var defaults = {
    value: "<h1>Hello world</h1>",
    mode: "htmlmixed",
    lineNumbers: true,
    autofocus: (window === window.top),
    matchBrackets: true,
    indentWithTabs: false,
    smartIndent: true,
    tabSize: 2,
    indentUnit: 2,
    updateInterval: 500
  }
  this.name = opts.name;
  this.opts = extend({}, defaults, opts)
  this.editor = CodeMirror( this.opts.container, this.opts )
  this.editor.setOption("theme", "mistakes") // borrowed from mistakes.io
  this.editor.setCursor(this.editor.lineCount(), 0)
  this.editor.on('change', function (e) {
    self.emit('change', self)
  })
}

Editor.prototype = Object.create(events.EventEmitter.prototype);

Editor.prototype.getValue = function() {
  return this.editor.getValue()
}

Editor.prototype.setValue = function(value) {
  return this.editor.setValue(value)
}

module.exports = Editor;

module.exports.factory = function (opts) {
  return new Editor(opts);
};