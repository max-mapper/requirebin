(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/node_modules/jsonp/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {}
});

require.define("/node_modules/jsonp/index.js",function(require,module,exports,__dirname,__filename,process,global){
/**
 * Module dependencies
 */

var debug = require('debug')('jsonp');

/**
 * Module exports.
 */

module.exports = jsonp;

/**
 * Callback index.
 */

var count = 0;

/**
 * Noop function.
 */

function noop(){};

/**
 * JSONP handler
 *
 * Options:
 *  - param {String} qs parameter (`callback`)
 *  - timeout {Number} how long after a timeout error is emitted (`60000`)
 *
 * @param {String} url
 * @param {Object|Function} optional options / callback
 * @param {Function} optional callback
 */

function jsonp(url, opts, fn){
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  var opts = opts || {};
  var param = opts.param || 'callback';
  var timeout = null != opts.timeout ? opts.timeout : 60000;
  var enc = encodeURIComponent;
  var target = document.getElementsByTagName('script')[0];
  var script;
  var timer;

  // generate a unique id for this request
  var id = count++;

  if (timeout) {
    timer = setTimeout(function(){
      cleanup();
      fn && fn(new Error('Timeout'));
    }, timeout);
  }

  function cleanup(){
    target.parentNode.removeChild(script);
    window['__jp' + id] = noop;
  }

  window['__jp' + id] = function(data){
    debug('jsonp got', data);
    if (timer) clearTimeout(timer);
    cleanup();
    fn && fn(null, data);
  };

  // add qs component
  url += (~url.indexOf('?') ? '&' : '?') + param + '=' + enc('__jp' + id + '');
  url = url.replace('?&', '?');

  debug('jsonp req "%s"', url);

  // create script
  script = document.createElement('script');
  script.src = url;
  target.parentNode.insertBefore(script, target);
};

});

require.define("/node_modules/jsonp/node_modules/debug/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"lib/debug.js","browserify":"debug.js"}
});

require.define("/node_modules/jsonp/node_modules/debug/debug.js",function(require,module,exports,__dirname,__filename,process,global){
/**
 * Expose `debug()` as the module.
 */

module.exports = debug;

/**
 * Create a debugger with the given `name`.
 *
 * @param {String} name
 * @return {Type}
 * @api public
 */

function debug(name) {
  if (!debug.enabled(name)) return function(){};

  return function(fmt){
    var curr = new Date;
    var ms = curr - (debug[name] || curr);
    debug[name] = curr;

    fmt = name
      + ' '
      + fmt
      + ' +' + debug.humanize(ms);

    // This hackery is required for IE8
    // where `console.log` doesn't have 'apply'
    window.console
      && console.log
      && Function.prototype.apply.call(console.log, console, arguments);
  }
}

/**
 * The currently active debug mode names.
 */

debug.names = [];
debug.skips = [];

/**
 * Enables a debug mode by name. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} name
 * @api public
 */

debug.enable = function(name) {
  try {
    localStorage.debug = name;
  } catch(e){}

  var split = (name || '').split(/[\s,]+/)
    , len = split.length;

  for (var i = 0; i < len; i++) {
    name = split[i].replace('*', '.*?');
    if (name[0] === '-') {
      debug.skips.push(new RegExp('^' + name.substr(1) + '$'));
    }
    else {
      debug.names.push(new RegExp('^' + name + '$'));
    }
  }
};

/**
 * Disable debug output.
 *
 * @api public
 */

debug.disable = function(){
  debug.enable('');
};

/**
 * Humanize the given `ms`.
 *
 * @param {Number} m
 * @return {String}
 * @api private
 */

debug.humanize = function(ms) {
  var sec = 1000
    , min = 60 * 1000
    , hour = 60 * min;

  if (ms >= hour) return (ms / hour).toFixed(1) + 'h';
  if (ms >= min) return (ms / min).toFixed(1) + 'm';
  if (ms >= sec) return (ms / sec | 0) + 's';
  return ms + 'ms';
};

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

debug.enabled = function(name) {
  for (var i = 0, len = debug.skips.length; i < len; i++) {
    if (debug.skips[i].test(name)) {
      return false;
    }
  }
  for (var i = 0, len = debug.names.length; i < len; i++) {
    if (debug.names[i].test(name)) {
      return true;
    }
  }
  return false;
};

// persist

if (window.localStorage) debug.enable(localStorage.debug);

});

