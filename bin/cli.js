#!/usr/bin/env node

var meow = require('meow');
var gen = require('../exports-gen.js');
var main = require('../exports-main.js');

var appName = 'pluginexport';

var cli = meow(`
  Usage
    ${appName} <directory path>

  Options
    --file, -f  the name of generated file
                DEFAULT: ${gen.getDefaultFileName()}

  Examples
    ${appName} ~/mmir-plugin-encoder-core
    ${appName} ~/mmir-plugin-encoder-core -f module-info.js
`, {
	flags: {
		file: {
			type: 'string',
			alias: 'f',
			default: gen.getDefaultFileName()
		}
	}
});

// console.log(cli);

if(!cli.input || !cli.input[0]){
	cli.showHelp();
	return;
}
//createModuleIds: function(pluginPackageDir, packageRoot, alias, workersList, includeModulesList){
try {
	main.createModuleIds(cli.input[0], cli.flags.file);
} catch(err){
	console.error('An Error occurred: is the directory path correct?\n', err);
	cli.showHelp();
}
