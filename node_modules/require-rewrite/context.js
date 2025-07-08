//------------------------------------------------------------------------------
const Fs = require('fs');
const Path = require('path');
const util = require('util');

// Look for these files when searching for a config. Look in the order here.
const CONFIG_FILES = [
  'require-rewrite.json', // visible
  '.require-rewrite.json', // hidden
  'package.json', // default
];

// Map package-path => `Context`
const packages = new Map();

// Global resolver: Whatever is defined here is resolved for all modules!
let globalResolver = null;

const debug = util.debuglog('require-rewrite');

//------------------------------------------------------------------------------
// Resolves via a regular expression (via `String.replace()`).
const regexpResolver = (expr, dst) => {
  expr = (typeof expr === 'string')
    ? new RegExp(expr)
    : expr;
  return (request) => expr.test(request) && request.replace(expr, dst);
};

//------------------------------------------------------------------------------
// Resolves via a subtring match. So if `request` begins with `src`, `src` is
// replaced with `dst`.
const substrResolver = (src, dst) =>
  (request) =>
    request.startsWith(src) && `${dst}${request.substr(src.length)}`;

// Map resolver types to factory functions.
const resolverTypes = {
  match: regexpResolver,
  alias: substrResolver,
};

//------------------------------------------------------------------------------
const isFile = (path) => {
  try {
    const stats = Fs.statSync(path);
    return stats && stats.isFile();
  } catch (error) { } //eslint-disable-line
  return false;
};

//------------------------------------------------------------------------------
// Like `Path.dirname()`, but returns `null` after reaching the root.
const dirnameIf = (path) => {
  const parent = Path.dirname(path);
  return (parent && (path !== parent))
    ? parent
    : null;
};

//------------------------------------------------------------------------------
const findConfigfile = (path) => {
  path = Path.extname(path) ? Path.dirname(path) : path;
  for (let current = path; current; current = dirnameIf(current)) {
    const file = CONFIG_FILES.find(name => isFile(Path.join(current, name)));
    if (file) {
      return Path.join(current, file);
    }
  }
  return '';
};

//------------------------------------------------------------------------------
// Both `pub` and `priv` will receive all methods of `pub` bound to `priv`.
// This means, they will share all public methods, but the privates (methods and
// properties) will be accessible only from within.
/*
const implementPriv = (pub, priv) => {
  const prototype = Object.getPrototypeOf(pub);
  Object.getOwnPropertyNames(prototype)
    .filter(name => name !== 'constructor')
    .forEach(fnName => {
      pub[fnName] = priv[fnName] = pub[fnName].bind(priv);
    });
};
*/

//------------------------------------------------------------------------------
const applyConfig = (config, resolver) => {
  if (config.include) {
    if (!Array.isArray(config.include)) {
      throw new Error('require-rewrite Config: "include" needs to be an array');
    }
    const i = config.include.indexOf('%');
    if (i === -1) {
      resolver.preIncludes = config.include.map(resolver.resolvePath);
    } else {
      resolver.preIncludes = config.include.slice(0, i)
        .map(resolver.resolvePath);
      resolver.postIncludes = config.include.slice(i + 1)
        .map(resolver.resolvePath);
    }
  } else {
    // ## compatibility 0.1.1
    if (config.before) {
      if (!Array.isArray(config.before)) {
        throw new Error('require-rewrite Config: "before" needs to be an array');
      }
      resolver.preIncludes = config.before.map(resolver.resolvePath);
    }

    if (config.after) {
      if (!Array.isArray(config.after)) {
        throw new Error('require-rewrite Config: "after" needs to be an array');
      }
      resolver.postIncludes = config.after.map(resolver.resolvePath);
    }
    // ## END compatibility 0.1.1
  }

  if (config.map) {
    if (!Array.isArray(config.map)) {
      throw new Error('require-rewrite Config: "map" needs to be an array');
    }
    config.map.forEach(entry => {
      if (Array.isArray(entry)) {
        resolver.use(...entry);
      } else if (typeof entry === 'string') {
        resolver.use(entry);
      } else {
        throw new Error('require-rewrite Config: entry in "map" needs to be an array or string.');
      }
    });
  }
};

