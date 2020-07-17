#!/usr/bin/env node

var meow = require('meow');

var versionUtil = require('../update-version.js');
var path = require('path');

var appName = 'updateversion';

//TODO add support for options:
// `
// --version-pattern -m <pattern>  regular expression for matching version string in file
//                                  DEFAULT: undefined
//
// --pattern-group -g <number>  number of the group in the regular expression
//                               that matches the version-pattern in file(s):
//                               if specified, only the group is replaced instead
//                               of the complete matched pattern.
//                               The first group has index 0.
//                               DEFAULT: undefined
// `

var cli = meow(`
  Usage
    ${appName} <file or directory path>

  Options
    --set-version, -s <string>    use version <string>
    --from-package, -p            use version from package.json
                                    DEFAULT if --set-version is not set: true
    --from-config, -c             use version from config.xml (Cordova)
                                    DEFAULT: false
    --from-plugin, -e             use version from plugin.xml (Cordova)
                                    DEFAULT: false
    --disable-package, -P         do not update version in package.json
                                    DEFAULT if --from-package is false: false
    --disable-config, -C          do not update version in config.xml (Cordova)
                                    DEFAULT if --from-config is false: false
    --disable-plugin, -E          do not update version in plugin.xml (Cordova)
                                    DEFAULT if --from-plugin is false: false
    --enable-package-lock, -l    do update version in package-lock.json
                                    DEFAULT: false
    --help         show usage information
    --verbose, -v  show additional information
                    DEFAULT: false

  Examples
    ${appName} ~/mmir-plugin-encoder-core/
    ${appName} ~/mmir-plugin-encoder-core/www/webAudioInput.js
    ${appName} ~/mmir-plugin-encoder-core/www/webAudioInput.js -f backwardsCompatPlugin.js -t media
`, {
  booleanDefault: undefined,
  flags: {
    setVersion: {
      type: 'string',
      alias: 's',
      default: ''
    },
    fromPackage: {
      type: 'boolean',
      alias: 'p'
    },
    fromConfig: {
      type: 'boolean',
      alias: 'c',
      default: false
    },
    fromPlugin: {
      type: 'boolean',
      alias: 'e',
      default: false
    },
    disablePackage: {
      type: 'boolean',
      alias: 'd'
    },
    enablePackageLock: {
      type: 'boolean',
      alias: 'l',
      default: false
    },
    disableConfig: {
      type: 'boolean',
      alias: 'C'
    },
    disablePlugin: {
      type: 'boolean',
      alias: 'E'
    },
    versionPattern: {
      type: 'string',
      alias: 'm',
      default: ''
    },
    patternGroup: {
      type: 'number',
      alias: 'g',
      default: -1
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

const flags = cli.flags;

if(flags.verbose){
  process.env.verbose = true;
}

var isOtherSrc = flags.fromConfig || flags.fromPlugin;

if(!flags.setVersion && !isOtherSrc && typeof flags.fromPackage === 'undefined'){
  flags.fromPackage = true;
}

if(typeof flags.disableConfig === 'undefined'){
  flags.disableConfig = !!flags.fromConfig;
}

if(typeof flags.disablePlugin === 'undefined'){
  flags.disablePlugin = !!flags.fromPlugin;
}

if(typeof flags.disablePackage === 'undefined'){
  flags.disablePackage = !!flags.fromPackage;
}

try {

  var input = cli.input[0];//TODO use others from cli.input too
  // updateVersion(target, opts, cb)
  versionUtil.updateVersion(input, flags, function(err, result){
    if(err) throw(err);
    // console.log('finished upating version', result)
    var isVerbose = process.env.verbose;
    var sep = isVerbose? '\n                  ' : ', ';
    // var strChanged = result.changed.length === 0? '<no files>' : sep + result.changed.join(sep);
    // var strUnchanged = result.unchanged.length > 0? '\n    unchanged file(s):' + sep + result.unchanged.join(sep) : '';
    var strChanged = fileListToStr(result.changed, result.root, sep, isVerbose, ' <no files>');
    var strUnchanged = fileListToStr(result.unchanged, result.root, sep, isVerbose, '');
    if(strUnchanged){
      strUnchanged = (isVerbose? '\n    ' : ' / ') + 'unchanged file(s): ' + strUnchanged;
    }
    var strRoot = '';// isVerbose? '' : ' (in '+result.root+')';

    console.log('  set version ' + result.version + ' in file(s):' + strChanged + strUnchanged + strRoot);
  });

} catch(err){

  console.error(`
  An Error occurred for:
    ${appName} ${cli.input.join(' ')} -f ${cli.flags.file} -t ${cli.flags.type} -e ${cli.flags.exported || void(0)}

  Is the file path correct?`);

  if(cli.flags.verbose)
    console.error('\n  ERROR Details:', err);
  else
    console.error('  (use flag --verbose for more details)');

  console.error('\nHELP:');
  cli.showHelp();
}

function fileListToStr(files, root, sep, isVerbose, noFilesStr){
  if(files.length === 0){
    return noFilesStr;
  }
  if(isVerbose){
    return sep + files.join(sep);
  }
  return ' ' + files.map(function(f){ return path.basename(f.replace(root, '')); }).join(sep);
}
