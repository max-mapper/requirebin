var Github = require('github-api')

module.exports = exports = Gist = function(options){
  this.github = new Github(options)
}

Gist.prototype.save = function(gist, id, opts, callback) {

  var github = this.github

  var complete = function(err){
    if (err){
      if (typeof err !== 'string')
        err = JSON.stringify(err)

      throw new Error(err)
      alert(JSON.stringify(err))
    }
    callback()
  };

  github.getGist(id).read(function (err) {
    if (err && err.error === 404) {
      github.getGist().create(gist, function(err, data) {
        if (err) return complete(err)
        window.location.href = "/?gist=" + data.id
      })
      return complete()
    }
    if (err) return complete('get error' + JSON.stringify(err));
    github.getGist(id).update(gist, function (err, data) {
      if (!err) return complete()
      if (err && err.error === 404) {
        github.getGist(id).fork(function (err, data) {
          if (err) return complete(err)
          github.getGist(data.id).update(gist, function (err, data) {
            loadingClass.add('hidden')
            if (err) return complete(err)
            window.location.href = "/?gist=" + data.id
          })
        })
        return complete()
      }
      if (err) return complete(err);
    })
  });
}

