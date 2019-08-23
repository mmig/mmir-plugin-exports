
var path = require('path');
var fs = require('fs');

var moduleIds = require('./module-ids.gen.js');

['paths', 'workers', 'modules', 'dependencies'].forEach(function(type){
  console.log(type + ': ', moduleIds.getAll(type));
  if(type === 'paths'){
    var paths = moduleIds.getAll(type, true);
    console.log(type + ': ', paths, '\n--------------\n');
    Object.keys(paths).forEach(function(p){
      paths[p] = path.resolve(paths[p]);
      console.log('    path '  + (fs.existsSync(paths[p])? 'EXISTS' : 'does NOT exist') + ' -> ', paths[p]);
    });
    console.log(type + ': ', paths);
  }
  console.log('###############################\n');
})

//FIXME TEST
var text = require('./config-main.js').createModuleConfigs('C:/Users/aaru01/git/dev_mmir-media-plugins/mmir-plugin-encoder-core');
console.log(require('./config-gen.js').generateCode(text));
