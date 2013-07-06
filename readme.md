# requirebin

create programs in the browser using modules from NPM

the app itself is 100% client side (requirebin.com is hosted on github pages) but it relies on these two APIs:

- https://github.com/jesusabdullah/browserify-cdn
- https://github.com/prose/gatekeeper

both can be hosted anywhere, the instances used by requirebin.com are hosted on a linode VPS and nodejitsu, respectively


## getting it to run locally

- set up browserify-cdn and/or gatekeeper servers
- edit `config.json`

```
npm install
npm start
```

## license

BSD