require.define("/node_modules/browser-request/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"browserify":"./dist/ender/request.js"}
});

require.define("/node_modules/browser-request/dist/ender/request.js",function(require,module,exports,__dirname,__filename,process,global){// Browser Request
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var xmlhttprequest = require('./xmlhttprequest')
if(!xmlhttprequest || typeof xmlhttprequest !== 'object')
  throw new Error('Could not find ./xmlhttprequest')

var XHR = xmlhttprequest.XMLHttpRequest
if(!XHR)
  throw new Error('Bad xmlhttprequest.XMLHttpRequest')
if(! ('_object' in (new XHR)))
  throw new Error('This is not portable XMLHttpRequest')

module.exports = request
request.XMLHttpRequest = XHR

var DEFAULT_TIMEOUT = 3 * 60 * 1000 // 3 minutes
  , LOG = getLogger()

//
// request
//

function request(options, callback) {
  // The entry-point to the API: prep the options object and pass the real work to run_xhr.
  if(typeof callback !== 'function')
    throw new Error('Bad callback given: ' + callback)

  if(!options)
    throw new Error('No options given')

  var options_onResponse = options.onResponse; // Save this for later.

  if(typeof options === 'string')
    options = {'uri':options};
  else
    options = JSON.parse(JSON.stringify(options)); // Use a duplicate for mutating.

  options.onResponse = options_onResponse // And put it back.

  if(options.url) {
    options.uri = options.url;
    delete options.url;
  }

  if(!options.uri && options.uri !== "")
    throw new Error("options.uri is a required argument");

  if(typeof options.uri != "string")
    throw new Error("options.uri must be a string");

  var unsupported_options = ['proxy', '_redirectsFollowed', 'maxRedirects', 'followRedirect']
  for (var i = 0; i < unsupported_options.length; i++)
    if(options[ unsupported_options[i] ])
      throw new Error("options." + unsupported_options[i] + " is not supported")

  options.callback = callback
  options.method = options.method || 'GET';
  options.headers = options.headers || {};
  options.body    = options.body || null
  options.timeout = options.timeout || request.DEFAULT_TIMEOUT

  if(options.headers.host)
    throw new Error("Options.headers.host is not supported");

  if(options.json) {
    options.headers.accept = options.headers.accept || 'application/json'
    if(options.method !== 'GET')
      options.headers['content-type'] = 'application/json'

    if(typeof options.json !== 'boolean')
      options.body = JSON.stringify(options.json)
    else if(typeof options.body !== 'string')
      options.body = JSON.stringify(options.body)
  }

  // If onResponse is boolean true, call back immediately when the response is known,
  // not when the full request is complete.
  options.onResponse = options.onResponse || noop
  if(options.onResponse === true) {
    options.onResponse = callback
    options.callback = noop
  }

  // XXX Browsers do not like this.
  //if(options.body)
  //  options.headers['content-length'] = options.body.length;

  // HTTP basic authentication
  if(!options.headers.authorization && options.auth)
    options.headers.authorization = 'Basic ' + b64_enc(options.auth.username + ':' + options.auth.password);

  return run_xhr(options)
}

var req_seq = 0
function run_xhr(options) {
  var xhr = new XHR
    , timed_out = false
    , is_cors = is_crossDomain(options.uri)
    , supports_cors = ('withCredentials' in xhr._object)

  req_seq += 1
  xhr.seq_id = req_seq
  xhr.id = req_seq + ': ' + options.method + ' ' + options.uri
  xhr._id = xhr.id // I know I will type "_id" from habit all the time.

  if(is_cors && !supports_cors) {
    var cors_err = new Error('Browser does not support cross-origin request: ' + options.uri)
    cors_err.cors = 'unsupported'
    return options.callback(cors_err, xhr)
  }

  xhr.timeoutTimer = setTimeout(too_late, options.timeout)
  function too_late() {
    timed_out = true
    var er = new Error('ETIMEDOUT')
    er.code = 'ETIMEDOUT'
    er.duration = options.timeout

    LOG.error('Timeout', { 'id':xhr._id, 'milliseconds':options.timeout })
    return options.callback(er, xhr)
  }

  // Some states can be skipped over, so remember what is still incomplete.
  var did = {'response':false, 'loading':false, 'end':false}

  xhr.onreadystatechange = on_state_change
  xhr.open(options.method, options.uri, true) // asynchronous
  if(is_cors)
    xhr._object.withCredentials = !! options.withCredentials
  xhr.send(options.body)
  return xhr

  function on_state_change(event) {
    if(timed_out)
      return LOG.debug('Ignoring timed out state change', {'state':xhr.readyState, 'id':xhr.id})

    LOG.debug('State change', {'state':xhr.readyState, 'id':xhr.id, 'timed_out':timed_out})

    if(xhr.readyState === XHR.OPENED) {
      LOG.debug('Request started', {'id':xhr.id})
      for (var key in options.headers)
        xhr.setRequestHeader(key, options.headers[key])
    }

    else if(xhr.readyState === XHR.HEADERS_RECEIVED)
      on_response()

    else if(xhr.readyState === XHR.LOADING) {
      on_response()
      on_loading()
    }

    else if(xhr.readyState === XHR.DONE) {
      on_response()
      on_loading()
      on_end()
    }
  }

  function on_response() {
    if(did.response)
      return

    did.response = true
    LOG.debug('Got response', {'id':xhr.id, 'status':xhr.status})
    clearTimeout(xhr.timeoutTimer)
    xhr.statusCode = xhr.status // Node request compatibility

    // Detect failed CORS requests.
    if(is_cors && xhr.statusCode == 0) {
      var cors_err = new Error('CORS request rejected: ' + options.uri)
      cors_err.cors = 'rejected'

      // Do not process this request further.
      did.loading = true
      did.end = true

      return options.callback(cors_err, xhr)
    }

    options.onResponse(null, xhr)
  }

  function on_loading() {
    if(did.loading)
      return

    did.loading = true
    LOG.debug('Response body loading', {'id':xhr.id})
    // TODO: Maybe simulate "data" events by watching xhr.responseText
  }

  function on_end() {
    if(did.end)
      return

    did.end = true
    LOG.debug('Request done', {'id':xhr.id})

    xhr.body = xhr.responseText
    if(options.json) {
      try        { xhr.body = JSON.parse(xhr.responseText) }
      catch (er) { return options.callback(er, xhr)        }
    }

    options.callback(null, xhr, xhr.body)
  }

} // request

request.withCredentials = false;
request.DEFAULT_TIMEOUT = DEFAULT_TIMEOUT;

//
// HTTP method shortcuts
//

var shortcuts = [ 'get', 'put', 'post', 'head' ];
shortcuts.forEach(function(shortcut) {
  var method = shortcut.toUpperCase();
  var func   = shortcut.toLowerCase();

  request[func] = function(opts) {
    if(typeof opts === 'string')
      opts = {'method':method, 'uri':opts};
    else {
      opts = JSON.parse(JSON.stringify(opts));
      opts.method = method;
    }

    var args = [opts].concat(Array.prototype.slice.apply(arguments, [1]));
    return request.apply(this, args);
  }
})

//
// CouchDB shortcut
//

request.couch = function(options, callback) {
  if(typeof options === 'string')
    options = {'uri':options}

  // Just use the request API to do JSON.
  options.json = true
  if(options.body)
    options.json = options.body
  delete options.body

  callback = callback || noop

  var xhr = request(options, couch_handler)
  return xhr

  function couch_handler(er, resp, body) {
    if(er)
      return callback(er, resp, body)

    if((resp.statusCode < 200 || resp.statusCode > 299) && body.error) {
      // The body is a Couch JSON object indicating the error.
      er = new Error('CouchDB error: ' + (body.error.reason || body.error.error))
      for (var key in body)
        er[key] = body[key]
      return callback(er, resp, body);
    }

    return callback(er, resp, body);
  }
}

//
// Utility
//

function noop() {}

function getLogger() {
  var logger = {}
    , levels = ['trace', 'debug', 'info', 'warn', 'error']
    , level, i

  for(i = 0; i < levels.length; i++) {
    level = levels[i]

    logger[level] = noop
    if(typeof console !== 'undefined' && console && console[level])
      logger[level] = formatted(console, level)
  }

  return logger
}

function formatted(obj, method) {
  return formatted_logger

  function formatted_logger(str, context) {
    if(typeof context === 'object')
      str += ' ' + JSON.stringify(context)

    return obj[method].call(obj, str)
  }
}

// Return whether a URL is a cross-domain request.
function is_crossDomain(url) {
  var rurl = /^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+))?)?/

  // jQuery #8138, IE may throw an exception when accessing
  // a field from window.location if document.domain has been set
  var ajaxLocation
  try { ajaxLocation = location.href }
  catch (e) {
    // Use the href attribute of an A element since IE will modify it given document.location
    ajaxLocation = document.createElement( "a" );
    ajaxLocation.href = "";
    ajaxLocation = ajaxLocation.href;
  }

  var ajaxLocParts = rurl.exec(ajaxLocation.toLowerCase()) || []
    , parts = rurl.exec(url.toLowerCase() )

  var result = !!(
    parts &&
    (  parts[1] != ajaxLocParts[1]
    || parts[2] != ajaxLocParts[2]
    || (parts[3] || (parts[1] === "http:" ? 80 : 443)) != (ajaxLocParts[3] || (ajaxLocParts[1] === "http:" ? 80 : 443))
    )
  )

  //console.debug('is_crossDomain('+url+') -> ' + result)
  return result
}

