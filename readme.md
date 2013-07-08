# requirebin

create programs in the browser using modules from NPM

the app itself is 100% client side (requirebin.com is hosted on github pages) but it relies on these two APIs:

- https://github.com/jesusabdullah/browserify-cdn
- https://github.com/prose/gatekeeper (only necessary if you want to publish gists)

both can be hosted anywhere, the instances used by requirebin.com are hosted on a linode VPS and nodejitsu, respectively.

by default `config.js` is set to use `http://localhost:8000` as the browserify-cdn endpoint but feel free to use `http://wzrd.in` which is the one I host on a VPS (requires internet connection to use but )

## getting it to run locally

### set up browserify-cdn

```
npm install -g browserify-cdn
browserify-cdn 8000
```

### set up gatekeeper (only if you want to publish gists in dev mode)

1. make a new github oauth application and set the app URL and callback URL to `http://localhost:8080`
2. [follow these instructions](https://github.com/prose/gatekeeper#setup-your-gatekeeper) to install and start gatekeeper on port 9999

### edit `config.js` to point to your endpoints

```
npm install
npm start
open http://localhost:8080
```


## license

BSD