
var readPackage = require('read-pkg-up');

function normalizePkgInfo(info){
  if(info.packageJson){
    return {
      package: info.packageJson,
      path: info.path
    }
  }
  return info;
}

function getPackageInfo(forPackageDir){
  return normalizePkgInfo(
    readPackage.sync({cwd: forPackageDir})
  );
}

module.exports = {
  getPackageInfo: getPackageInfo,
  normalizePkgInfo: normalizePkgInfo
};
