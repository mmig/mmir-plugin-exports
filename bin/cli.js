#!/usr/bin/env node

var meow = require('meow');
var gen = require('../exports-gen.js');
var main = require('../exports-main.js');

var appName = 'pluginexport';

var cli = meow(`
  Usage
    ${appName} <directory path>

  Options
    --file, -f     the name of generated file
                   DEFAULT: ${gen.getDefaultFileName()}
    --help         show usage information
    --verbose, -v  show additional information
                   DEFAULT: false

  Examples
    ${appName} ~/mmir-plugin-encoder-core
    ${appName} ~/mmir-plugin-encoder-core -f module-info.js
`, {
	flags: {
		file: {
			type: 'string',
			alias: 'f',
			default: gen.getDefaultFileName()
		},
    verbose: {
			type: 'boolean',
			alias: 'v',
			default: false
		}
	}
});

// console.log(cli);

if(!cli.input || !cli.input[0]){
  cli.input = [process.cwd()];
}

if(cli.flags.verbose){
  process.env.verbose = true;
}

try {

  //createModuleIds: function(pluginPackageDir, outputFileName, alias, workersList, includeModulesList)
  var result = main.createModuleIds(cli.input[0], cli.flags.file);
  console.log('  created file ' + result);

} catch(err){

	console.error(`
  An Error occurred for:
    ${appName} ${cli.input.join(' ')} -f ${cli.flags.file}

  Is the directory path correct?`);

  if(cli.flags.verbose)
    console.error('\n  ERROR Details:', err);
  else
    console.error('  (use flag --verbose for more details)');

  console.error('\nHELP:');
  cli.showHelp();
}
