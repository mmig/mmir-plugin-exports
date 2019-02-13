
var fs = require('fs');
var path = require('path');
var pathParse = require('path-parse');

const OUTPUT_FILE_NAME = 'module-ids.js';

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

  var code = 'var _id = ';

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

function renameBackupFile(file){
  var origFile = file;
  var count = 1;
  var fileInfo = pathParse(file);
  if(process.env.verbose) console.log('  exports-gen: checking if file '+origFile+' already exists... ');
  while(fs.existsSync(file) && count < 100){
    file = path.resolve(fileInfo.dir, fileInfo.name + count + '.bak');
    if(process.env.verbose) console.log('  exports-gen: checking if file '+path.basename(file)+' already exists...');
    ++count;
  }
  if(count < 100){
    if(file !== origFile){
      if(process.env.verbose) console.log('  exports-gen: renaming existing file '+path.basename(origFile)+' to '+path.basename(file));
      fs.renameSync(origFile, file);
    }
    return file;
  }
  throw new Error('Could not rename existing file: already too many backups ('+count+') for ' + origFile);
}

function storeExports(dir, code, fileName){
  fileName = fileName || OUTPUT_FILE_NAME;
  var file = path.resolve(dir, fileName);
  renameBackupFile(file);
  fs.writeFileSync(file, code);
  if(process.env.verbose) console.log('  exports-gen: created file '+file+'.');
  return file;
}

module.exports = {
  generateCode: generateExportsCode,
  writeToFile: storeExports,
  getDefaultFileName: function(){ return OUTPUT_FILE_NAME; }
}
