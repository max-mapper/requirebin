var config = require('./config')

var elementClass = require('element-class')
var jsEditor = require('javascript-editor')
var createSandbox = require('browser-module-sandbox')
var qs = require('querystring')
var url = require('url')
var request = require('browser-request')
var detective = require('detective')
var md5 = require('md5-jkmyers')

var cookie = require('./cookie')
var Github = require('github-api')
var Gist = require('./github-gist.js')

initialize()

function initialize() {
  window.githubGist = new Gist({
    token: cookie.get('oauth-token'),
    auth: 'oauth'
  })

  var codeMD5, sandbox
  var packagejson = {"name": "requirebin-sketch", "version": "1.0.0"}
  window.packagejson = packagejson
  
  var loggedIn = false
  if (cookie.get('oauth-token')) loggedIn = true

  var parsedURL = url.parse(window.location.href, true)

  var gistID = getGistID(parsedURL)
  if (gistID) {
    var gistUser = gistID.user
    gistID = gistID.id
    enableShare(gistID)
  }

  if (parsedURL.query.code) return authenticate()
  
  var currentHost = parsedURL.protocol + '//' + parsedURL.hostname
  if (parsedURL.port) currentHost += ':' + parsedURL.port

  var loadingClass = elementClass(document.querySelector('.loading'))
  var outputEl = document.querySelector('#play')
  var editorEl = document.querySelector('#edit')
  var painterEl = document.querySelector('#paint')

  function authenticate() {
    if (cookie.get('oauth-token')) {
      console.log('LOGGEDIN = true')
      return loggedIn = true
    }
    var match = window.location.href.match(/\?code=([a-z0-9]*)/)
    // Handle Code
    if (!match) return false
    var authURL = config.GATEKEEPER + '/authenticate/' + match[1]
    request({url: authURL, json: true}, function (err, resp, data) {
      if (err) return console.error(err)
      console.log('auth response', resp, data)
      if (data.token === 'undefined') return console.error('Auth failed to acquire token')
      cookie.set('oauth-token', data.token)
      loggedIn = true
      // Adjust URL
      var regex = new RegExp("\\?code=" + match[1])
      window.location.href = window.location.href.replace(regex, '').replace('&state=', '') + '?save=true'
    })

    return true
  }
  
  function saveGist(id, opts) {
    if (loadingClass) loadingClass.remove('hidden')
    var entry = editor.editor.getValue()
    opts = opts || {}
    opts.isPublic = 'isPublic' in opts ? opts.isPublic : true

    sandbox.bundle(entry, packagejson.dependencies)
    sandbox.on('bundleEnd', function(bundle) {
      var minified = UglifyJS.minify(bundle.script)
      var gist = {
       "description": "requirebin sketch",
         "public": opts.isPublic,
         "files": {
           "index.js": {
             "content": entry
           },
           "minified.js": {
             "content": minified
           },
           "page-head.html": {
             "content": bundle.head
           },
           "requirebin.md": {
             "content": "made with [requirebin](http://requirebin.com)"
           },
           "package.json": {
             "content": JSON.stringify(packagejson, null, '  ')
           }
         }
      }
      githubGist.save(gist, id, opts, function(err, newGist) {
        var newGistId = newGist.id
        if (newGist.user && newGist.user.login) {
          newGistId = newGist.user.login + '/' + newGistId
        }
        loadingClass.add('hidden')
        if (err) alert(err.toString());
        if (newGistId) window.location.href = "/?gist=" + newGistId
      })
    })
  }

  function enableShare(gistID) {
    var textarea = document.querySelector('#shareTextarea')
    var badgeTextarea = document.querySelector('#shareBadgeTextarea')
    var markdownBadgeTextarea = document.querySelector('#markdownShareBadgeTextarea')
    var instructions = document.querySelector('#shareInstructions')
    var disabled = document.querySelector('#shareDisabled')
    elementClass(disabled).add('hidden')
    elementClass(instructions).remove('hidden')
    textarea.value = '<iframe width="560" height="315" src="' + window.location.origin + '/embed?gist=' + gistID + '" frameborder="0" allowfullscreen></iframe>'
    badgeTextarea.value = '<a class="requirebin-link" target="_blank" href="' + window.location.origin + '/?gist=' + gistID + '"><img src="' + window.location.origin + '/badge.png"></a>'
    markdownBadgeTextarea.value = '[![view on requirebin](' + window.location.origin + '/badge.png)](' + window.location.origin + '/?gist=' + gistID + ')'
  }

  function loadCode(cb) {
    if (gistID) {
      loadingClass.remove('hidden')
      return githubGist.load(gistID, function(err, gist) {
        loadingClass.add('hidden')
        if (err) return cb(err)
        var json = gist.data
        if (!json.files || !json.files['index.js']) return cb({error: 'no index.js in this gist', json: json})
        var code = json.files['index.js'].content
        var pj = json.files['package.json']
        if (pj) {
          try { pj = JSON.parse(pj.content) }
          catch (e) { pj = false }
          if (pj) packagejson.dependencies = pj.dependencies
        }
        codeMD5 = md5(code)
        cb(false, code)
      })
    }

    var stored = localStorage.getItem('code')
    if (stored) return cb(false, stored)

    var defaultCode = document.querySelector('#template').innerText
    cb(false, defaultCode)
  }

  loadCode(function(err, code) {
    if (err) return alert(JSON.stringify(err))

    var editor = jsEditor({
      container: editorEl,
      lineWrapping: true
    })

    window.editor = editor

    if (code) editor.setValue(code)

    var sandboxOpts = {
      cdn: config.BROWSERIFYCDN,
      container: outputEl,
      iframeStyle: "body, html { height: 100%; width: 100%; }"
    }
    
    if (parsedURL.query.save) {
      // use memdown here to avoid indexeddb transaction bugs :(
      sandboxOpts.cacheOpts = { inMemory: true }
      sandbox = createSandbox(sandboxOpts)
      saveGist(gistID, {
        'isPublic': !parsedURL.query['private']
      })
    } else {
      sandbox = createSandbox(sandboxOpts)
    }
    
    sandbox.on('modules', function(modules) {
      if (!modules) return
      packagejson.dependencies = {}
      modules.forEach(function(mod) {
        if (mod.core) return
        packagejson.dependencies[mod.name] = mod.version
      })
    })
    
    if (parsedURL.query.save) return
    
    var howTo = document.querySelector('#howto')
    var share = document.querySelector('#share')
    var crosshair = document.querySelector('#crosshair')
    var crosshairClass = elementClass(crosshair)
    var controlsContainer = document.querySelector('#controls')
    var textBox = document.querySelector("#shareTextarea")

    var packageTags = $(".tagsinput")

    editor.on('valid', function(valid) {
      if (!valid) return
      packageTags.html('')
      var modules = detective(editor.editor.getValue())
      modules.map(function(module) {
        var tag =
          '<span class="tag"><a target="_blank" href="http://npmjs.org/' +
            module + '"><span>' + module + '&nbsp;&nbsp;</span></a></span>'
        packageTags.append(tag)
      })
      if (modules.length === 0) packageTags.append('<div class="tagsinput-add">No Modules Required Yet</div>')
    })

    var actionsMenu = $(".actionsMenu")
    actionsMenu.dropkick({
      change: function(value, label) {
        if (value === 'noop') return
        if (value in actions) actions[value]()
        setTimeout(function() {
          actionsMenu.dropkick('reset')
        }, 0)
      }
    })
  
    $('.run-btn').click(function(e) {
      e.preventDefault()
      $('a[data-action="play"]').click()
      return false
    })

    $(".actionsButtons a").click(function() {
      var target = $(this)
      var action = target.attr('data-action')
      if (action in actions) actions[action]()
      target.siblings().removeClass("active")
      target.addClass("active")
    })

    var actions = {
      play: function() {
        elementClass(howTo).add('hidden')
        elementClass(outputEl).remove('hidden')
        elementClass(editorEl).add('hidden')
        var code = editor.editor.getValue()
        if (codeMD5 && codeMD5 === md5(code)) {
          crosshair.style.display = 'none'
          sandbox.iframe.setHTML('<script type="text/javascript" src="embed-bundle.js"></script>')
        } else {
          sandbox.bundle(code, packagejson.dependencies)
        }
      },

      edit: function() {
        elementClass(howTo).remove('hidden')
        if (!editorEl.className.match(/hidden/)) return
        elementClass(editorEl).remove('hidden')
        elementClass(outputEl).add('hidden')
        var message = document.querySelector('.alert')
        if (message) message.classList.add('hidden')
        if (sandbox.iframe) sandbox.iframe.setHTML(" ")
      },

      save: function() {
        if (loggedIn) return saveGist(gistID)
        loadingClass.remove('hidden')
        var loginURL = "https://github.com/login/oauth/authorize" +
          "?client_id=" + config.GITHUB_CLIENT +
          "&scope=gist" +
          "&redirect_uri=" + currentHost
        window.location.href = loginURL
      },

      'save-private': function() {
        if (loggedIn) return saveGist(gistID, { 'isPublic': false })
        loadingClass.remove('hidden')

        var loginURL = "https://github.com/login/oauth/authorize" +
          "?client_id=" + config.GITHUB_CLIENT +
          "&scope=gist" +
          "&private=true" +
          "&redirect_uri=" + currentHost

        window.location.href = loginURL
      },

      howto: function() {
        elementClass(howTo).remove('hidden')
        elementClass(share).add('hidden')
      },

      share: function() {
        elementClass(howTo).add('hidden')
        elementClass(share).remove('hidden')
      }
    }

    sandbox.on('bundleStart', function() {
      crosshair.style.display = 'block'
      crosshairClass.add('spinning')
    })

    sandbox.on('bundleEnd', function(bundle) {
      crosshairClass.remove('spinning')
      crosshair.style.display = 'none'
    })

    sandbox.on('bundleError', function(err) {
      crosshairClass.remove('spinning')
      crosshair.style.display = 'none'

      tooltipMessage('error', "Bundling error: \n\n" + err)
    })

    if (!gistID) {
      editor.on("change", function() {
        var code = editor.editor.getValue()
        localStorage.setItem('code', code)
      })
    }

  })
}

/*
  display error/warning messages in the site header
  cssClass should be a default bootstrap class
  .warning .alert .info .success
  text is the message content
*/
function tooltipMessage(cssClass, text) {
  var message = document.querySelector('.alert')
  if (message) {
    message.classList.remove('hidden')
    message.classList.add('alert-'+cssClass)
    message.innerHTML = text
  } else {
    message = document.createElement('div')
    message.classList.add('alert')
    var close = document.createElement('span')
    close.classList.add('pull-right')
    close.innerHTML = '&times;'
    close.addEventListener('click', function () {
      this.parentNode.classList.add('hidden')
    }, false)
    message.classList.add('alert-'+cssClass)
    message.innerHTML = text
    document.querySelector('body').appendChild(message)
    message.appendChild(close)
  }
}

function getGistID(parsedURL) {
  if (parsedURL.query.gist) {
    var gistID = parsedURL.query.gist
  } else if (parsedURL.hash) {
    var gistID = parsedURL.hash.replace("#", "")
  }
  if (!gistID) return
  if (gistID.indexOf('/') > -1) {
    var parts = gistID.split('/')
    gistID = {
      user: parts[0],
      id: parts[1]
    }
  } else {
    gistID = {
      id: gistID
    }
  }
  return gistID
}