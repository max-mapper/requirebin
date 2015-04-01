var jsonp = require('jsonp')
var url = require('url')
var iframe = require('iframe')
var getGistFiles = require('./get-gist-files')
var $ = window.jQuery
var parsedURL = url.parse(window.location.href, true)
var gistID = parsedURL.query.gist

var $codeEls = $('#output > div')
var $links = $('#links a')

var binURL = '/?gist=' + gistID

if (gistID.indexOf('/') > -1) gistID = gistID.split('/')[1]

run()

function run() {
  updateUIBeforeGistLoad()
  loadFromAPI(gistID)
}

function updateUIBeforeGistLoad() {
  // update the link to requirebin
  document.getElementById('requirebin-link').href = 'http://requirebin.com/' + binURL

  // disable some tabs
  var tabs = (typeof parsedURL.query.tabs !== 'undefined'
    ? parsedURL.query.tabs
    : 'code,head,body,meta').split(',')
  // result is always visible
  $('#result-link').addClass('visible')
  tabs.forEach(function (tab) {
    $('#' + tab + '-link').addClass('visible')
  })
}

function loadFromAPI (gistID) {
  jsonp('https://api.github.com/gists/' + gistID, function (err, gist) {
    if (err) return console.log(err)

    getGistFiles(gist, ['page-head.html', 'page-body.html', 'head.html', 'minified.js', 'package.json', 'index.js'], function (err) {
      if (err) return console.log(err)
      var files = gist.data.files
      var content = {}

      var headFile = files['page-head.html'] || files['head.html']
      if (headFile) {
        content.head = headFile.content
      }
      if (files['page-body.html']) {
        content.body = files['page-body.html'].content
      }
      if (files['minified.js']) {
        content.bundle = files['minified.js'].content
        content.code = files['index.js'].content
      }
      if (files['package.json']) {
        content.meta = files['package.json'].content
      }

      updateUI(content)
      setUpUIController(content)
      render(content)
    })
  })
}

function render (content) {

  if (!content.bundle || !content.meta) {
    content.bundle = 'document.write("not a valid requirebin gist - missing minified.js")'
  }

  iframe({
    container: document.getElementById('result'),
    head: content.head,
    body: content.body + '<script type="text/javascript">' +
    'setTimeout(function(){\n;' + content.bundle + '\n;}, 0)</script>'
  })
}

function updateUI(content) {
  // highlight the code
  ['code', 'head', 'body', 'meta'].forEach(function (key) {
    var box = document.querySelector('#' + key + ' code')
    box.textContent = box.innerText = content[key]
  })
  hljs.initHighlightingOnLoad();
}

function setUpUIController(content) {
  window.onpopstate = function () {
    var hash = location.hash.substr(1)
    if (content[hash] || hash === 'result') {
      changeEditor(hash)
    }
  }
}

function changeEditor(hash) {
  $codeEls.removeClass('active')
  $links.removeClass('btn-primary')
  $('#' + hash).addClass('active')
  $('#' + hash + '-link').addClass('btn-primary')
}