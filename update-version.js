
const path = require('path');
const fs = require('fs-extra');
const fileUtils = require('./file-utils');
const packageUtils = require('./package-utils');
const modUtil = require('./config-mod/mod-utils');

const configFiles = [
  'config.xml',
  'plugin.xml',
  'package.json',
  'package-lock.json'
]

function updateVersion(target, opts, cb){

  var targetPath = path.resolve(target);

  if(!fs.existsSync(targetPath)){
    cb(new Error('target path does not exists: ', targetPath));
  }

  var targetDir = targetPath;

  if(!fileUtils.isDirectory(targetPath)){
    targetDir = path.dirname(targetPath);
    _loadPromise(targetPath).then(function(res){
      processConfigs(null, [res]);
    }).catch(function(err){
      cb(err);
    });
  } else {
    // do exclude config files that are neither needed to read from (for extracting version),
    // nor are targeted to be modified (version changed)
    var filterList = [];
    if(opts.fromPackage || !opts.disablePackage) filterList.push('package.json');
    if(opts.fromConfig || !opts.disableConfig) filterList.push('config.xml');
    if(opts.fromPlugin || !opts.disablePlugin) filterList.push('plugin.xml');
    if(opts.enablePackageLock) filterList.push('package-lock.json');
    loadConfigFiles(targetPath, processConfigs, filterList);
  }

  function processConfigs(err, configInfos){
    if(err){
      return cb(err);
    }

    var ver = opts.setVersion;
    var src;
    if(!ver){
      if(opts.fromPackage){
        src = 'package';
      } else if(opts.fromConfig){
        src = 'project';
      } else if(opts.fromPlugin){
        src = 'plugin';
      }
      ver = _getVersionFromEntry(src, configInfos);
      if(process.env.verbose) console.log('  read version from '+src+' configuration: ', ver)
    }
    else if(process.env.verbose) console.log('  using version from argument ', ver);

    if(!ver){
      var entry = _getEntry(src, configInfos);
      return cb(new Error('No version found in file  '+ (entry? entry.path : '<NA>')));
    }

    // console.log('loaded config files', configInfos.map(function(c){//DEBUG
    //   var c2 = Object.assign({},c)
    //   c2.content = null;
    //   return c2
    // }));

    configInfos = configInfos.filter(function(info){
      if(
        (info.type === 'project' && opts.disableConfig) ||
        (info.type === 'plugin' && opts.disablePlugin)
      ){
        return false;
      } else if(info.type === 'package' && opts.disablePackage){
        // console.log('filter? ', opts.disablePackage , info.lock);//DEBUG
        return info.lock;
      }
      return true;
    });

    // console.log('writing version '+ver+' to ', configInfos.map(function(c){//DEBUG
    //   var c2 = Object.assign({},c)
    //   c2.content = null;
    //   return c2
    // }));

    var tasks = [], written = [], unchanged = [];
    configInfos.forEach(function(info, i){

      // replaceAttrValue(positionResult, newAttrValue, callback, onlyFirst)
      modUtil.replaceAttrValue(info, ver, function(err, result){
        if(err){
          return cb(err);
        }

        var filePath = info.path;
        if(result){

          // //TEST write to differnt dir
          // var file = filePath;
          // var f = path.basename(file);
          // var p = path.dirname(file);
          // filePath = path.join(p+'_MOD2', f);//FIXME
          // fs.emptyDirSync(path.dirname(filePath));//FIXME

          tasks.push(fs.writeFile(filePath, result, 'utf8'));
          written[i] = filePath;
          if(process.env.verbose) console.log('  writing modified config file ', filePath);
        } else {
          if(process.env.verbose) console.log('  did not write unchanged file ', filePath);
          unchanged[i] = filePath;
        }

      }, {
        parser: modUtil.getParserFor(info.ext),
        onlyFirst: true
      });
    });

    var rm = function(e){ return e};
    if(tasks.length > 0){
      Promise.all(tasks).then(function(results){
        var errs = results.filter(rm);
        cb(errs.length > 0? errs : null, {
          version: ver,
          changed: written.filter(rm),
          unchanged: unchanged.filter(rm),
          root: targetDir
        });
      });
    } else {
      if(process.env.verbose) console.log('Did not update version in any files');
      cb(null, {
        version: ver,
        changed: written.filter(rm),
        unchanged: unchanged.filter(rm),
        root: targetDir
      });
    }
  }
}

/**
 * load all available config files from a directory:
 *  config.xml, plugin.xml, package.json
 *
 * @param  {string} dirPath the target directory (only this root directory will be scanned for config files)
 * @param  {Function} cb callback <pre>callback(err: null | Error, result: VersionPositionResult[])</pre>
 * @param  {RegExpr} [filter] file-name filter (if omitted all available config files will be loaded)
 * @param  {boolean} [isExludeFilter] if file-names matching filter should be exclude (instead of included)
 *
 */
function loadConfigFiles(dirPath, cb, filterOrList, isExludeFilter){
  const fileList = Array.isArray(filterOrList)? filterOrList : configFiles.filter(function(cf){
    return _exists(dirPath, cf, filterOrList, isExludeFilter);
  });
  const tasks = fileList.map(function(cf){
    const p = path.resolve(dirPath, cf);
    const type = _fileType(cf);
    return _loadPromise(p, type);
  });

  Promise.all(tasks).then(function(results){
    cb(null, results);
  }).catch(function(err){
    cb(err);
  });
}

