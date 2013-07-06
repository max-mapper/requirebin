var jsonp = require('jsonp')
var url = require('url')

var parsedURL = url.parse(window.location.href, true)
var gistID = parsedURL.query.gist

jsonp('https://api.github.com/gists/' + gistID, function(err, gist) {
  if (err) return console.log(err)
  var head = gist.data.files['head.html'].content
  var minified = gist.data.files['minified.js'].content
  document.head.innerHTML += head
  _eval = eval
  _eval(minified)
})