//------------------------------------------------------------------------------
const loadConfig = (configFile) => {
  const fileName = Path.basename(configFile);
  const pkg = JSON.parse(Fs.readFileSync(configFile, 'utf-8'));
  const config = (fileName === 'package.json')
    ? pkg.requireRewrite
    : pkg;
  const name = pkg.name || null;
  return { config, name };
};

let resolverCount = 0;
//------------------------------------------------------------------------------
class Context {
  constructor(packagePath = '', configFile = null) {
    this.path = packagePath;
    this.name = `Resolver ${resolverCount++}`;
    this.resolvePath = this.resolvePath.bind(this);

    // create public interface: methods
    this.publicIf = {};
    ['use'].forEach(name => {
      this.publicIf[name] = this[name].bind(this);
    });

    // getter
    Object.defineProperty(this.publicIf, 'pre', { get: () => this.preIncludes, enumerable: true });
    Object.defineProperty(this.publicIf, 'post', { get: () => this.postIncludes, enumerable: true });
    Object.defineProperty(this.publicIf, 'global', { get: () => globalResolver.publicIf, enumerable: true });

    this.reset();

    // Set early even if loading config fails, so the resolver exists
    // and will not be attempted to load again.
    packages.set(packagePath, this);

    if (isFile(configFile)) {
      try {
        const { config, name } = loadConfig(configFile);
        if (name) {
          this.name = name;
        }
        if (config) {
          debug(`(${this.name}) Config loaded from ${configFile}`);
          applyConfig(config, this);
        }
      } catch (error) {
        // reset, but keep in map
        this.reset();
        throw error;
      }
    }

    debug(`(${this.name}) new Context for "${packagePath}"`);
  }

  reset() {
    this.resolver = [];
    this.preIncludes = [];
    this.postIncludes = [];
  }

  use(src, dst, type = 'alias') {
    if (typeof src === 'function') {
      return this.add(src);
    }
    const createResolver = resolverTypes[type];
    if (!createResolver) {
      throw new Error(`require-rewrite Unknown type "type". Only allowed are: ${Object.keys(resolverTypes).join(', ')}.`);
    }
    dst = dst || src;
    const resolver = createResolver(src, dst);
    resolver.type = type;
    this.add(resolver);
  }

  add(resolver) {
    this.resolver.unshift(resolver);
  }

  resolvePath(path) {
    return Path.resolve(this.path, path);
  }

  resolve(request, parent) {
    for (const resolver of this.resolver) {
      let result = resolver(request, parent);
      if (result) {
        result = Path.resolve(this.path, result);
        debug(`(${this.name}) rewrite ${request} => ${result}`);
        return result;
      }
    }
    return false;
  }
}

//------------------------------------------------------------------------------
Context.get = (path, create = false) => {
  // Without the `create`-flag it's not necessary to actually search for a
  // config. Just traverse the path up util it matches an entry in `packages`.
  // This might speed up things a bit.
  if (!create) {
    path = Path.extname(path) ? Path.dirname(path) : path;
    for (let current = path; current; current = dirnameIf(current)) {
      const found = packages.get(current);
      if (found) {
        return found;
      }
    }
    return;
  }
  const configFile = findConfigfile(path);
  const configPath = (configFile && Path.dirname(configFile)) || '/';
  return packages.get(configPath) || new Context(configPath, configFile);
};

//------------------------------------------------------------------------------
// Initialize the global resolver.
// Note that the global resolver is NOT the same as the resolver created for
// '/' when no config file was found.
// This one has an EMPTY path!
globalResolver = new Context();

//------------------------------------------------------------------------------
module.exports = {
  Context,
  getGlobalResolver: () => globalResolver,
  // these are just exported for unit tests
  regexpResolver,
  substrResolver,
  loadConfig,
  findConfigfile,
  applyConfig,
  packages,
};
