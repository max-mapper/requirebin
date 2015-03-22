// for production:

var envs = {
  production: {
   GITHUB_CLIENT: 'f7b1530b019cbb2619d5',
   GATEKEEPER: 'http://gatekeeper.maxogden.com',
   BROWSERIFYCDN: 'https://wzrd.in'
  },
  dev: {
    GITHUB_CLIENT: '77ca0223691ae7245419', // redirect goes to localhost:5000
      GATEKEEPER: 'http://localhost:9999',
    BROWSERIFYCDN: 'https://wzrd.in'
  }
}

module.exports = envs.production
