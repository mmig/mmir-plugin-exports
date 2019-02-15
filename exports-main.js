
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

var reNormalize = path.sep === '/'? null : /\\/g;

var exportsGen = require('./exports-gen.js');

function normalize(absPath, absPackageRoot){
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

	var workersDirs = packageInfo.pkg.mmir[workersFieldName];
	// var resolvedWorkers = [];
	if(workersDirs){
		if(!Array.isArray(workersDirs)){
			workersDirs = [workersDirs];
		}

		resolvePaths(pkgPath, workersDirs, false);
		// workersDirs.forEach(function(dir){
		// 	resolvedWorkers.push(path.resolve(pkgPath, dir));
		// });

	}

	var srcDirs = packageInfo.pkg.directories[srcDirName];
	if(srcDirs){
		if(!Array.isArray(srcDirs)){
			srcDirs = [srcDirs];
		}
		resolvePaths(pkgPath, srcDirs, true);
		srcDirs.forEach(function(srcDir){
			var isWorker = !workersDirs || workersDirs.findIndex(function(wpath){ return srcDir.indexOf(wpath) === 0; }) !== -1;
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

	var srcDirs = packageInfo.pkg.mmir[workersFieldName];
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
	var exportsDirs = packageInfo.pkg.mmir[exportsFieldName];
	if(exportsDirs){
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
					if(process.env.verbose) console.log('  export-utils: will add include-module for : ['+eid+'] -> ', file);//DEBUG
					includeList.push(eid);
				}
			});

		});
	}

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
	 * creates the module-ids.js file at pluginPackageDir
	 *
	 * @param  {String} pluginPackageDir the path to the package directory of the mmir-plugin (can also be a sub-path of the target package)
	 * @param  {String} [outputFileName]  OPTIONAL (positional argument) the file-name of the module-ids module that will be created in pluginPackageDir
	 * 																	  DEFAULT: "module-ids.js"
	 * @param  {Object} [alias] OPTIONAL (positional argument) mapping for module IDs to file-path of its JS file, {[moduleId: string]: path}
	 * 																	 if given, the mappings for the plugin-package will be added to it; if omitted a new mapping will be created internally
	 * @param  {Array} [workersList]  OPTIONAL (positional argument) a list for workers
	 * 																	if given, the workers for the plugin-package will be added to it; if omitted a new list will be created internally
	 * @param  {Array} [includeModulesList]  OPTIONAL (positional argument)
	 * 																	     if given, the exported/entry-point modules for the plugin-package will be added to it; if omitted a new list will be created internally
	 * @returns {String} the file path to which the module information for pluginPackageDir were written to
	 */
	createModuleIds: function(pluginPackageDir, outputFileName, alias, workersList, includeModulesList){

		alias = alias || {};
		workersList = workersList || [];
		includeModulesList = includeModulesList || [];

		var packageInfo = getPackageInfo(pluginPackageDir);
		var packageRoot = path.dirname(path.resolve(packageInfo.path));

		var packageId = packageInfo.pkg.name;
		// if(process.env.verbose) console.log('  package info ('+packageRoot+'): ', packageInfo);
		var deps = getDependencies(packageInfo);

		getAliasFor(packageInfo, packageRoot, alias);
		getWorkerListFor(packageInfo, packageRoot, workersList);

		//NOTE this adds "short-hand" alias definitions (i.e. alias for package-id -> main-file):
		//       if these would be added to alias first, then the path-resolution would not work properly anymore,
		//		 since it would try to resolve against the package-main-file, and not its path anymore...
		//   -> must add these after the "long-form" alias definitions were added!
		getIncludeModules(packageInfo, alias, packageRoot, includeModulesList);

		var code = exportsGen.generateCode(packageId, alias, workersList, includeModulesList, deps.map(function(d){return d.pkg.name}));
		return exportsGen.writeToFile(packageRoot, code, outputFileName);
	}
};
