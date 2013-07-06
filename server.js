var ecstatic = require('ecstatic')('./www')
var uglify = require('uglify-js')
var zlib = require('zlib')
var githubOAuth = require('github-oauth')
var uuid = require('hat')
var url = require('url')
var concat = require('concat-stream')
var qs = require('querystring')
var request = require('request')
var filed = require('filed')

// sessions are just used for publishing gists
var sessions = {}

var github = githubOAuth({
  githubClient: process.env['REQUIREBIN_GITHUB_CLIENT'],
  githubSecret: process.env['REQUIREBIN_GITHUB_SECRET'],
  baseURL: process.env['REQUIREBIN_VHOST'],
  loginURI: '/login',
  callbackURI: '/github/callback',
  scope: 'user,gist'
})

github.on('error', function(err, res) {
  console.error('there was a login error', err)
  res.end(JSON.stringify(err))
})

github.on('token', function(token, res) {
  var id = setUserID(res)
  sessions[id] = token.access_token
  res.statusCode = 302
  res.setHeader('location', '/?save=true')
  res.end()
})

function saveGist(req, res) {
  var id = req.url.match(/^\/save\/(\d+)$/)
  if (id) id = id[1]
  req.pipe(concat(function(bodyBuf) {
    var bundle = JSON.parse(bodyBuf)
    var cookies = qs.parse(req.headers.cookie)
    if (!cookies['user-id']) return res.end(JSON.stringify({error: 'not logged in', cookies: JSON.stringify(req.headers.cookie)}))
    var token = sessions[cookies['user-id']]
    var gist = {
      "description": "made with requirebin.com",
      "public": true,
      "files": {
        "index.js": {
          "content": bundle.entry
        },
        "minified.js": {
          "content": minifyBundle(bundle.script)
        },
        "head.html": {
          "content": bundle.head
        }
      }
    }
    var headers = {
      'Authorization': 'token ' + token,
      'user-agent': "@maxogden"
    }
    var reqOpts = {json: gist, url: 'https://api.github.com/gists', headers: headers, method: "POST"}
    if (id) { 
      reqOpts.method = "PATCH"
      reqOpts.url = reqOpts.url + '/' + id
    }
    request(reqOpts, function(err, resp, body) {
      if (err) return res.end(JSON.stringify({"githubError": true, req: reqOpts, error: err, body: body}))
      if (resp.statusCode > 399) return res.end(JSON.stringify({"githubError": true, req: reqOpts, error: body}))
      res.end(JSON.stringify({ id: body.id }))
    })
  }))
}

function setUserID(res) {
  var id = uuid()
  var cookie = 'user-id=' + id + '; path=/'
  res.setHeader('set-cookie', cookie)
  return id
}

function checkSession(req, res) {
  if (!req.headers.cookie) return
  var cookies = qs.parse(req.headers.cookie)
  var token = cookies['user-id']
  // delete old sessions
  if (token && !sessions[token]) res.setHeader('set-cookie', 'user-id=; path=/')
}

function snuggieBundle(req, res) {
  snuggie.handler(req, function(err, bundle) {
    if (err) return snuggie.respond(res, JSON.stringify(err))
    var minified = minifyBundle(bundle, req, res)
    serveGzip(minified, req, res)
  })
}

function minifyBundle(bundle) {
  return uglify.minify(bundle, {fromString: true}).code
}

function serveGzip(bundle, req, res) {
  var body = JSON.stringify({bundle: bundle})
  var accept = req.headers['accept-encoding']
  if (!accept || !accept.match('gzip')) return snuggie.respond(res, body)
  zlib.gzip(body, function(err, buffer) {
    res.setHeader('Content-Encoding', 'gzip')
    snuggie.respond(res, buffer)
  }) 
}

function serveEmbed(req, res) {
  filed('www/embed.html').pipe(res)
}

var http = require('http').createServer(function(req, res) {
  // checks if active session for github publishing
  checkSession(req, res)

  // matches foo.com/324839425 (gist id)
  // treat these as if they were /
  var gistID = req.url.match(/^\/(\d+)$/)
  if (gistID) req.url = req.url.replace(gistID[1], '')
  
  // github login
  if (req.url.match(/\/login/)) return github.login(req, res)
  if (req.url.match(/\/callback/)) return github.callback(req, res)
  
  // iframe embed
  var playID = req.url.match(/^\/play\/(\d+)$/)
  if (playID) playID = playID[1]
  if (playID) return serveEmbed(req, res)
  
  // serve embeds the static files from /
  if (req.url.match(/^\/play\//)) req.url = req.url.replace('play/', '')

  // rules: all GET are static
  if (req.method === "GET") return ecstatic(req, res)
  
  // gist saving
  if (req.url.match(/\/save/)) return saveGist(req, res)
  
  res.end('EEEK!')
}).listen(80)
