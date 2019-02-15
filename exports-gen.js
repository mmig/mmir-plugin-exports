
var fileUtils = require('./file-utils.js');

const OUTPUT_FILE_NAME = 'module-ids.gen.js';

/**
 * HELPER adds all entries from source to target, if it is not already contained
 * @param       {Array} source the source list
 * @param       {Array} target the target list
 * @param       {Object} dict a map holding all enries that are already contained
 *                           in target (will be updated when entries are added to target)
 */
var _joinTemplate = function _join(source, target, dict){
  source.forEach(function(item){
    if(!dict[item]){
      dict[item] = true;
      target.push(item);
    }
  });
};

/**
 * HELPER returns all entries for field <code>type</code>, (recursively) including the
 *        corresponding field from dependencies
 * @param       {"paths" | "workers" | "modules" | "dependencies"} type the field for which to gather entries
 * @param       {Boolean} [isResolve] OPTIONAL for type "paths" will make the paths absolute w.r.t. the corresponding module/dependency
 *                                             (NOTE the absolute path may not be normalized, i.e. contain mixed path separators);
 * @return      {Object|Array} the "collected" entries for the requested type
 */
var _getAllTemplate = function _getAll(type, isResolve){

  var data = this[type];
  var isArray = Array.isArray(data);
  var result = isArray? [] : Object.assign({}, data);
  var dupl = result;
  if(isArray){
    dupl = {};
    _join(data, result, dupl);
  } else if(isResolve){
    var root = __dirname;
    Object.keys(result).forEach(function(field){
      result[field] = root + '/' + result[field];
    });
  }
  this.dependencies.forEach(function(dep){
    var depExports = require(dep + '/module-ids.js');
    var depData = depExports.getAll(type, isResolve);
    if(isArray){
      _join(depData, result, dupl);
    } else {
      Object.assign(result, depData)
    }
  });

  return result;
};

function generateExportsCode(packageId, paths, workers, mainModules, dependencies){

  var code = fileUtils.fileHeader;

  code += 'var _id = ';

  code += JSON.stringify(packageId) + ';\n';

  code += 'var _paths = ';

  code += JSON.stringify(paths, null, 2) + ';\n';

  code += 'var _workers = ';

  code += JSON.stringify(workers, null, 2) + ';\n';


  code += 'var _exportedModules = ';

  code += JSON.stringify(mainModules, null, 2) + ';\n';

  code += 'var _dependencies = ';

  code += JSON.stringify(dependencies, null, 2) + ';\n';

  code += _joinTemplate.toString() + ';\n';
  code += _getAllTemplate.toString() + ';\n';

  code += 'module.exports = {id: _id, paths: _paths, workers: _workers, modules: _exportedModules, dependencies: _dependencies, getAll: _getAll};\n';

  return code;
}

function storeExports(dir, code, fileName){
  fileName = fileName || OUTPUT_FILE_NAME;
  return fileUtils.storeToFile(dir, code, fileName);
}

module.exports = {
  generateCode: generateExportsCode,
  writeToFile: storeExports,
  getDefaultFileName: function(){ return OUTPUT_FILE_NAME; }
}
