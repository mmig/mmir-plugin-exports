#!/usr/bin/env node

var meow = require('meow');
var path = require('path');
var fs = require('fs-extra');

var downlevel = require('downlevel-dts');
var futil = require('../file-utils.js');
var putil = require('../package-utils');

var appName = 'downlevel-dts';

var defaultTs36Dir = 'ts3.6';

var defaultTargetVersion = '3.4.0';

var cli = meow(`
  Usage
    ${appName} <dts directory>

  Options
    --dir, -d      the sub-directory name within the typings directory
                   for the downleveled typings (i.e. targeting typescript < 3.8)
                    DEFAULT: ${defaultTs36Dir}
    --force, -f   force writing to the target typings directory
                  (will clear the target directory before writing to it)
                    DEFAULT: false
    --to, -t      the target typescript version for down-leveling
                  (minimal supported version: 3.4.0)
                    DEFAULT: ${defaultTargetVersion}
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
    force: {
      type: 'boolean',
      alias: 'f',
      default: false
    },
    to: {
      type: 'string',
      alias: 't',
      default: defaultTargetVersion
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

var targetVersion = cli.flags.to;

var input = cli.input[0];
var absInput = path.resolve(input);
if(!futil.isDirectory(absInput)){
  console.log('ERROR: not a directory at '+ absInput);
  cli.showHelp();
  return;
}

var out = path.join(input, cli.flags.dir);
var absOut = path.resolve(out);
if(futil.exists(absOut)){
  if(!futil.isDirectory(absOut)){
    console.log('ERROR: output directory is not a directory at '+ absOut);
    cli.showHelp();
    return;
  }
  if(fs.readdirSync(absOut).length > 0){
    if(cli.flags.force){
      fs.emptyDirSync(absOut);
    }
    else {
      console.log('ERROR: output directory is not empty, use --force for clearing target dirctory at '+ absOut);
      cli.showHelp();
      return;
    }
  }
}


var relInput = path.isAbsolute(input)? path.relative(path.resolve('./'), input) : input;

//NOTE need to use relative out-dir otherwise downlevel-dts will resolve to an out-dir parallel to the input dir
var relOut = path.join(relInput, path.relative(absInput, absOut));

try {

  downlevel.main(absInput, relOut, targetVersion);
  console.log('  unmodified dts file(s) at            ' + absInput);
  console.log('  created dts compatibility file(s) at ' + absOut);

  var pkgPath = path.dirname(putil.getPackageInfo(input).path);
  var relDir = path.relative(pkgPath, absInput).replace(/\\/g, '/');
  var pkgOutDir = path.relative(pkgPath, absOut).replace(/\\/g, '/');
  console.log('\n  for backwards compatibility add entry to package.json:');
  console.log('  "typesVersions": {\n\
    "<3.9": {\n\
      "'+relDir+'/*": [\n\
        "'+pkgOutDir+'/*"\n\
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
