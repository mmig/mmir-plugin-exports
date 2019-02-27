
var fs = require('fs');
var path = require('path');

var readPackage = require('read-pkg-up');

var fileUtils = require('./file-utils.js');

//default sub-dir name (in directories entry) for whichs' files alias entries will be created
var srcDirName = 'lib';

//default entry name (in mmir entry) whichs' files will be treated as WebWorkers
var workersFieldName = 'workers';
//default entry name (in mmir entry) whichs' files will be treated as exported modules
var exportsFieldName = 'exports';

//default entry name (in mmir entry) whichs' files will be treated as exported files (i.e. as "raw" file, e.g. binary files etc)
var filesFieldName = 'exportFiles';


//default entry name (in mmir entry) for mode-definitions {[modeName: string]: ModeDefinition} where ModeDefinition: {[originalFilePath: string]: replacementFilePath, exports?, exportFiles?}
var modesFieldName = 'modes';

var reNormalize = path.sep === '/'? null : /\\/g;

var exportsGen = require('./exports-gen.js');

var exportModuleFilesFieldName = exportsGen.getExportedFilesFieldName();
var exportModuleModulesFieldName = exportsGen.getExportedModulesFieldName();

function normalize(absPath, absPackageRoot){
	if(!path.isAbsolute(absPath)){
		absPath = path.resolve(absPackageRoot, absPath);
	}
	var relPath = path.relative(absPackageRoot, absPath);
	return reNormalize? relPath.replace(reNormalize, '/') : relPath;
}

function addAlias(id, path, alias, packageId){
	if(alias[id]){
		console.log('ERROR['+packageId+'/webpack-alias-util]: ID "'+id+'" already exists ('+alias[id]+'), overwriting with new location: '+path);
	}
	if(process.env.verbose) console.log('  export-utils: adding alias entry ', id, ' -> ', path);//DEBUG
	alias[id] = path;
}

function getAliasEntry(path, alias){
	var existingId;
	Object.keys(alias).forEach(function(id){
		if(alias[id] === path){
			existingId = !existingId || existingId.length > id.length? id : existingId;
		}
	});
	return existingId;
}

function getFiles(dirPath){
	if(!fs.existsSync(dirPath)){
		throw new Error('file or directory does not exist: '+dirPath);
	}
	if(!fileUtils.isDirectory(dirPath)){
		return [path.resolve(dirPath)];
	}
	return fs.readdirSync(path.resolve(dirPath));
}

function toAliasId(file, packageId){
	return packageId + '/' + path.basename(file, '.js');
}

function addAliasForFiles(files, pid, alias, basePath, rootPath){

	var id, file;//, temp, name;
	files.forEach(function(f){
		file = path.resolve(basePath, f);
		if(fileUtils.isDirectory(file)){
			return;
		}
		// name = path.basename(f);
		// name = path.basename(f, '.js');
		id = toAliasId(f, pid);
		file = normalize(file, rootPath);
		// addAlias(pid + '/' + name, file, alias, pid);
		addAlias(id, file, alias, pid);
		// temp = name.replace(/\.js$/i, '');
		// if(temp !== name){
			// addAlias(pid + '/' + temp, file, alias, pid);
		// }
	});

	return alias;
};

function getSubDirs(resolvedDir, subdirList){

	subdirList = subdirList || [];

	var files = fs.readdirSync(resolvedDir);
	files.forEach(function(file){
		var subDir = path.resolve(resolvedDir, file);
		if(fileUtils.isDirectory(subDir)){
			subdirList.push(subDir);
			getSubDirs(subDir, subdirList);
		}
	});
	return subdirList;
}

function resolvePaths(root, dirList, recursively){

	dirList.forEach(function(dir, index){
		dirList[index] = path.resolve(root, dir);
	});

	if(recursively){
		var subDirs = [];
		dirList.forEach(function(dir){
			getSubDirs(dir, subDirs);
		});
		subDirs.forEach(function(d){
			dirList.push(d);
		});
	}
}

