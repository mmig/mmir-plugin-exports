
const fs = require('fs');
const path = require('path');
const pathParse = require('path-parse');

const HEADER = '\n/*********************************************************************'+
               '\n * This file is automatically generated by mmir-plugins-export tools *'+
               '\n *        Do not modify: ANY CHANGES WILL GET DISCARDED              *'+
               '\n *********************************************************************/\n\n';

function sameAlreadyExistAt(filePath, code){
  if(fs.existsSync(filePath)){
    var otherContent = fs.readFileSync(filePath, 'utf8');
    return code === otherContent;
  }
  return false;
}

function renameBackupFile(file){
  var origFile = file;
  var count = 1;
  var fileInfo = pathParse(file);
  if(process.env.verbose) console.log('  exports-file-util: checking if file '+origFile+' already exists... ');
  while(fs.existsSync(file) && count < 100){
    file = path.resolve(fileInfo.dir, fileInfo.name + count + '.bak');
    if(process.env.verbose) console.log('  exports-file-util: checking if file '+path.basename(file)+' already exists...');
    ++count;
  }
  if(count < 100){
    if(file !== origFile){
      if(process.env.verbose) console.log('  exports-file-util: renaming existing file '+path.basename(origFile)+' to '+path.basename(file));
      fs.renameSync(origFile, file);
    }
    return file;
  }
  throw new Error('Could not rename existing file: already too many backups ('+count+') for ' + origFile);
}

function storeToFile(dir, code, fileName){
  fileName = fileName || OUTPUT_FILE_NAME;
  var file = path.resolve(dir, fileName);
  if(sameAlreadyExistAt(file, code)){
    if(process.env.verbose) console.log('  exports-file-util: unchanged code at '+file+' (did not create new file).');
    return file;
  }
  renameBackupFile(file);
  fs.writeFileSync(file, code);
  if(process.env.verbose) console.log('  exports-file-util: created file '+file+'.');
  return file;
}

function isDirectory(filePath){
  return fs.lstatSync(filePath).isDirectory();
}

module.exports = {
  isDirectory: isDirectory,
  storeToFile: storeToFile,
  fileHeader: HEADER
}
