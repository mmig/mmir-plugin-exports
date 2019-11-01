#!/usr/bin/env node

var path = require('path');
var meow = require('meow');

var futil = require('../file-utils.js');

var appName = 'copycordovascripts';

var cordovaScriptsDir = path.normalize(path.join(__dirname, '../res/cordova-scripts'));

var cli = meow(`
  Usage
    ${appName} <target directory>

  Options
    --source, -s   specify source directory
                    DEFAULT: ${cordovaScriptsDir}
    --filter, -f   regular expression for filtering files from source directory
                   only matching files names will be copyied.
                    DEFAULT: <none>
    --help         show usage information
    --verbose, -v  show additional information
                    DEFAULT: false

  Examples
    ${appName} ~/mmir-plugin-encoder-core/
    ${appName} ~/mmir-plugin-encoder-core/www/webAudioInput.js
    ${appName} ~/mmir-plugin-encoder-core/www/webAudioInput.js -f backwardsCompatPlugin.js -t media
`, {
  flags: {
    source: {
      type: 'string',
      alias: 's',
      default: cordovaScriptsDir
    },
    filter: {
      type: 'string',
      alias: 'f',
      default: void(0)
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
  cli.showHelp();
  return;
}

if(cli.flags.verbose){
  process.env.verbose = true;
}

try {

  var target = cli.input[0];
  if(!futil.exists(target) || !futil.isDirectory(target)){
    console.log('ERROR target directory does not exist at '+path.resolve(target));
    process.exit(1);
  }

  var source = cli.flags.source;
  if(!futil.exists(source) || !futil.isDirectory(source)){
    console.log('ERROR source directory does not exist at '+path.resolve(source));
    process.exit(2);
  }

  var filter = cli.flags.filter;
  var re;
  if(filter){
    try {
      re = new RegExp(filter);
    } catch(err){
      console.log('ERROR invalid regular expression for filter '+JSON.stringify(filter)+': '+err);
      process.exit(3);
    }
  }

  //copyFiles(srcDir, targetDir, callback, filterRegExp)
  futil.copyFiles(source, target, function(err){
    if(err){
      console.log('ERROR while copying files (run with --verbose option for more details): '+err);
      process.exit(4);
    }
    console.log('successfuly copied file(s) from '+path.resolve(source)+' to '+path.resolve(target));
  }, re);

} catch(err){

  console.error(`
  An Error occurred for:
    ${appName} ${cli.input.join(' ')} -s ${cli.flags.source} -f ${cli.flags.filter}

  Is the path to the target directory correct?`);

  if(cli.flags.verbose)
    console.error('\n  ERROR Details:', err);
  else
    console.error('  (use flag --verbose for more details)');

  console.error('\nHELP:');
  cli.showHelp();
}
