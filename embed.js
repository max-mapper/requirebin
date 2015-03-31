var jsonp = require('jsonp')
var url = require('url')
var getGistFiles = require('./get-gist-files')
var $ = window.jQuery
var parsedURL = url.parse(window.location.href, true)
var gistID = parsedURL.query.gist

var binURL = '/?gist=' + gistID
var link = document.querySelector('.requirebin-link')
if (link) link.setAttribute('href', binURL)

if (gistID.indexOf('/') > -1) gistID = gistID.split('/')[1]
loadFromAPI(gistID)

function loadFromAPI (gistID) {
  jsonp('https://api.github.com/gists/' + gistID, function (err, gist) {
    if (err) return console.log(err)

    getGistFiles(gist, ['page-head.html', 'page-body.html', 'head.html', 'minified.js'], function (err) {
      if (err) return console.log(err)
      var files = gist.data.files
      var head
      var body
      var bundle

      var headFile = files['page-head.html'] || files['head.html']
      if (headFile) {
        head = headFile.content
      }
      if (files['page-body.html']) {
        body = files['page-body.html'].content
      }
      if (files['minified.js']) {
        bundle = files['minified.js'].content
      }
      render(head, body, bundle)
    })
  })
}

function render (head, body, bundle) {
  if (head) document.head.innerHTML += head
  if (body) {
    $(document.body).append($.parseHTML(body, document, true))
  }

  if (!bundle) {
    document.body.innerHTML += 'not a valid requirebin gist - missing minified.js'
  } else {
    $(document.body).append(
      $('<script />')
        .attr('type', 'text/javascript')
        .text('setTimeout(function () {' + bundle + '}, 1000)')
    )
  }
}
