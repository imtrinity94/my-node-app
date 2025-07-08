//------------------------------------------------------------------------------
const { Context, getGlobalResolver } = require('./context');

const Module = module.constructor;

//------------------------------------------------------------------------------
const isNoPath = (path) => ((path[0] !== '.') && (path[0] !== '/'));

//==============================================================================
// Hooks

//------------------------------------------------------------------------------
// Module._resolveFilename
Module._resolveFilename = (_super => (request, parent, isMain, options) => {
  if (isNoPath) {
    const resolverAr = [getGlobalResolver()];
    const packageResolver = Context.get(parent.filename);
    if (packageResolver) {
      resolverAr.push(packageResolver);
    }
    for (const resolver of resolverAr) {
      const newRequest = resolver.resolve(request, parent);
      if (newRequest) {
        return _super(newRequest, parent, isMain, options);
      }
    }
  }

  return _super(request, parent, isMain, options);
})(Module._resolveFilename);

//------------------------------------------------------------------------------
// Module._resolveLookupPaths
Module._resolveLookupPaths = (_super => (request, parent, newReturn) => {
  const paths = _super(request, parent, newReturn);
  const packageResolver = Context.get(parent.filename);
  if (packageResolver) {
    return [
      ...packageResolver.preIncludes,
      ...paths,
      ...packageResolver.postIncludes,
    ];
  }
  return paths;
})(Module._resolveLookupPaths);

//------------------------------------------------------------------------------
// Module.prototype.load
Module.prototype.load = (_super => function (filename) {
  Context.get(filename, true);
  return _super.call(this, filename);
})(Module.prototype.load);

//==============================================================================
// main

module.exports = (path) => Context.get(path, true).publicIf;