// MIT License from http://phpjs.org/functions/base64_encode:358
function b64_enc (data) {
    // Encodes string using MIME base64 algorithm
    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, enc="", tmp_arr = [];

    if (!data) {
        return data;
    }

    // assume utf8 data
    // data = this.utf8_encode(data+'');

    do { // pack three octets into four hexets
        o1 = data.charCodeAt(i++);
        o2 = data.charCodeAt(i++);
        o3 = data.charCodeAt(i++);

        bits = o1<<16 | o2<<8 | o3;

        h1 = bits>>18 & 0x3f;
        h2 = bits>>12 & 0x3f;
        h3 = bits>>6 & 0x3f;
        h4 = bits & 0x3f;

        // use hexets to index into b64, and append result to encoded string
        tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
    } while (i < data.length);

    enc = tmp_arr.join('');

    switch (data.length % 3) {
        case 1:
            enc = enc.slice(0, -2) + '==';
        break;
        case 2:
            enc = enc.slice(0, -1) + '=';
        break;
    }

    return enc;
}

});

require.define("/node_modules/browser-request/dist/ender/xmlhttprequest.js",function(require,module,exports,__dirname,__filename,process,global){

!function(window) {
  if(typeof exports === 'undefined')
    throw new Error('Cannot find global "exports" object. Is this really CommonJS?')
  if(typeof module === 'undefined')
    throw new Error('Cannot find global "module" object. Is this really CommonJS?')
  if(!module.exports)
    throw new Error('Cannot find global "module.exports" object. Is this really CommonJS?')

  // Define globals to simulate a browser environment.
  window = window || {}

  var document = window.document || {}
  if(!window.document)
    window.document = document

  var navigator = window.navigator || {}
  if(!window.navigator)
    window.navigator = navigator

  if(!navigator.userAgent)
    navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_2) AppleWebKit/534.51.22 (KHTML, like Gecko) Version/5.1.1 Safari/534.51.22';

  // Remember the old values in window. If the inner code changes anything, export that as a module and restore the old window value.
  var win = {}
    , key

  for (key in window)
    if(window.hasOwnProperty(key))
      win[key] = window[key]

  run_code()

  for (key in window)
    if(window.hasOwnProperty(key))
      if(window[key] !== win[key]) {
        exports[key] = window[key]
        window[key] = win[key]
      }

  function run_code() {
    // Begin browser file: XMLHttpRequest.js
/**
* XMLHttpRequest.js Copyright (C) 2011 Sergey Ilinsky (http://www.ilinsky.com)
*
* This work is free software; you can redistribute it and/or modify
* it under the terms of the GNU Lesser General Public License as published by
* the Free Software Foundation; either version 2.1 of the License, or
* (at your option) any later version.
*
* This work is distributed in the hope that it will be useful,
* but without any warranty; without even the implied warranty of
* merchantability or fitness for a particular purpose. See the
* GNU Lesser General Public License for more details.
*
* You should have received a copy of the GNU Lesser General Public License
* along with this library; if not, write to the Free Software Foundation, Inc.,
* 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA
*/

(function () {

	// Save reference to earlier defined object implementation (if any)
	var oXMLHttpRequest = window.XMLHttpRequest;

	// Define on browser type
	var bGecko  = !!window.controllers;
	var bIE     = window.document.all && !window.opera;
	var bIE7    = bIE && window.navigator.userAgent.match(/MSIE 7.0/);

	// Enables "XMLHttpRequest()" call next to "new XMLHttpReques()"
	function fXMLHttpRequest() {
		this._object  = oXMLHttpRequest && !bIE7 ? new oXMLHttpRequest : new window.ActiveXObject("Microsoft.XMLHTTP");
		this._listeners = [];
	}

	// Constructor
	function cXMLHttpRequest() {
		return new fXMLHttpRequest;
	}
	cXMLHttpRequest.prototype = fXMLHttpRequest.prototype;

	// BUGFIX: Firefox with Firebug installed would break pages if not executed
	if (bGecko && oXMLHttpRequest.wrapped) {
		cXMLHttpRequest.wrapped = oXMLHttpRequest.wrapped;
	}

	// Constants
	cXMLHttpRequest.UNSENT            = 0;
	cXMLHttpRequest.OPENED            = 1;
	cXMLHttpRequest.HEADERS_RECEIVED  = 2;
	cXMLHttpRequest.LOADING           = 3;
	cXMLHttpRequest.DONE              = 4;

	// Public Properties
	cXMLHttpRequest.prototype.readyState    = cXMLHttpRequest.UNSENT;
	cXMLHttpRequest.prototype.responseText  = '';
	cXMLHttpRequest.prototype.responseXML   = null;
	cXMLHttpRequest.prototype.status        = 0;
	cXMLHttpRequest.prototype.statusText    = '';

	// Priority proposal
	cXMLHttpRequest.prototype.priority    = "NORMAL";

	// Instance-level Events Handlers
	cXMLHttpRequest.prototype.onreadystatechange  = null;

	// Class-level Events Handlers
	cXMLHttpRequest.onreadystatechange  = null;
	cXMLHttpRequest.onopen              = null;
	cXMLHttpRequest.onsend              = null;
	cXMLHttpRequest.onabort             = null;

	// Public Methods
	cXMLHttpRequest.prototype.open  = function(sMethod, sUrl, bAsync, sUser, sPassword) {
		// Delete headers, required when object is reused
		delete this._headers;

		// When bAsync parameter value is omitted, use true as default
		if (arguments.length < 3) {
			bAsync  = true;
		}

		// Save async parameter for fixing Gecko bug with missing readystatechange in synchronous requests
		this._async   = bAsync;

		// Set the onreadystatechange handler
		var oRequest  = this;
		var nState    = this.readyState;
		var fOnUnload = null;

		// BUGFIX: IE - memory leak on page unload (inter-page leak)
		if (bIE && bAsync) {
			fOnUnload = function() {
				if (nState != cXMLHttpRequest.DONE) {
					fCleanTransport(oRequest);
					// Safe to abort here since onreadystatechange handler removed
					oRequest.abort();
				}
			};
			window.attachEvent("onunload", fOnUnload);
		}

		// Add method sniffer
		if (cXMLHttpRequest.onopen) {
			cXMLHttpRequest.onopen.apply(this, arguments);
		}

		if (arguments.length > 4) {
			this._object.open(sMethod, sUrl, bAsync, sUser, sPassword);
		} else if (arguments.length > 3) {
			this._object.open(sMethod, sUrl, bAsync, sUser);
		} else {
			this._object.open(sMethod, sUrl, bAsync);
		}

		this.readyState = cXMLHttpRequest.OPENED;
		fReadyStateChange(this);

		this._object.onreadystatechange = function() {
			if (bGecko && !bAsync) {
				return;
			}

			// Synchronize state
			oRequest.readyState   = oRequest._object.readyState;
			fSynchronizeValues(oRequest);

			// BUGFIX: Firefox fires unnecessary DONE when aborting
			if (oRequest._aborted) {
				// Reset readyState to UNSENT
				oRequest.readyState = cXMLHttpRequest.UNSENT;

				// Return now
				return;
			}

			if (oRequest.readyState == cXMLHttpRequest.DONE) {
				// Free up queue
				delete oRequest._data;

				// Uncomment these lines for bAsync
				/**
				 * if (bAsync) {
				 * 	fQueue_remove(oRequest);
				 * }
				 */

				fCleanTransport(oRequest);

				// Uncomment this block if you need a fix for IE cache
				/**
				 * // BUGFIX: IE - cache issue
				 * if (!oRequest._object.getResponseHeader("Date")) {
				 * 	// Save object to cache
				 * 	oRequest._cached  = oRequest._object;
				 *
				 * 	// Instantiate a new transport object
				 * 	cXMLHttpRequest.call(oRequest);
				 *
				 * 	// Re-send request
				 * 	if (sUser) {
				 * 		if (sPassword) {
				 * 			oRequest._object.open(sMethod, sUrl, bAsync, sUser, sPassword);
				 * 		} else {
				 * 			oRequest._object.open(sMethod, sUrl, bAsync);
				 * 		}
				 *
				 * 		oRequest._object.setRequestHeader("If-Modified-Since", oRequest._cached.getResponseHeader("Last-Modified") || new window.Date(0));
				 * 		// Copy headers set
				 * 		if (oRequest._headers) {
				 * 			for (var sHeader in oRequest._headers) {
				 * 				// Some frameworks prototype objects with functions
				 * 				if (typeof oRequest._headers[sHeader] == "string") {
				 * 					oRequest._object.setRequestHeader(sHeader, oRequest._headers[sHeader]);
				 * 				}
				 * 			}
				 * 		}
				 * 		oRequest._object.onreadystatechange = function() {
				 * 			// Synchronize state
				 * 			oRequest.readyState   = oRequest._object.readyState;
				 *
				 * 			if (oRequest._aborted) {
				 * 				//
				 * 				oRequest.readyState = cXMLHttpRequest.UNSENT;
				 *
				 * 				// Return
				 * 				return;
				 * 			}
				 *
				 * 			if (oRequest.readyState == cXMLHttpRequest.DONE) {
				 * 				// Clean Object
				 * 				fCleanTransport(oRequest);
				 *
				 * 				// get cached request
				 * 				if (oRequest.status == 304) {
				 * 					oRequest._object  = oRequest._cached;
				 * 				}
				 *
				 * 				//
				 * 				delete oRequest._cached;
				 *
				 * 				//
				 * 				fSynchronizeValues(oRequest);
				 *
				 * 				//
				 * 				fReadyStateChange(oRequest);
				 *
				 * 				// BUGFIX: IE - memory leak in interrupted
				 * 				if (bIE && bAsync) {
				 * 					window.detachEvent("onunload", fOnUnload);
				 * 				}
				 *
				 * 			}
				 * 		};
				 * 		oRequest._object.send(null);
				 *
				 * 		// Return now - wait until re-sent request is finished
				 * 		return;
				 * 	};
				 */

				// BUGFIX: IE - memory leak in interrupted
				if (bIE && bAsync) {
					window.detachEvent("onunload", fOnUnload);
				}

				// BUGFIX: Some browsers (Internet Explorer, Gecko) fire OPEN readystate twice
				if (nState != oRequest.readyState) {
					fReadyStateChange(oRequest);
				}

				nState  = oRequest.readyState;
			}
		};
	};

	cXMLHttpRequest.prototype.send = function(vData) {
		// Add method sniffer
		if (cXMLHttpRequest.onsend) {
			cXMLHttpRequest.onsend.apply(this, arguments);
		}

		if (!arguments.length) {
			vData = null;
		}

		// BUGFIX: Safari - fails sending documents created/modified dynamically, so an explicit serialization required
		// BUGFIX: IE - rewrites any custom mime-type to "text/xml" in case an XMLNode is sent
		// BUGFIX: Gecko - fails sending Element (this is up to the implementation either to standard)
		if (vData && vData.nodeType) {
			vData = window.XMLSerializer ? new window.XMLSerializer().serializeToString(vData) : vData.xml;
			if (!this._headers["Content-Type"]) {
				this._object.setRequestHeader("Content-Type", "application/xml");
			}
		}

		this._data = vData;

		/**
		 * // Add to queue
		 * if (this._async) {
		 * 	fQueue_add(this);
		 * } else { */
		fXMLHttpRequest_send(this);
		 /**
		 * }
		 */
	};

	cXMLHttpRequest.prototype.abort = function() {
		// Add method sniffer
		if (cXMLHttpRequest.onabort) {
			cXMLHttpRequest.onabort.apply(this, arguments);
		}

		// BUGFIX: Gecko - unnecessary DONE when aborting
		if (this.readyState > cXMLHttpRequest.UNSENT) {
			this._aborted = true;
		}

		this._object.abort();

		// BUGFIX: IE - memory leak
		fCleanTransport(this);

		this.readyState = cXMLHttpRequest.UNSENT;

		delete this._data;

		/* if (this._async) {
	 	* 	fQueue_remove(this);
	 	* }
	 	*/
	};

	cXMLHttpRequest.prototype.getAllResponseHeaders = function() {
		return this._object.getAllResponseHeaders();
	};

	cXMLHttpRequest.prototype.getResponseHeader = function(sName) {
		return this._object.getResponseHeader(sName);
	};

	cXMLHttpRequest.prototype.setRequestHeader  = function(sName, sValue) {
		// BUGFIX: IE - cache issue
		if (!this._headers) {
			this._headers = {};
		}

		this._headers[sName]  = sValue;

		return this._object.setRequestHeader(sName, sValue);
	};

	// EventTarget interface implementation
	cXMLHttpRequest.prototype.addEventListener  = function(sName, fHandler, bUseCapture) {
		for (var nIndex = 0, oListener; oListener = this._listeners[nIndex]; nIndex++) {
			if (oListener[0] == sName && oListener[1] == fHandler && oListener[2] == bUseCapture) {
				return;
			}
		}

		// Add listener
		this._listeners.push([sName, fHandler, bUseCapture]);
	};

	cXMLHttpRequest.prototype.removeEventListener = function(sName, fHandler, bUseCapture) {
		for (var nIndex = 0, oListener; oListener = this._listeners[nIndex]; nIndex++) {
			if (oListener[0] == sName && oListener[1] == fHandler && oListener[2] == bUseCapture) {
				break;
			}
		}

		// Remove listener
		if (oListener) {
			this._listeners.splice(nIndex, 1);
		}
	};

	cXMLHttpRequest.prototype.dispatchEvent = function(oEvent) {
		var oEventPseudo  = {
			'type':             oEvent.type,
			'target':           this,
			'currentTarget':    this,
			'eventPhase':       2,
			'bubbles':          oEvent.bubbles,
			'cancelable':       oEvent.cancelable,
			'timeStamp':        oEvent.timeStamp,
			'stopPropagation':  function() {},  // There is no flow
			'preventDefault':   function() {},  // There is no default action
			'initEvent':        function() {}   // Original event object should be initialized
		};

		// Execute onreadystatechange
		if (oEventPseudo.type == "readystatechange" && this.onreadystatechange) {
			(this.onreadystatechange.handleEvent || this.onreadystatechange).apply(this, [oEventPseudo]);
		}


		// Execute listeners
		for (var nIndex = 0, oListener; oListener = this._listeners[nIndex]; nIndex++) {
			if (oListener[0] == oEventPseudo.type && !oListener[2]) {
				(oListener[1].handleEvent || oListener[1]).apply(this, [oEventPseudo]);
			}
		}

	};

	//
	cXMLHttpRequest.prototype.toString  = function() {
		return '[' + "object" + ' ' + "XMLHttpRequest" + ']';
	};

	cXMLHttpRequest.toString  = function() {
		return '[' + "XMLHttpRequest" + ']';
	};

	/**
	 * // Queue manager
	 * var oQueuePending = {"CRITICAL":[],"HIGH":[],"NORMAL":[],"LOW":[],"LOWEST":[]},
	 * aQueueRunning = [];
	 * function fQueue_add(oRequest) {
	 * 	oQueuePending[oRequest.priority in oQueuePending ? oRequest.priority : "NORMAL"].push(oRequest);
	 * 	//
	 * 	setTimeout(fQueue_process);
	 * };
	 *
	 * function fQueue_remove(oRequest) {
	 * 	for (var nIndex = 0, bFound = false; nIndex < aQueueRunning.length; nIndex++)
	 * 	if (bFound) {
	 * 		aQueueRunning[nIndex - 1] = aQueueRunning[nIndex];
	 * 	} else {
	 * 		if (aQueueRunning[nIndex] == oRequest) {
	 * 			bFound  = true;
	 * 		}
	 * }
	 *
	 * 	if (bFound) {
	 * 		aQueueRunning.length--;
	 * 	}
	 *
	 *
	 * 	//
	 * 	setTimeout(fQueue_process);
	 * };
	 *
	 * function fQueue_process() {
	 * if (aQueueRunning.length < 6) {
	 * for (var sPriority in oQueuePending) {
	 * if (oQueuePending[sPriority].length) {
	 * var oRequest  = oQueuePending[sPriority][0];
	 * oQueuePending[sPriority]  = oQueuePending[sPriority].slice(1);
	 * //
	 * aQueueRunning.push(oRequest);
	 * // Send request
	 * fXMLHttpRequest_send(oRequest);
	 * break;
	 * }
	 * }
	 * }
	 * };
	 */

	// Helper function
	function fXMLHttpRequest_send(oRequest) {
		oRequest._object.send(oRequest._data);

		// BUGFIX: Gecko - missing readystatechange calls in synchronous requests
		if (bGecko && !oRequest._async) {
			oRequest.readyState = cXMLHttpRequest.OPENED;

			// Synchronize state
			fSynchronizeValues(oRequest);

			// Simulate missing states
			while (oRequest.readyState < cXMLHttpRequest.DONE) {
				oRequest.readyState++;
				fReadyStateChange(oRequest);
				// Check if we are aborted
				if (oRequest._aborted) {
					return;
				}
			}
		}
	}

	function fReadyStateChange(oRequest) {
		// Sniffing code
		if (cXMLHttpRequest.onreadystatechange){
			cXMLHttpRequest.onreadystatechange.apply(oRequest);
		}


		// Fake event
		oRequest.dispatchEvent({
			'type':       "readystatechange",
			'bubbles':    false,
			'cancelable': false,
			'timeStamp':  new Date + 0
		});
	}

	function fGetDocument(oRequest) {
		var oDocument = oRequest.responseXML;
		var sResponse = oRequest.responseText;
		// Try parsing responseText
		if (bIE && sResponse && oDocument && !oDocument.documentElement && oRequest.getResponseHeader("Content-Type").match(/[^\/]+\/[^\+]+\+xml/)) {
			oDocument = new window.ActiveXObject("Microsoft.XMLDOM");
			oDocument.async       = false;
			oDocument.validateOnParse = false;
			oDocument.loadXML(sResponse);
		}

		// Check if there is no error in document
		if (oDocument){
			if ((bIE && oDocument.parseError !== 0) || !oDocument.documentElement || (oDocument.documentElement && oDocument.documentElement.tagName == "parsererror")) {
				return null;
			}
		}
		return oDocument;
	}

	function fSynchronizeValues(oRequest) {
		try { oRequest.responseText = oRequest._object.responseText;  } catch (e) {}
		try { oRequest.responseXML  = fGetDocument(oRequest._object); } catch (e) {}
		try { oRequest.status       = oRequest._object.status;        } catch (e) {}
		try { oRequest.statusText   = oRequest._object.statusText;    } catch (e) {}
	}

	function fCleanTransport(oRequest) {
		// BUGFIX: IE - memory leak (on-page leak)
		oRequest._object.onreadystatechange = new window.Function;
	}

	// Internet Explorer 5.0 (missing apply)
	if (!window.Function.prototype.apply) {
		window.Function.prototype.apply = function(oRequest, oArguments) {
			if (!oArguments) {
				oArguments  = [];
			}
			oRequest.__func = this;
			oRequest.__func(oArguments[0], oArguments[1], oArguments[2], oArguments[3], oArguments[4]);
			delete oRequest.__func;
		};
	}

	// Register new object with window
	window.XMLHttpRequest = cXMLHttpRequest;

})();

    // End browser file: XMLHttpRequest.js
  }
}(typeof window !== 'undefined' ? window : {});

});

require.define("/www/embed.js",function(require,module,exports,__dirname,__filename,process,global){var jsonp = require('jsonp')
var request = require('browser-request')

var parts = window.location.pathname.split('/')
var gistID = parts[2]

jsonp('https://api.github.com/gists/' + gistID, function(err, gist) {
  if (err) return console.log(err)
  var head = gist.data.files['head.html'].content
  var minified = gist.data.files['minified.js'].content
  document.head.innerHTML += head
  eval(minified)
})

});
require("/www/embed.js");
})();