/**
 * get the version value of the entry with the config type from list
 * @param       {"plugin" | "project" | "package"} type the config type
 * @param       {VersionPositionResult[]} list the list of parsed configs
 * @constructor
 * @return      {string | undefined} the version of the found config entry, or undefined if none was found
 */
function _getVersionFromEntry(type, list){
  var e = _getEntry(type, list);
  return e? e.value : void(0);
}

/**
 * get entry with the config type from list
 * @param       {"plugin" | "project" | "package"} type the config type
 * @param       {VersionPositionResult[]} list the list of parsed configs
 * @constructor
 * @return      {VersionPositionResult | undefined} the found config entry, or undefined if none was found
 */
function _getEntry(type, list){
  return list.find(function(entry){
    return entry.type === type && (type !== 'package' || !entry.lock);
  });
}

/**
 * determine the file type: xml or json
 * @param       {string} filePath file path
 * @return      {"json" | "xml"} [description]
 */
function _fileType(filePath){
  return /\.xml$/i.test(filePath)? 'xml' : 'json';
}

/**
 * HELPER load and parse config file for the version information
 * @param       {string} filePath the config file path
 * @param       {"json" | "xml"} [type] if omitted will be detected from file extension
 * @return      {Promise<VersionPositionResult>} the loading & parsing result, see #_posToRes
 */
function _loadPromise(filePath, type){
  type = type || _fileType(filePath);
  return new Promise(function(resolve, reject){
    const cb = function(err, res){
      if(err) reject(err)
      else resolve(res);
    };
    type === 'xml'? getFromXml(filePath, cb) : getFromJson(filePath, cb);
  });
}

/**
 * HELPER check if file exists AND if it matches filter
 * (if no filter is defined, only existence is checked)
 *
 * @param       {string} dir directory path
 * @param       {string} file file name
 * @param       {RegExpr} [filter] filter for the file name
 * @param       {boolean} [isExludeFilter] if file-names matching filter should be exclude (instead of included)
 * @return      {boolean} true if the file exists
 */
/**
 * [_exists description]
 * @param       {[type]} dir [description]
 * @param       {[type]} file [description]
 * @param       {[type]} filter [description]
 * @param       {Boolean} isExludeFilter [description]
 * @constructor
 * @return      {[type]} [description]
 */
function _exists(dir, file, filter, isExludeFilter){
  if(!filter || (isExludeFilter? !filter.test(file) : filter.test(file))){
    return fileUtils.exists(dir, file);
  }
  return false;
}

/**
 * HELPER for normalizing position-retrieval result for json and xml files
 * @param       {Error|null} error if there was an error
 * @param       {PositionResult} posResult the position result
 * @param       {"plugin" | "project" | "package"} type the type of the config file
 * @param       {string} filePath the path of the config file
 * @return      the position normlized position result:
 *              <pre>{
 *                value: string // the version value
 *                content: string // the raw string content of the config file
 *                type: "plugin" | "project" | "package"
 *                path: string // the file path of the config file
 *                ext: "json" | "xml" // the file extension (without dot)
 *                lock: boolean // true if file is a package-lock file
 *                positions: Position[]
 *              }</pre>
 */
function _posToRes(error, posResult, type, filePath, fileExt){
  if(error){
    return null;
  }
  var positions = posResult.positions;
  if(process.env.verbose && positions.length !== 1){
    console.warn('WARN unexpected number ('+positions.length+') of found "version" attributes in '+filePath);
  }
  var val;
  if(positions.length > 0){
    val = positions[0].attrValue;
  }
  return {
    value: val,
    type: type,
    positions: positions,
    content: posResult.content,
    path: filePath,
    ext: fileExt,
    lock: /-lock\.json$/.test(path.basename(filePath))
  };
}

function getFromJson(dirOrFile, cb){
  var dirPath = dirOrFile;
  if(!fileUtils.isDirectory(dirPath)){
    dirPath = path.dirname(dirPath);
  }
  var isLockFile = /^package-lock\.json$/i.test(path.basename(dirOrFile));
  var pkgInfo = packageUtils.getPackageInfo(dirPath);
  var jsonFilePath = pkgInfo.path;
  if(path.normalize(path.dirname(jsonFilePath)) != path.resolve(dirPath)){
    return cb(new Error('Did not find package.json at expected location: ', dirPath, ', instead found package.json at ', jsonFilePath));
  }

  if(isLockFile){
    jsonFilePath = jsonFilePath.replace(/\.json$/i, '-lock.json');
    if(!fs.existsSync(jsonFilePath)){
      return cb(new Error('File does not exist: ' + jsonFilePath));
    }
  }

  var attr = 'version';
  modUtil.getPositions(jsonFilePath, null, attr, function(err, posResult){
    cb(err, _posToRes(err, posResult, 'package', jsonFilePath, 'json'));
  }, {
    parser: modUtil.getParserFor('json'),
    breadthFirst: true
  });

  return pkgInfo.package;
}

function getFromXml(xmlFilePath, cb){

  var fileName = path.basename(xmlFilePath, '.xml');
  var attr = 'version';
  var type = fileName === 'plugin'? 'plugin' : 'project';
  var tag = type === 'plugin'? 'plugin' : 'widget';

  modUtil.getPositions(xmlFilePath, tag, attr, function(err, posResult){
    cb(err, _posToRes(err, posResult, type, xmlFilePath, 'xml'));
  }, {
    parser: modUtil.getParserFor('xml')
  });
}

module.exports = {
  updateVersion: updateVersion,
  getFromJson: getFromJson,
  getFromXml: getFromXml,
  loadConfigFiles: loadConfigFiles
}
