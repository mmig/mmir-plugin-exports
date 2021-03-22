
var fileUtils = require('./file-utils.js');

const OUTPUT_FILE_NAME = 'module-ids.gen.js';

const FILES_FIELD_NAME = 'files';
const MODULES_FIELD_NAME = 'modules';

/**
 * HELPER adds all entries from source to target, if it is not already contained
 * @param       {Array} target the target list
 * @param       {Array} source the source list
 * @param       {Set} dupl a set holding all enries that are already contained
 *                           in target (will be updated when entries are added to target)
 */
var _joinTemplate = function _join(target, source, dupl){
  source.forEach(function(item){
    if(!dupl || !dupl.has(item)){
      dupl && dupl.add(item);
      target.push(item);
    }
  });
};

/**
 * HELPER for converting a list into a set / "duplicate dictionary"
 * @param       {Array|Object|Set} list a list or object that should be converted to a set / "duplicate dictionary" (for Object: convert its keys to duplicate entries)
 * @returns     {Set} a set holding with enries (keys) from the list
 *
 */
var _toDictTemplate = function _toDict(list){
  if(typeof list.has === 'function' && typeof list.add === 'function'){
    return list;
  }
  if(typeof list[Symbol.iterator] !== 'function'){
    list = Object.keys(list);
  }
  return new Set(list);
};

/**
 * HELPER returns all entries for field <code>type</code>, (recursively) including the
 *        corresponding field from dependencies
 * @param       {"paths" | "workers" | "modules" | "dependencies" | "files"} type the field for which to gather entries
 * @param       {"min" | String} [mode] OPTIONAL if the type should be modified according to a mode
 * @param       {Boolean} [isResolve] OPTIONAL for type "paths" will make the paths absolute w.r.t. the corresponding module/dependency
 *                                             (NOTE the absolute path may not be normalized, i.e. contain mixed path separators);
 * @return      {Object|Array} the "collected" entries for the requested type
 */
var _getAllTemplate = function _getAll(type, mode, isResolve){

  if(typeof mode === 'boolean'){
    isResolve = mode;
    mode = void(0);
  }

  var data = this[type];
  var isArray = Array.isArray(data);
  var result = isArray? [] : Object.assign({}, data);
  var dupl;
  var mod = mode && this.modes[mode];
  if(isArray){
    dupl = new Set();
    if(mod && mod[type]){
      _join(result, this.modes[mode][type], dupl);
    }
    _join(result, data, dupl);
  } else if(isResolve){
    var root = __dirname;
    Object.keys(result).forEach(function(field){
      var val = result[field];
      if(mod && mod[field]){
        val = _paths[mod[field]];
      }
      result[field] = root + '/' + val;
    });
  }
  this.dependencies.forEach(function(dep){
    var depExports = require(dep + '/module-ids.gen.js');
    var depData = depExports.getAll(type, mode, isResolve);
    if(isArray){
      _join(result, depData, dupl);
    } else {
      Object.assign(result, depData)
    }
  });

  return result;
};

/**
 * HELPER returns list of (mmir) build configurations (to be merged into the main mmir build configuration)
 *
 * @param       {String} [pluginName] OPTIONAL if specified and multiple plugin-definitions are specified, only the build-configs for the specified plugin are include (note: filter does not apply recursively to dependencies)
 * @param       {Object|Array|Set} [buildConfigsMap] OPTIONAL a map for already included buildConfigs: {[buildConfig: BuildConfig]: Boolean}
 * @return      {Array<BuildConfig>} a list of (mmir) build configurations; may be empty
 */
var _getBuildConfigTemplate = function _getBuildConfig(pluginName, buildConfigsMap){
  if(pluginName && typeof pluginName !== 'string'){
    buildConfigsMap = pluginName;
    pluginName = void(0);
  }
  var buildConfigs = [];
  var dupl = buildConfigsMap? _toDict(buildConfigsMap) : new Set();
  if(_buildConfig){
    var buildConfigMod = require(__dirname+'/'+_buildConfig);
    var buildConfig = buildConfigMod.buildConfigs;
    if(Array.isArray(buildConfig)){
      _join(buildConfigs, buildConfig, dupl);
    } else if(buildConfig && !dupl.has(buildConfig)){
      dupl.add(buildConfig);
      buildConfigs.push(buildConfig);
    }
    if(Array.isArray(buildConfigMod.pluginName) && buildConfigMod.plugins){
      buildConfigMod.pluginName.forEach(function(name){
        if(!pluginName || pluginName === name){
          var pluginBuildConfig = buildConfigMod.plugins[name].buildConfigs;
          if(Array.isArray(pluginBuildConfig)){
            _join(buildConfigs, pluginBuildConfig, dupl);
          } else if(pluginBuildConfig && !dupl.has(pluginBuildConfig)){
            dupl.add(pluginBuildConfig);
            buildConfigs.push(pluginBuildConfig);
          }
        }
      });
    }
  }

  this.dependencies.forEach(function(dep){
    var depExports = require(dep + '/module-ids.gen.js');
    if(depExports.buildConfig){
      var depBuildConfigs = depExports.getBuildConfig(null, dupl);
      _join(buildConfigs, depBuildConfigs);
    }
  });

  return buildConfigs;
};

function generateExportsCode(packageId, paths, workers, mainModules, dependencies, exportedFiles, modes, buildConfigFiles){

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

  code += 'var _exportedFiles = ';

  code += JSON.stringify(exportedFiles, null, 2) + ';\n';

  code += 'var _modes = ';

  code += JSON.stringify(modes, null, 2) + ';\n';

  code += 'var _buildConfig';
  if(buildConfigFiles && buildConfigFiles.length > 0){
    code += ' = ';
    if(buildConfigFiles.length > 1){
      throw new Error('Encountered multiple build config files for '+packageId+', only a single build config file is supported: '+buildConfigFiles.join(', '));
    }
    code += JSON.stringify(buildConfigFiles[0], null, 2)
  }
  code += ';\n';

  code += _joinTemplate.toString() + ';\n';
  code += _toDictTemplate.toString() + ';\n';
  code += _getAllTemplate.toString() + ';\n';
  code += _getBuildConfigTemplate.toString() + ';\n';

  code += 'module.exports = {id: _id, paths: _paths, workers: _workers, '+
              MODULES_FIELD_NAME+': _exportedModules, '+
              FILES_FIELD_NAME+': _exportedFiles, '+
              'dependencies: _dependencies, modes: _modes, buildConfig: _buildConfig, '+
              'getAll: _getAll, getBuildConfig: _getBuildConfig};\n';

  return code;
}

function storeExports(dir, code, fileName){
  fileName = fileName || OUTPUT_FILE_NAME;
  return fileUtils.storeToFile(dir, code, fileName);
}

module.exports = {
  generateCode: generateExportsCode,
  writeToFile: storeExports,
  getDefaultFileName: function(){ return OUTPUT_FILE_NAME; },
  getExportedFilesFieldName: function(){ return FILES_FIELD_NAME; },
  getExportedModulesFieldName: function(){ return MODULES_FIELD_NAME; }
}
