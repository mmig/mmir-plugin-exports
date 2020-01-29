#!/usr/bin/env node

var meow = require('meow');

var createCompat = require('../create-compat.js');
var futil = require('../file-utils.js');

var appName = 'createcompat';

var cli = meow(`
  Usage
    ${appName} <file or directory path>

  Options
    --type, -t     if input is a file, the type for the generated
                   compatibility module file (if input is a directory,
                   the options are extracted from package.json and this
                   is ignored):
                    media | asr | tts | custom
                    DEFAULT: media
    --exported, -e if type is custom, the globaly exported name must be
                   specified (otherwise this option is ignored).
                    DEFAULT: <none>
    --file, -f     if input is a file, the name for the generated
                   compatibility module file (if input is a directory,
                   the options are extracted from package.json and this
                   is ignored)
                    DEFAULT: <input name>Compat.js
    --help         show usage information
    --verbose, -v  show additional information
                    DEFAULT: false

  Examples
    ${appName} ~/mmir-plugin-encoder-core/
    ${appName} ~/mmir-plugin-encoder-core/www/webAudioInput.js
    ${appName} ~/mmir-plugin-encoder-core/www/webAudioInput.js -f backwardsCompatPlugin.js -t media
`, {
  flags: {
    type: {
      type: 'string',
      alias: 't',
      default: 'media'
    },
    exported: {
      type: 'string',
      alias: 'e',
      default: ''
    },
    file: {
      type: 'string',
      alias: 'f',
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

if(cli.flags.verbose){
  process.env.verbose = true;
}

try {

  //createModuleIds: function(pluginPackageDir, outputFileName, alias, workersList, includeModulesList)
  var input = cli.input[0];
  var result = futil.isDirectory(input)?
                    createCompat.createCompatForAll(input) :
                    createCompat.createCompatFor(input, cli.flags.file, createCompat.templates[cli.flags.type], {exportedName: cli.flags.exported || void(0)});

  console.log('  created file(s) ' + (Array.isArray(result)? result.join('\n                  ') : result));

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
