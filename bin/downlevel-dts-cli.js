#!/usr/bin/env node

var meow = require('meow');
var path = require('path');

var downlevel = require('../downlevel-dts.js');
var futil = require('../file-utils.js');
var putil = require('../package-utils');

var appName = 'downlevel-dts';

var defaultTs36Dir = 'ts3.6';

var cli = meow(`
  Usage
    ${appName} <dts directory>

  Options
    --dir, -d      the sub-directory name within the typings directory
                   for the not-downleveled typings (i.e. typescript >= 3.6)
                    DEFAULT: ${defaultTs36Dir}
    --help         show usage information
    --verbose, -v  show additional information
                    DEFAULT: false

  Examples
    ${appName} ~/mmir-plugin-speech-io/lib
    ${appName} ~/mmir-plugin-speech-io/lib --dir ts-latest
`, {
  flags: {
    dir: {
      type: 'string',
      alias: 'd',
      default: defaultTs36Dir
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

var input = cli.input[0];
if(!futil.isDirectory(input)){
  console.log('ERROR: not a directory at '+ input);
  cli.showHelp();
  return;
}

var out = cli.flags.dir;
var outDir = path.resolve(input, out);
if(futil.exists(outDir) && !futil.isDirectory(outDir)){
  console.log('ERROR: output directory is not a directory at '+ outDir);
  cli.showHelp();
  return;
}

try {

  downlevel.dtsDownlevel(input, out);
  console.log('  created dts compatibility file(s) at ' + input);
  console.log('  copied unmodified dts file(s) to     ' + outDir);

  var pkgPath = path.dirname(putil.getPackageInfo(input).path);
  var relDir = path.relative(pkgPath, input).replace(/\\/g, '/');
  console.log('\n  for backwards compatibility add entry to package.json:');
  console.log('  "typesVersions": {\n\
    ">=3.6": {\n\
      "'+relDir+'/*": [\n\
        "'+relDir+'/'+out+'/*"\n\
      ]\n\
    }\n\
  },');

} catch(err){

  console.error(`
  An Error occurred for:
    ${appName} ${cli.input.join(' ')} -d ${cli.flags.dir}

  Is the input path correct?`);

  if(cli.flags.verbose)
    console.error('\n  ERROR Details:', err);
  else
    console.error('  (use flag --verbose for more details)');

  console.error('\nHELP:');
  cli.showHelp();
}