function getPackageInfo(forPackageDir){
	return readPackage.sync({cwd: forPackageDir});
}

function getAliasFor(packageInfo, rootPath, alias){

	if(Array.isArray(packageInfo) && alias){
		packageInfo.forEach(function(entry){
			getAliasFor(entry, rootPath, alias);
		});
		return;
	}

	alias = alias || {};

	var id = packageInfo.pkg.name;
	var pkgPath = path.dirname(packageInfo.path);

	var workersDirs = packageInfo.pkg.mmir && packageInfo.pkg.mmir[workersFieldName];
	if(workersDirs){
		if(!Array.isArray(workersDirs)){
			workersDirs = [workersDirs];
		}

		resolvePaths(pkgPath, workersDirs, false);
	}

	var srcDirs = packageInfo.pkg.directories && packageInfo.pkg.directories[srcDirName];
	if(srcDirs){
		if(!Array.isArray(srcDirs)){
			srcDirs = [srcDirs];
		}
		resolvePaths(pkgPath, srcDirs, true);
		srcDirs.forEach(function(srcDir){
			var isWorker = workersDirs && workersDirs.findIndex(function(wpath){ return srcDir.indexOf(wpath) === 0; }) !== -1;
			if(!isWorker){
				addAliasForFiles(getFiles(srcDir), id, alias, srcDir, rootPath);
			}
		});
	}


	if(workersDirs){
		workersDirs.forEach(function(workersDir){
			addAliasForFiles(getFiles(workersDir), id + '/workers', alias, workersDir, rootPath);
		});
	}

	return alias;
}

function getWorkerListFor(packageInfo, rootPath, list){

	if(Array.isArray(packageInfo) && list){
		packageInfo.forEach(function(entry){
			getWorkerListFor(entry, rootPath, list);
		});
		return;
	}

	list = list || [];

	var pkgPath = path.dirname(packageInfo.path);

	//if(process.env.verbose) console.log('  export-utils: looking for workers in ', packageInfo.pkg.name, ' -> ', packageInfo.pkg.directories);//DEBUG

	var srcDirs = packageInfo.pkg.mmir && packageInfo.pkg.mmir[workersFieldName];
	if(!srcDirs){
		return list;
	} else if(!Array.isArray(srcDirs)){
		srcDirs = [srcDirs];
	}


	var pkgId = packageInfo.pkg.name;
	srcDirs.forEach(function(srcDir){

		srcDir = path.resolve(pkgPath, srcDir);
		var str;
		getFiles(srcDir).forEach(function(f){
			str = toAliasId(f, pkgId + '/workers');
			if(process.env.verbose) console.log('  export-utils: adding worker file ', str);//DEBUG
			list.push(str);
		});

	});

	return list;
}

function getIncludeModules(packageInfo, alias, rootPath, includeList){

	if(Array.isArray(packageInfo) && alias){
		packageInfo.forEach(function(entry){
			getIncludeModules(entry, alias, rootPath, includeList);
		});
		return;
	}

	includeList = includeList || [];
	var id = packageInfo.pkg.name;
	var mainFile = packageInfo.pkg.main;
	if(!mainFile){
		return;
	}
	var pkgPath = path.dirname(packageInfo.path);
	var file = normalize(path.resolve(pkgPath, mainFile), rootPath);
	if(process.env.verbose) console.log('  export-utils: will add include-module for main ', mainFile, ': ['+id+'] -> ', file);//DEBUG

	addAlias(id, file, alias, id);
	includeList.push(id);

	//additional exports:
	var exportsDirs = packageInfo.pkg.mmir && packageInfo.pkg.mmir[exportsFieldName];
	if(exportsDirs){
		doAddIncludes(includeList, rootPath, alias, exportsDirs, pkgPath, id, 'include-module');
	}

	return includeList;
}

