var jsonp = require('jsonp')
var url = require('url')

var parsedURL = url.parse(window.location.href, true)
var gistID = parsedURL.query.gist

var binURL = "/?gist=" + gistID
var link = document.querySelector('.requirebin-link')
if (link) link.setAttribute('href', binURL)

if (gistID.indexOf('/') > -1) loadRaw(gistID)
else loadFromAPI(gistID)

function loadFromAPI(gistID) {
  jsonp('https://api.github.com/gists/' + gistID, function(err, gist) {
    if (err) return console.log(err)
    var files = gist.data.files
    
    var headFile = files['page-head.html']
    if (!headFile) headFile = files['head.html']
    if (headFile) var head = headFile.content
    
    var minFile = files['minified.js']
    if (minFile) var bundle = minFile.content
    render(head, bundle)
  })
}

function loadRaw(gistID) {
  var bundleURL = "https://gist.githubusercontent.com/" + gistID + "/raw/minified.js"
  var script = document.createElement('script')
  script.setAttribute('src', bundleURL)
  document.head.appendChild(script)
}


function render(head, bundle) {
  if (head) document.head.innerHTML += head
  
  if (!bundle) bundle = "document.body.innerHTML += 'not a valid requirebin gist - missing minified.js'"
  
  _eval = eval
  _eval(bundle)
}