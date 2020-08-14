#!/usr/bin/env node

var meow = require('meow');

var versionUtil = require('../update-version.js');
var path = require('path');

var appName = 'updateversion';

// TODO add:
// `
// --use-regexp-for-all -a          if enabled, the regular-expression matching
//                                   method is used for all files, i.e. including
//                                   package.json, package-lock.json, config.xml, plugin.xml
//                                   DEFAULT: false
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
    --enable-package-lock, -l     do update version in package-lock.json
                                    DEFAULT: false

    --version-regexp -r <regexp>    regular expression as a JavaScript RegExp literal,
                                      for matching  the version string in file, e.g.
                                      "/\*@version \d+/"
                                      (use quotes if the regexp contains spaces)
                                      NOTE: by default the regular-expression
                                            mechanism is not applied automatically
                                            found common config files, i.e. the
                                            following found files when parsing a
                                            directory will not be processed using
                                            the regexp method:
                                              package.json, package-lock.json,
                                              config.xml, plugin.xml
                                            (these need to be specifically referenced)
                                      DEFAULT: undefined
    --replace-pattern -p <pattern>  a replacement pattern for a matched regular expression:
                                      if defined, the pattern will be used instead of
                                      replacing the complete match.
                                    The pattern may refer to capture groups by $<group number>
                                      where the first group has the number 1.
                                    The version itself can/should be refered with
                                      "virtual" capture group $0.
                                    Example for version string "1.2.4" and
                                       -r "/(\* @version)\s+\d+/"
                                       -p "$1 $0"
                                    then replacement string would be
                                       "* @version 1.2.4"
                                    (use quotes if the regexp contains spaces)
                                    NOTE: this option only has effect, if option
                                          --version-regexp is specified!
                                      DEFAULT: undefined

    --help         show usage information
    --verbose, -v  show additional information
                    DEFAULT: false

  Examples
    ${appName} ~/mmir-plugin-encoder-core/
    ${appName} ~/mmir-plugin-encoder-core ~/mmir-plugin-decoder-core
    ${appName} --set-version 1.2.6 --enable-package-lock ~/mmir-plugin-encoder-core/
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
    versionRegexp: {
      type: 'string',
      alias: 'r',
      default: ''
    },
    // useRegexpForAll: {
    //   type: 'boolean',
    //   alias: 'a',
    //   default: false
    // },
    replacePattern: {
      type: 'string',
      alias: 'p',
      default: ''
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

  var isVerbose = process.env.verbose;

  var inputs = cli.input;

  var size = inputs.length;
  var curr = 0;
  var input;
  function checkComplete(){
    if(++curr >= size){
      var msg = isVerbose? 'for files/directories: ' + inputs.join(', ') : '';
      if(size > 1) console.log('  finished updating version' + msg + '.');
    }
  }

  for(var i=0; i < size; ++i){
    input = inputs[i];
    // updateVersion(target, opts, cb)
    versionUtil.updateVersion(input, flags, function(err, result){
      if(err) throw(err);
      var sep = isVerbose? '\n                  ' : ', ';
      // var strChanged = result.changed.length === 0? '<no files>' : sep + result.changed.join(sep);
      // var strUnchanged = result.unchanged.length > 0? '\n    unchanged file(s):' + sep + result.unchanged.join(sep) : '';
      var strChanged = fileListToStr(result.changed, result.root, sep, isVerbose, ' <no files>');
      var strUnchanged = fileListToStr(result.unchanged, result.root, sep, isVerbose, '');
      if(strUnchanged){
        strUnchanged = (isVerbose? '\n    ' : ' / ') + 'unchanged file(s): ' + strUnchanged;
      }
      var strRoot = size > 1? ' [in ' + path.relative(process.cwd(), result.root) +']' : '';// isVerbose? '' : ' (in '+result.root+')';

      console.log('  set version ' + result.version + ' in file(s):' + strChanged + strUnchanged + strRoot);
      checkComplete();
    });
  }

} catch(err){

  console.error(`
  An Error occurred for:
    ${appName} ${cli.input.join(' ')} --set-version ${cli.flags.setVersion} --from-package ${cli.flags.fromPackage} --from-config ${cli.flags.fromConfig} --from-plugin ${cli.flags.fromPlugin}\
                  --disable-package ${cli.flags.disablePackage} --disable-config ${cli.flags.disableConfig} --from-plugin ${cli.flags.disablePlugin}\
                  --enable-package-lock ${cli.flags.enablePackageLock} --version-regexp ${cli.flags.versionRegexp} --replace-pattern ${cli.flags.replacePattern} --verbose ${cli.flags.verbose}

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
  return ' ' + files.map(function(f){ return path.basename(root? f.replace(root, '') : f); }).join(sep);
}