function getIncludeFiles(packageInfo, alias, rootPath, includeList){

	if(Array.isArray(packageInfo) && alias){
		packageInfo.forEach(function(entry){
			getIncludeFiles(entry, alias, rootPath, includeList);
		});
		return;
	}

	includeList = includeList || [];
	var id = packageInfo.pkg.name;
	var pkgPath = path.dirname(packageInfo.path);

	//file exports:
	var exportsDirs = packageInfo.pkg.mmir && packageInfo.pkg.mmir[filesFieldName];
	if(exportsDirs){
		doAddIncludes(includeList, rootPath, alias, exportsDirs, pkgPath, id, 'exported file');
	}

	return includeList;
}


function getModes(packageInfo, alias, rootPath, modes){

	if(Array.isArray(packageInfo) && alias){
		packageInfo.forEach(function(entry){
			getModes(entry, alias, rootPath, modes);
		});
		return;
	}

	modes = modes || {};
	var id = packageInfo.pkg.name;
	var pkgPath = path.dirname(packageInfo.path);

	var pkgModes = packageInfo.pkg.mmir && packageInfo.pkg.mmir[modesFieldName];
	if(pkgModes){
		Object.keys(pkgModes).forEach(function(mode){

			var modeDef = pkgModes[mode];
			var modeRes = {};
			Object.keys(modeDef).forEach(function(modeField){
				if(modeField == exportsFieldName){
					
					var exportsList = [];
					doAddIncludes(exportsList, rootPath, alias, modeDef[modeField], pkgPath, id, 'include-module (mode: '+mode+')');
					modeRes[exportModuleModulesFieldName] = exportsList;

				} else if(modeField == filesFieldName){

					var filesList = [];
					doAddIncludes(filesList, rootPath, alias, modeDef[modeField], pkgPath, id, 'exported file (mode: '+mode+')');
					modeRes[exportModuleFilesFieldName] = filesList;

				} else {

					var file = normalize(modeField, rootPath);
					var sourceId = getAliasEntry(file, alias);
					if(!sourceId){
						throw new Error('cannot remap from file '+file+' in mode '+mode+': there is no alias specified for the file (must be a valid lib/source file)');
					}

					if(process.env.verbose) console.log('  export-utils: get target for module replacement for : ['+sourceId+'] -> ', modeDef[modeField]);//DEBUG

					file = normalize(modeDef[modeField], rootPath);
					var targetId = getAliasEntry(file, alias);
					if(!targetId){
						throw new Error('cannot remap to file '+file+' in mode '+mode+': there is no alias specified for the file (must be a valid lib/source file)');
					}

					if(process.env.verbose) console.log('  export-utils: will add module replacement for : ['+sourceId+'] -> ['+targetId+']');//DEBUG

					modeRes[sourceId] = targetId;
				}
			});

			if(modes[mode]){
				_.merge(modes[mode], modeRes);
			} else {
				modes[mode] = modeRes;
			}
		});
	}

	return modes;
}

function doAddIncludes(includeList, rootPath, alias, exportsDirs, pkgPath, id, debugMessageType){
	if(!Array.isArray(exportsDirs)){
		exportsDirs = [exportsDirs];
	}
	resolvePaths(pkgPath, exportsDirs, false);
	exportsDirs.forEach(function(expDir){

		getFiles(expDir).forEach(function(file){

			file = normalize(file, rootPath);
			var eid = getAliasEntry(file, alias);
			if(!eid){
				eid = id + '/' + path.basename(file, '.js');
				addAlias(eid, file, alias, id);
			}

			if(includeList.findIndex(function(entry){ return entry === eid;}) === -1){
				if(process.env.verbose) console.log('  export-utils: will add '+debugMessageType+' for : ['+eid+'] -> ', file);//DEBUG
				includeList.push(eid);
			}
		});

	});

	return includeList;
}

