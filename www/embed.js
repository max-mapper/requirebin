var jsonp = require('jsonp')
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
