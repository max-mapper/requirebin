// explicity list globals here
var $ = window.$

var config = require('./config')
var elementClass = require('element-class')
var jsEditor = require('javascript-editor')
var createSandbox = require('browser-module-sandbox')
var url = require('url')
var request = require('browser-request')
var detective = require('detective')
var md5 = require('md5-jkmyers')
var keydown = require('keydown')

var htmlEditor = require('./lib/htmlEditor')

var cookie = require('./cookie')
var Gist = require('./github-gist.js')
var uglify = require('uglify-js')

// globals set on window for the editor
var editors = window.editors = {}
var activeEditor

initialize()

function initialize () {
  var githubGist = new Gist({
    token: cookie.get('oauth-token'),
    auth: 'oauth'
  })

  var codeMD5, sandbox
  var packagejson = {'name': 'requirebin-sketch', 'version': '1.0.0'}
  window.packagejson = packagejson

  var loggedIn = false
  if (cookie.get('oauth-token')) loggedIn = true

  var parsedURL = url.parse(window.location.href, true)

  var gistID = getGistID(parsedURL)
  if (gistID) {
    gistID = gistID.id
    enableShare(gistID)
  }

  if (parsedURL.query.code) return authenticate()

  var currentHost = parsedURL.protocol + '//' + parsedURL.hostname
  if (parsedURL.port) currentHost += ':' + parsedURL.port

  var loadingClass = elementClass(document.querySelector('.spinner'))
  var runButton = elementClass(document.querySelector('.play-button'))
  var outputEl = document.querySelector('#play')
  var editorHeadEl = document.querySelector('#edit-head')
  var editorBodyEl = document.querySelector('#edit-body')
  var editorMetaEl = document.querySelector('#edit-meta')
  var editorEl = document.querySelector('#edit-bundle')

  function doBundle () {
    sandbox.iframeHead = editors.head.getValue()
    sandbox.iframeBody = editors.body.getValue()
    sandbox.bundle(editors.bundle.getValue(), packagejson.dependencies)
  }

  function authenticate () {
    if (cookie.get('oauth-token')) {
      loggedIn = true
      return
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
      var regex = new RegExp('\\?code=' + match[1])
      window.location.href = window.location.href.replace(regex, '').replace('&state=', '') + '?save=true'
    })

    return true
  }

  function stringifyPackageJson () {
    return JSON.stringify(packagejson, null, '  ')
  }

  function saveGist (id, opts) {
    if (loadingClass) loadingClass.remove('hidden')
    var entry = editors.bundle.editor.getValue()
    opts = opts || {}
    opts.isPublic = 'isPublic' in opts ? opts.isPublic : true

    doBundle()
    sandbox.on('bundleEnd', function (bundle) {
      var minified = uglify.minify(bundle.script, {fromString: true, mangle: false, compress: false})

      var gist = {
        'description': 'requirebin sketch',
        'public': opts.isPublic,
        'files': {
          'index.js': {
            'content': entry
          },
          'minified.js': {
            'content': minified.code
          },
          'requirebin.md': {
            'content': 'made with [requirebin](http://requirebin.com)'
          },
          'package.json': {
            'content': stringifyPackageJson()
          }
        }
      }

      // the gist can't have empty fields or the github api request will fail
      if (sandbox.iframeHead) gist.files['page-head.html'] = {'content': sandbox.iframeHead}
      if (sandbox.iframeHead) gist.files['page-body.html'] = {'content': sandbox.iframeBody}

      githubGist.save(gist, id, opts, function (err, newGist) {
        var newGistId = newGist.id
        if (newGist.user && newGist.user.login) {
          newGistId = newGist.user.login + '/' + newGistId
        }
        loadingClass.add('hidden')
        if (err) tooltipMessage('error', err.toString())
        if (newGistId) window.location.href = '/?gist=' + newGistId
      })
    })
  }

  function enableShare (gistID) {
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

  function loadCode (cb) {
    var code = {}

    function invokeCallback () {
      cb(false, code)
    }

    if (gistID) {
      loadingClass.remove('hidden')
      return githubGist.load(gistID, function (err, gist) {
        loadingClass.add('hidden')
        if (err) return cb(err)
        var json = gist.data
        if (!json.files || !json.files['index.js']) return cb({error: 'no index.js in this gist', json: json})
        var headHtml = json.files['page-head.html'] || {content: ''}
        var bodyHtml = json.files['page-body.html'] || {content: ''}
        var pkgJson = json.files['package.json'] || {content: ''}
        code.head = headHtml.content
        code.body = bodyHtml.content
        code.meta = pkgJson.content
        code.bundle = json.files['index.js'].content
        var pj = json.files['package.json']
        if (pj) {
          try {
            pj = JSON.parse(pj.content)
          } catch (e) {
            pj = false
          }
          if (pj) packagejson.dependencies = pj.dependencies
        }
        codeMD5 = md5(code.bundle)
        invokeCallback()
      })
    }

    code.bundle = localStorage.getItem('bundleCode') ||
      document.querySelector('#bundle-template').innerText
    code.head = localStorage.getItem('headCode') || ''
    code.body = localStorage.getItem('bodyCode') || ''
    code.meta = localStorage.getItem('metaCode') || ''
    invokeCallback()
  }

  loadCode(function (err, code) {
    if (err) return tooltipMessage('error', JSON.stringify(err))

    // javascript editors
    var bundleEditor = jsEditor({
      container: editorEl,
      lineWrapping: true
    })
    bundleEditor.name = 'bundle'

    var metaEditor = htmlEditor.factory({
      // initial value is not important here, when the editor gets the focus
      // the content will be overwritten
      value: '',
      name: 'meta',
      mode: 'application/json',
      container: editorMetaEl,
      lineWrapping: true
    })
    metaEditor.on('afterFocus', function () {
      metaEditor.setValue(stringifyPackageJson())
    })

    // html editors
    var bodyEditor = htmlEditor.factory({
      name: 'body',
      value: '<!-- contents of this file will be placed inside the <body> -->\n',
      container: editorBodyEl
    })

    var headEditor = htmlEditor.factory({
      name: 'head',
      value: '<!-- contents of this file will be placed inside the <head> -->\n',
      container: editorHeadEl
    })

    editors.meta = metaEditor
    editors.head = headEditor
    editors.body = bodyEditor
    activeEditor = editors.bundle = bundleEditor

    if (code.bundle) bundleEditor.setValue(code.bundle)
    if (code.body) bodyEditor.setValue(code.body)
    if (code.head) headEditor.setValue(code.head)

    var sandboxOpts = {
      cdn: config.BROWSERIFYCDN,
      container: outputEl,
      iframeStyle: 'body, html { height: 100% width: 100% }'
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

    sandbox.on('modules', function (modules) {
      if (!modules) return
      packagejson.dependencies = {}
      modules.forEach(function (mod) {
        if (mod.core) return
        packagejson.dependencies[mod.name] = mod.version
      })
    })

    if (parsedURL.query.save) return

    var howTo = document.querySelector('#howto')
    var share = document.querySelector('#share')

    document.querySelector('.hide-howto').addEventListener('click', function () {
      elementClass(howTo).add('hidden')
    })

    var packageTags = $('.tagsinput')

    bundleEditor.on('valid', function (valid) {
      if (!valid) return
      runButton.remove('hidden')
      $('.editor-picker').removeClass('hidden')
      packageTags.html('')
      var modules = detective(bundleEditor.editor.getValue())
      modules.map(function (module) {
        var tag =
        '<span class="tag"><a target="_blank" href="http://npmjs.org/' +
            module + '"><span>' + module + '&nbsp&nbsp</span></a></span>'
        packageTags.append(tag)
      })
      if (modules.length === 0) packageTags.append('<div class="tagsinput-add">No Modules Required Yet</div>')
    })

    var actionsMenu = $('.actionsMenu')
    actionsMenu.dropkick({
      change: function (value, label) {
        if (value === 'noop') return
        if (value in actions) actions[value]()
        setTimeout(function () {
          actionsMenu.dropkick('reset')
        }, 0)
      }
    })

    $('.run-btn').click(function (e) {
      e.preventDefault()
      $('a[data-action="play"]').click()
      return false
    })

    $('.actionsButtons a').click(function () {
      var target = $(this)
      var action = target.attr('data-action')
      if (action in actions) actions[action]()
    })

    var actions = {
      play: function (pressed) {
        runButton.add('disabled')

        var code = bundleEditor.editor.getValue()
        if (codeMD5 && codeMD5 === md5(code)) {
          loadingClass.add('hidden')
          sandbox.iframe.setHTML('<script type="text/javascript" src="embed-bundle.js"></script>')
        }
        doBundle()

        bundleEditor.once('change', function (e) {
          runButton.remove('disabled')
        })
      },

      edit: function () {
        elementClass(howTo).remove('hidden')
        if (!editorEl.className.match(/hidden/)) return
        elementClass(editorEl).remove('hidden')
        elementClass(outputEl).add('hidden')
        var message = document.querySelector('.alert')
        if (message) message.classList.add('hidden')
        if (sandbox.iframe) sandbox.iframe.setHTML(' ')
      },

      save: function () {
        if (loggedIn) return saveGist(gistID)
        loadingClass.remove('hidden')
        var loginURL = 'https://github.com/login/oauth/authorize' +
          '?client_id=' + config.GITHUB_CLIENT +
          '&scope=gist' +
          '&redirect_uri=' + currentHost
        window.location.href = loginURL
      },

      'save-private': function () {
        if (loggedIn) return saveGist(gistID, { 'isPublic': false })
        loadingClass.remove('hidden')

        var loginURL = 'https://github.com/login/oauth/authorize' +
          '?client_id=' + config.GITHUB_CLIENT +
          '&scope=gist' +
          '&private=true' +
          '&redirect_uri=' + currentHost

        window.location.href = loginURL
      },

      howto: function () {
        elementClass(howTo).remove('hidden')
        elementClass(share).add('hidden')
      },

      share: function () {
        elementClass(howTo).add('hidden')
        elementClass(share).remove('hidden')
      }
    }

    // changes the active editor
    var $editors = $('.require-bin-editor')
    var $editorLinks = $('.editor-picker a')
    $editorLinks.click(function () {
      var self = $(this)
      var editor
      // there's only one primary button
      var editorName = self.attr('data-editor')
      $editorLinks.removeClass('btn-primary')
      self.addClass('btn-primary')
      // hide all editors and show the active editor
      $editors.addClass('hidden')
      $('#edit-' + editorName).removeClass('hidden')
      activeEditor = editors[editorName]
      activeEditor.emit('afterFocus')
      editor = activeEditor.editor
      editor.refresh()
    })

    sandbox.on('bundleStart', function () {
      loadingClass.remove('hidden')
    })

    sandbox.on('bundleEnd', function (bundle) {
      loadingClass.add('hidden')
    })

    sandbox.on('bundleError', function (err) {
      loadingClass.add('hidden')
      tooltipMessage('error', 'Bundling error: \n\n' + err)
    })

    if (!gistID) {
      [bundleEditor, headEditor, bodyEditor].forEach(function (editor) {
        editor.on('change', function () {
          var code = editor.editor.getValue()
          // e.g. bundleCode, headCode, bodyCode
          localStorage.setItem(editor.name + 'Code', code)
        })
      })

      metaEditor.on('change', function () {
        var code = metaEditor.editor.getValue()
        try {
          window.packagejson = packagejson = JSON.parse(code)
        } catch (e) { }
      })
    }

    keydown(['<meta>', '<enter>']).on('pressed', actions.play)
    keydown(['<control>', '<enter>']).on('pressed', actions.play)

    // loads the current code on load
    setTimeout(function () {
      actions.play()
    }, 500)

  })
}

/*
  display error/warning messages in the site header
  cssClass should be a default bootstrap class
  .warning .alert .info .success
  text is the message content
*/
function tooltipMessage (cssClass, text) {
  var message = document.querySelector('.alert')
  if (message) {
    message.classList.remove('hidden')
    message.classList.add('alert-' + cssClass)
    message.innerHTML = text
  } else {
    message = document.createElement('div')
    message.classList.add('alert')
    var close = document.createElement('span')
    close.classList.add('pull-right')
    close.innerHTML = '&times'
    close.addEventListener('click', function () {
      this.parentNode.classList.add('hidden')
    }, false)
    message.classList.add('alert-' + cssClass)
    message.innerHTML = text
    document.querySelector('body').appendChild(message)
    message.appendChild(close)
  }
}

function getGistID (parsedURL) {
  var gistID
  if (parsedURL.query.gist) {
    gistID = parsedURL.query.gist
  } else if (parsedURL.hash) {
    gistID = parsedURL.hash.replace('#', '')
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