function getDependencies(packageInfo, list){

	list = list || [];

	var info;
	if(packageInfo.pkg.dependencies){
		var packagePaths = [path.dirname(packageInfo.path)];
		for(var dep in packageInfo.pkg.dependencies){
			info = getPackageInfo(path.dirname(require.resolve(dep, {paths: packagePaths})));
			list.push(info);
			getDependencies(info, list);
		}
	}

	return list;
}


module.exports = {
	getAlias: function(packageDir, alias){
		var packageInfo = getPackageInfo(packageDir);
		var packageRoot = path.dirname(path.resolve(packageInfo.path));
		return getAliasFor(packageInfo, packageRoot, alias);
	},
	getWorkerList: function(packageDir, workersList){
		var packageInfo = getPackageInfo(packageDir);
		var packageRoot = path.dirname(path.resolve(packageInfo.path));
		return getWorkerListFor(packageInfo, packageRoot, workersList);
	},
	getIncludeModules: function(packageDir, alias){
		var packageInfo = getPackageInfo(packageDir);
		var packageRoot = path.dirname(path.resolve(packageInfo.path));
		return getIncludeModules(packageInfo, packageRoot, alias);
	},
	/**
	 * creates the module-ids.gen.js file at pluginPackageDir
	 *
	 * @param  {String} pluginPackageDir the path to the package directory of the mmir-plugin (can also be a sub-path of the target package)
	 * @param  {String} [outputFileName]  OPTIONAL (positional argument) the file-name of the module-ids module that will be created in pluginPackageDir
	 * 																	  DEFAULT: "module-ids.gen.js"
	 * @param  {Object} [alias] OPTIONAL (positional argument) mapping for module IDs to file-path of its JS file, {[moduleId: string]: path}
	 * 																	 if given, the mappings for the plugin-package will be added to it; if omitted a new mapping will be created internally
	 * @param  {Array} [workersList]  OPTIONAL (positional argument) a list for workers
	 * 																	if given, the workers for the plugin-package will be added to it; if omitted a new list will be created internally
	 * @param  {Array} [includeModulesList]  OPTIONAL (positional argument)
	 * 																	     if given, the exported/entry-point modules for the plugin-package will be added to it; if omitted a new list will be created internally
	 * @param  {Array} [includeFilesList]  OPTIONAL (positional argument)
	 * 																	     if given, the exported files for the plugin-package will be added to it; if omitted a new list will be created internally
	 * @returns {String} the file path to which the module information for pluginPackageDir were written to
	 */
	createModuleIds: function(pluginPackageDir, outputFileName, alias, workersList, includeModulesList, includeFilesList){

		alias = alias || {};
		workersList = workersList || [];
		includeModulesList = includeModulesList || [];
		includeFilesList = includeFilesList || [];

		var packageInfo = getPackageInfo(pluginPackageDir);
		var packageRoot = path.dirname(path.resolve(packageInfo.path));

		var packageId = packageInfo.pkg.name;
		// if(process.env.verbose) console.log('  package info ('+packageRoot+'): ', packageInfo);
		var deps = getDependencies(packageInfo);

		getAliasFor(packageInfo, packageRoot, alias);
		getWorkerListFor(packageInfo, packageRoot, workersList);

		//list of files that should be included "raw" (e.g. binary files)
		getIncludeFiles(packageInfo, alias, packageRoot, includeFilesList);

		//list of files that should be included "raw" (e.g. binary files)
		var modes = {}//FIXME
		getModes(packageInfo, alias, packageRoot, modes);

		//NOTE this adds "short-hand" alias definitions (i.e. alias for package-id -> main-file):
		//       if these would be added to alias first, then the path-resolution would not work properly anymore,
		//		 since it would try to resolve against the package-main-file, and not its path anymore...
		//   -> must add these after the "long-form" alias definitions were added!
		getIncludeModules(packageInfo, alias, packageRoot, includeModulesList);

		var code = exportsGen.generateCode(packageId, alias, workersList, includeModulesList, deps.map(function(d){return d.pkg.name}), includeFilesList, modes);
		return exportsGen.writeToFile(packageRoot, code, outputFileName);
	}
};
