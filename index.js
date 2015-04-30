// explicity list globals here
var $ = window.$

var config = require('./config')
var elementClass = require('element-class')
var createSandbox = require('browser-module-sandbox')
var url = require('url')
var request = require('browser-request')
var detective = require('detective')
var keydown = require('keydown')

var uglify = require('uglify-js')
var cookie = require('./lib/cookie')
var Gist = require('./lib/github-gist.js')
var ui = require('./lib/ui-controller')
var editors = window.editors = require('./lib/editors')

initialize()

function initialize () {
  var sandbox
  var gistID

  var githubGist = new Gist({
    token: cookie.get('oauth-token'),
    auth: 'oauth'
  })
  var packagejson = {'name': 'requirebin-sketch', 'version': '1.0.0'}
  var parsedURL = url.parse(window.location.href, true)
  var gistTokens = Gist.fromUrl(parsedURL)
  window.packagejson = packagejson

  // dom nodes
  var outputEl = document.querySelector('#play')
  var howTo = document.querySelector('#howto')
  var share = document.querySelector('#share')

  var loggedIn = false
  if (cookie.get('oauth-token')) loggedIn = true

  if (gistTokens) {
    gistID = gistTokens.id
    ui.enableShare(gistID)
  }

  // special parameter `code` is used to perform the auth + redirection
  // so no need to load the code
  if (parsedURL.query.code) return authenticate()

  var currentHost = parsedURL.protocol + '//' + parsedURL.hostname
  if (parsedURL.port) currentHost += ':' + parsedURL.port

  function doBundle () {
    sandbox.iframeHead = editors.get('head').getValue()
    sandbox.iframeBody = editors.get('body').getValue()
    sandbox.bundle(editors.get('bundle').getValue(), packagejson.dependencies)
  }

  // todo: move to auth.js
  function authenticate () {
    if (cookie.get('oauth-token')) {
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
    ui.$spinner.show()
    var entry = editors.get('bundle').getValue()
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
      if (sandbox.iframeBody) gist.files['page-body.html'] = {'content': sandbox.iframeBody}

      githubGist.save(gist, id, opts, function (err, newGist) {
        var newGistId = newGist.id
        if (newGist.user && newGist.user.login) {
          newGistId = newGist.user.login + '/' + newGistId
        }
        ui.$spinner.hide()
        if (err) ui.tooltipMessage('error', err.toString())
        if (newGistId) window.location.href = '/?gist=' + newGistId
      })
    })
  }

  ui.$spinner.show()
  // if gistID is not set, fallback to specific queryParams, local storage
  githubGist.getCode(gistID, function (err, code) {
    ui.$spinner.hide()
    if (err) return ui.tooltipMessage('error', JSON.stringify(err))

    editors.init(code)
    editors.setActive('bundle')

    // actions done with the meta editor:
    // - update the value of the editor whenever it's focused (it always has a valid json)
    // - the runButton is disabled if the value it has is invalid
    function updatePackageJson () {
      var code = editors.get('meta').editor.getValue()
      try {
        ui.$runButton.removeClass('disabled')
        window.packagejson = packagejson = JSON.parse(code)
      } catch (e) {
        // don't allow running the code if package.json is invalid
        ui.$runButton.addClass('disabled')
      }
    }

    // perform an initial package.json check
    updatePackageJson()

    editors.get('meta')
      .on('afterFocus', function (editor) {
        editor.setValue(stringifyPackageJson())
      })
    editors.get('meta')
      .on('change', updatePackageJson)

    // remove the `disabled` class from the save button when any editor is updated
    editors.all(function (editor) {
      editor.on('change', function (e) {
        ui.$runButton.removeClass('disabled')
      })
    })

    var packageTags = $('.tagsinput')
    editors.get('bundle').on('valid', function (valid) {
      if (!valid) return
      ui.$runButton.removeClass('hidden')
      $('.editor-picker').removeClass('hidden')
      packageTags.html('')
      var modules = detective(editors.get('bundle').getValue())
      modules.map(function (module) {
        var tag =
          '<span class="tag"><a target="_blank" href="http://npmjs.org/' +
          module + '"><span>' + module + '&nbsp&nbsp</span></a></span>'
        packageTags.append(tag)
      })
      if (modules.length === 0) packageTags.append('<div class="tagsinput-add">No Modules Required Yet</div>')
    })

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

    // sandbox actions
    sandbox.on('modules', function (modules) {
      if (!modules) return
      packagejson.dependencies = {}
      modules.forEach(function (mod) {
        if (mod.core) return
        packagejson.dependencies[mod.name] = mod.version
      })
    })

    sandbox.on('bundleStart', function () {
      ui.$spinner.show()
    })

    sandbox.on('bundleEnd', function (bundle) {
      ui.$spinner.hide()
    })

    sandbox.on('bundleError', function (err) {
      ui.$spinner.hide()
      ui.tooltipMessage('error', 'Bundling error: \n\n' + err)
    })

    if (parsedURL.query.save) return

    // UI actions
    // TODO: move them to ui-controller.js

    document.querySelector('.hide-howto').addEventListener('click', function () {
      elementClass(howTo).add('hidden')
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

    $('.actionsButtons a').click(function () {
      var target = $(this)
      var action = target.attr('data-action')
      if (action in actions) actions[action]()
    })

    // call actions.play from the button located in the instructions
    $('.run-btn').click(function (e) {
      e.preventDefault()
      $('a[data-action="play"]').click()
      return false
    })

    var actions = {
      play: function () {
        // only execute play if any editor is dirty
        var isDirty = editors.asArray()
          .filter(function (editor) {
            return !editor.editor.isClean()
          })
          .length > 0
        if (!isDirty) {
          return
        }

        // mark all the editors as clean
        editors.all(function (editor) {
          editor.editor.markClean()
        })

        ui.$runButton.addClass('disabled')
        ui.$spinner.hide()
        doBundle()
      },

      save: function () {
        if (loggedIn) return saveGist(gistID)
        ui.$spinner.show()
        var loginURL = 'https://github.com/login/oauth/authorize' +
          '?client_id=' + config.GITHUB_CLIENT +
          '&scope=gist' +
          '&redirect_uri=' + currentHost
        window.location.href = loginURL
      },

      'save-private': function () {
        if (loggedIn) return saveGist(gistID, { 'isPublic': false })
        ui.$spinner.show()

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
      },

      'show-forks': function () {
        gistID && ui.showForks(githubGist.forks, githubGist.parent)
      }
    }

    keydown(['<meta>', '<enter>']).on('pressed', actions.play)
    keydown(['<control>', '<enter>']).on('pressed', actions.play)

    // UI actions when there's no Gist
    if (!gistID) {
      // enable localStorage save when the user is working on a new gist
      editors.all(function (editor) {
        editor.on('change', function () {
          var code = editor.editor.getValue()
          localStorage.setItem(editor.name + 'Code', code)
        })
      })

      // hide the forks option in the dropdown
      $('a[data-dk-dropdown-value="show-forks"]').parent('li').hide()
    }

    // loads the current code on load
    setTimeout(function () {
      actions.play()
    }, 500)

  })
}
