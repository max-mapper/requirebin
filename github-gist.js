var Github = require('github-api')
var jsonp = require('jsonp')

module.exports = exports = Gist = function(options){
  this.github = new Github(options)
}

Gist.prototype.save = function(gist, id, opts, callback) {

  var github = this.github

  var complete = function(err, gistId){

    if (err){
      if (typeof err !== 'string') err = JSON.stringify(err)
      var err = Error(err)
    }

    callback(err, gistId)
  };

  github.getGist(id).read(function (err) {
    if (err && err.error === 404) {
      // a gist with this id does not exist. create a new one:
      github.getGist().create(gist, function(err, data) {
        if (err) return complete(err)
        complete(null, data)
      })
      return
    }
    // check for non-404 error
    if (err) return complete('get error' + JSON.stringify(err));

    // The gist exists. Update it:
    github.getGist(id).update(gist, function (err, data) {
      if (!err) return complete(null, data) // successful update.

      // Arbitrary error while updating
      if (err.error !== 404) return complete(err)

      github.getGist(id).fork(function (err, data) {
        if (err) return complete(err) // failed to fork

        github.getGist(data.id).update(gist, function (err, data) {
          if (err) return complete(err) // failed to update fork

          return complete(null, data) // successful fork update
        })
      })

    })
  });
}

Gist.prototype.load = function(id, callback) {
  return jsonp('https://api.github.com/gists/' + id, callback)
}
