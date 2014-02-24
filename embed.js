var jsonp = require('jsonp')
var url = require('url')


var parsedURL = url.parse(window.location.href, true)
var gistID = parsedURL.query.gist

var binURL = "/?gist=" + gistID
var link = document.querySelector('.requirebin-link')
if (link) link.setAttribute('href', binURL)

jsonp('https://api.github.com/gists/' + gistID, function(err, gist) {
  if (err) return console.log(err)
  var files = gist.data.files
  
  var headFile = files['page-head.html']
  if (!headFile) headFile = files['head.html']
  if (headFile) var head = headFile.content
  if (head) document.head.innerHTML += head
  
  var minFile = files['minified.js']
  if (minFile) var minified = minFile.content
  else var minified = "document.body.innerHTML += 'not a valid requirebin gist - missing minified.js'"
  
  _eval = eval
  _eval(minified)
})
