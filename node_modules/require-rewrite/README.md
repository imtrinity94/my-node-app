# require-rewrite

Customized module management with include paths, aliases and rewrites.

## About

When you work with node.js, you probably know these ugly critters:

```js
const { stringify, printf } = require('../../../../lib/tools/stringtools');
const Model = require('../../../model');
...
```

That's ugly, it hurts the eye, and it's impossible to maintain. Moving such a file,
or worse, a whole folder, can really spoil your day. That's where require-rewrite
comes into play.

There are solutions for this, hacky ones, and really clever ones, that do a great job.
So why add another one? Well, I believe my solution has a few advantages.

* require-rewrite is fully [package-aware](#package-awareness), means, you define your module paths and aliases on a
  per-package level, and they stay completely separated.
* You can setup global definitions that are valid for all modules. This allows e.g. quickly
  switching out an installed package against a development version in some other folder.
* You can use regular expressions.
* You can use your own resolver functions.
* It gives you fine control over the includes, you can add your own module paths before
  or after the default node module paths (or both).

## Usage

```
npm install require-rewrite
```

As the first thing in you application, do:

```js
require('require-rewrite')(__dirname);
// or, if you need the API:
// const requireRewrite = require('require-rewrite')(__dirname);
```

That will initialize require-rewrite for the package the requiring file is part of.

## Configuration

The preferred way of using require-rewrite is through a [config file](#config-files), most likely
your `package.json`. Add a section:

```json
"requireRewrite": {
  "map": [],
  "include": []
}
```

Where:

`map` contains [aliases](#aliases) and [regular expressions](#regular-expression-matches) (optional).  
`include` contains [includes](#includes) (optional).  

### Aliases

The easiest way to get an alias is for a folder below the location of your `package.json`:

```json
"requireRewrite": {
  "map": [
    "src/"
  ]
}
```

Since relative paths are resolved against the location of the config file
(`package.json` here), this maps `src` to `./src` in your project folder.

So when you do a `require('src/a')`, you will get `./src/a`.

To alias a different location, use an array instead of a string:

```json
"requireRewrite": {
  "map": [
    ["src/", "dst/"],
  ]
}
```

The array contains the `[from, to]`-values for an alias, so in this case,
`src/a` will resolve to `./dst/a`.

Aliases will be evaluated in reversed insertion order, means, last one first.
This is, so when you add aliases via the [API](#api) after the configuration was already
read from a config file, those added later take precedence.

**Note:** It's a good idea to append a `/` to each `from` and `to`, since otherwise
a `from` of `lib` would match `lib/file.js` as well as `libsomething/file.js`, which
is probably not what you want.

There can be a third argument in the map-entry: `type`, which can be `alias` (default, if
not provided) or `match` for a regular expression match.

### Regular expression matches

```json
"requireRewrite": {
  "map": [
    ["^lib/([^/]+)/([^/]+)/(.*)", "lib/$2/$1/$3", "match"],
  ]
}
```

rewrites `lib/lll/ggg/...` to `lib/ggg/lll/...`, `lib/fff/zzz/...` to `lib/zzz/fff/...` etc.

### Includes

```json
"requireRewrite": {
  "include": [
    "lib", "%", "src"
  ]
}
```

This adds `lib` to the list of paths to search for modules, _before_ the default
node module paths, and `src` _after_ the defaults.

Note the `'%'`, which marks the default paths. If you omit that, all paths will be
added before the default paths.

## Package awareness

Being package-aware means, require-rewrite considers each module part of the package
identified by the first `package.json` (or config file, see below) it finds, when
traversing from the module's location up to the root folder.

It will then use the settings from that config file, if any exists, for
resolving `require`s made from that module. 

Package awareness has some advantages over simply checking if a module resists in a folder
`node_modules`. First you might have reasons to put some of your files in
a `node_modules`-folder, and second it reflects the way how node-applications are
logically structured. You are using packages, not folders.

Both your application and the packages you have installed will be able to use require-rewrite, and each package will have its own, isolated context.

## Config files

The following files are considered config-files:

`require-rewrite.json`  
`.require-rewrite.json`  
`package.json`

They are searched in that order, means, an existing `require-rewrite.json` takes
precedence over `.require-rewrite.json`, which takes precedence over `package.json`.

Although you don't have to put your configuration in `package.json`, it is higly
recommended, for the following reason:

If you, or any of your fellow colleagues, need a local configuration that differs from what is in
`package.json`, they can create a local `require-rewrite.json`, and add that to `.gitignore`.
The local configuration will be used, and the repository stays clean.

But wait - there is more!

Since a configuration file is considered to mark a package-root, you can define
separate contexts even for different folders inside your project. So you can
e.g. have `lib` resolved to a different location for your folders `frontend` and `backend`:

```
─ project-root
  ├─ frontend
  │  ├─ lib
  │  ├─ ...
  │  └─ .require-rewrite.json <- resolves 'lib' to src/frontend/lib
  └─ backend
     ├─ lib
     ├─ ...
     └─ .require-rewrite.json <- resolves 'lib' to src/backend/lib
```

The `frontend` and `backend` folders are treated as if they were separate packages
and will have their own context, defined via the `.require-rewrite.json` files.

## API

What you get, when you `require` require-rewrite, is a context for the package
your file is part of (that's why you have to pass `__dirname`). Such a context
looks like this:

### Context

#### `use(from[, to = from][, type = 'alias'])`

The threee arguments are exactly what you find in your config file for each entry:

```json
"requireRewrite": {
  "map": [
    ["src/", "dst/", "alias"],
  ]
}
```

To do the same via the API, just call:

```js
requireRewrite.use('src/', 'dst/');
```

And obviously for the one-argument-version:

```js
requireRewrite.use('src/');
```

Besides that, you can specify the `type`, which can be `alias` for a simple string
alias, or `match` for a regular expression match/replace.

And there is a third way to call it, with a `function`:

```js
const myResolver = (request, parent) => {
  // Resolve request and return a rewritten request
  // which can then be resolved by node.
  // If the request couldn't be resolved,
  // return a falsy value.
};

requireRewrite.use(myResolver);
```

This allows you to completely mess up your application by defining a dynamic resolver,
that resolves to different locations based on your application state (or maybe your
`NODE_ENV`).

Remember that resolver are called in reverse order, means, last one added is first
one called. So you effectively overwrite existing resolvers for a certian request.

#### `pre`, `post`

Gives you access to the array with the includes before / after default includes.
You can manipulate the array directly with array functions like `splice()`.

Note that the paths there, unless absolute, are resolved against the current
workdirectory. They are passed as-is to the module resolving process.

Include paths read from configuration files are already resolved against the config
file location.

```js
// add some include path
requireRewrite.pre.push(Path.join(__dirname, '..', 'otherlib'));
```

#### `global`

Gives you access to the global context. Whatever you set there is valid for all packages.
