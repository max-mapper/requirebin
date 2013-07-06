var config = require('./config')

var elementClass = require('element-class')
var toolbar = require('toolbar')
var jsEditor = require('javascript-editor')
var createSandbox = require('browser-module-sandbox')
var qs = require('querystring')
var url = require('url')
var request = require('browser-request')
var jsonp = require('jsonp')

var cookie = require('./cookie')
var Github = require('./github/github')

window.github = new Github({
  token: cookie.get('oauth-token'),
  auth: 'oauth'
})

var loggedIn = false
if (cookie.get('oauth-token')) loggedIn = true

var parsedURL = url.parse(window.location.href, true)
if (parsedURL.query.gist) {
  var gistID = parsedURL.query.gist
  enableShare(gistID)
}

var loadingClass = elementClass(document.querySelector('.loading'))
var outputEl = document.querySelector('#play')
var editorEl = document.querySelector('#edit')
var painterEl = document.querySelector('#paint')


function enableShare(gistID) {
  var textarea = document.querySelector('#shareTextarea')
  var instructions = document.querySelector('#shareInstructions')
  var disabled = document.querySelector('#shareDisabled')
  elementClass(disabled).add('hidden')
  elementClass(instructions).remove('hidden')
  textarea.value = '<iframe width="560" height="315" src="' + window.location.origin + '/embed?gist=' + gistID + '" frameborder="0" allowfullscreen></iframe>'
}

function loadCode(cb) {
  if (gistID) {
    loadingClass.remove('hidden')
    return jsonp('https://api.github.com/gists/' + gistID, function(err, gist) {
      loadingClass.add('hidden')
      if (err) return cb(err)
      var json = gist.data
      if (!json.files || !json.files['index.js']) return cb({error: 'no index.js in this gist', json: json})
      cb(false, json.files['index.js'].content)
    })
  }
  
  var stored = localStorage.getItem('code')
  if (stored) return cb(false, stored)
  
  // todo read from template/file/server
  var defaultGame = document.querySelector('#template').innerText
  cb(false, defaultGame)
}

loadCode(function(err, code) {
  if (err) return alert(JSON.stringify(err))
    
  var editor = jsEditor({
    container: editorEl,
    lineWrapping: true
  })
  
  window.editor = editor
  
  editor.setValue(code)
  
  var sandbox = createSandbox({
    cdn: 'http://wzrd.in',
    container: outputEl
  })

  if (parsedURL.query.save) return saveGist(gistID)
  if (parsedURL.query.code) return authenticate()

  var howTo = document.querySelector('#howto')
  var share = document.querySelector('#share')
  var crosshair = document.querySelector('#crosshair')
  var crosshairClass = elementClass(crosshair)
  var controlsContainer = document.querySelector('#controls')
  var textBox = document.querySelector("#shareTextarea")

  // Tags Input
  $(".tagsinput").tagsInput()

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
      sandbox.bundle(editor.editor.getValue())
    },

    edit: function() {
      elementClass(howTo).add('hidden')
      if (!editorEl.className.match(/hidden/)) return
      elementClass(editorEl).remove('hidden')
      elementClass(outputEl).add('hidden')
      // clear current game
      if (sandbox.iframe) sandbox.iframe.setHTML(" ")
      elementClass(howTo).add('hidden')
    },

    save: function() {
      if (loggedIn) return saveGist(gistID)
      loadingClass.remove('hidden')
      var loginURL = "https://github.com/login/oauth/authorize" + 
        "?client_id=" + config.GITHUB_CLIENT +
        "&scope=repo, user, gist" +
        "&redirect_uri=" + window.location.href
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
  
  function authenticate() {
    if (cookie.get('oauth-token')) return loggedIn = true
    var match = window.location.href.match(/\?code=([a-z0-9]*)/)
    
    // Handle Code
    if (!match) return false
    var authURL = config.GATEKEEPER + '/authenticate/' + match[1]
    request({url: authURL, json: true}, function (err, resp, data) {
      if (err) return console.err(err)
      console.log('resp', resp, data)
      cookie.set('oauth-token', data.token)
      loggedIn = true
      // Adjust URL
      var regex = new RegExp("\\?code=" + match[1])
      window.location.href = window.location.href.replace(regex, '').replace('&state=', '') + '?save=true'
    })
    
    return true
  }
  
  sandbox.on('bundleStart', function() {
    crosshair.style.display = 'block'
    crosshairClass.add('spinning')
  })
  
  sandbox.on('bundleEnd', function(bundle) {
    crosshairClass.remove('spinning')
    crosshair.style.display = 'none'
  })
  
  sandbox.on('modules', function(modules) {
    // TODO show package.json editor
  })
  
  if (!gistID) {
    editor.on("change", function() {
      var code = editor.editor.getValue()
      localStorage.setItem('code', code)
    })
  }
  
  function saveGist(id) {
    var entry = editor.editor.getValue()
    sandbox.bundle(entry)
    sandbox.once('bundleEnd', function(bundle) {
      loadingClass.remove('hidden')
      var gist = {
       "description": "made with requirebin.com",
         "public": true,
         "files": {
           "index.js": {
             "content": entry
           },
           "minified.js": {
             "content": bundle.script
           },
           "head.html": {
             "content": bundle.head
           }
         }
      }
      github.getGist().create(gist, function(err, data) {
        loadingClass.add('hidden')
        if (err) return alert(JSON.stringify(err))
        window.location.href = "/?gist=" + data.id
      })
    })
  }
})
