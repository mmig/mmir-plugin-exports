
var esprima = require('esprima');
var fs = require('fs');
var path = require('path');

var getPackageInfo = require('./package-utils.js').getPackageInfo;


var templateExportName = '/*exported-name*/';
var templatePre = '/*orig-pre*/';
var templateMain = '/*orig-define*/';
var templatePost = '/*orig-post*/';

var templateDefineArgs = '/*require-orig-define*/';
var templateDefineDeps = '/*require-orig-deps*/';
var templateDefineContent = '/*orig-define-content*/';

var templatePostContent = '/*post-content*/';
var templateOriginalContent = '/*orig-content*/';

var pluginTemplates = {
  media: {
    exportedName: 'newMediaPlugin',
    defineTemplatePath: 'compat-media-define-template.js',
    contentTemplatePath: 'compat-media-content-template.js',
    postContentTemplatePath: 'compat-media-post-content-template.js',
    createMain: function(parsedDefineCall, code, targetInfo){

      return createMainMedia(parsedDefineCall, code, targetInfo, this);
    }
  },
  asr: {
    exportedName: 'newWebAudioAsrImpl',
    defineTemplatePath: 'compat-flat-define-template.js',
    contentTemplatePath: 'compat-flat-content-template.js',
    postContentTemplatePath: 'compat-flat-post-content-asr-template.js',
    createMain: function(parsedDefineCall, code, targetInfo){

      var templateInfo = Object.assign({}, this);

      if(targetInfo.async){
        templateInfo.defineTemplatePath = 'compat-flat-async-define-template.js';
        templateInfo.postContentTemplatePath = 'compat-flat-async-post-content-template.js';
        templateInfo.defineTemplate = null;
        templateInfo.postContentTemplate = null;

        return createMainMedia(parsedDefineCall, code, targetInfo, templateInfo);
      }

      return createMainSimple(parsedDefineCall, code, targetInfo, this);
    }
  },
  tts: {
    exportedName: 'newWebAudioTtsImpl',
    defineTemplatePath: 'compat-flat-define-template.js',
    contentTemplatePath: 'compat-flat-content-template.js',
    postContentTemplatePath: 'compat-flat-post-content-tts-template.js',
    createMain: function(parsedDefineCall, code, targetInfo){

      var templateInfo = Object.assign({}, this);

      if(targetInfo.async){
        templateInfo.defineTemplatePath = 'compat-flat-async-define-template.js';
        templateInfo.postContentTemplatePath = 'compat-flat-async-post-content-template.js';
        templateInfo.defineTemplate = null;
        templateInfo.postContentTemplate = null;

        return createMainMedia(parsedDefineCall, code, targetInfo, templateInfo);
      }

      return createMainSimple(parsedDefineCall, code, targetInfo, this);
    }
  },
  custom: {
    exportedName: '',
    defineTemplatePath: 'compat-flat-define-template.js',
    contentTemplatePath: 'compat-flat-content-template.js',
    postContentTemplatePath: '',
    createMain: function(parsedDefineCall, code, targetInfo){

      var templateInfo = Object.assign({}, this);

      if(targetInfo.async){
        templateInfo.defineTemplatePath = 'compat-flat-async-define-template.js';
        templateInfo.postContentTemplatePath = 'compat-flat-async-post-content-template.js';
        templateInfo.defineTemplate = null;
        templateInfo.postContentTemplate = null;

        return createMainMedia(parsedDefineCall, code, targetInfo, templateInfo);
      }

      return createMainSimple(parsedDefineCall, code, targetInfo, this);
    }
  },
  none: {
    exportedName: '',
    defineTemplatePath: '',
    contentTemplatePath: '',
    postContentTemplatePath: '',
    createMain: null
  }
}

var templatePath = path.resolve(__dirname, 'res', 'templates');
var wrapTemplateName = 'compat-wrap-template.js';

var compatTemplateWrapper = loadTemplate(wrapTemplateName);

function loadTemplate(templateFile){
  // try {
  return fs.readFileSync(path.join(templatePath, templateFile), 'utf8');
  // }catch(err){
  //   console.error('ERROR for ', templatePath, templateFile)
  //   throw err
  // }
}

function loadTemplates(templateInfo){
  if(!templateInfo.defineTemplate){
    templateInfo.defineTemplate = loadTemplate(templateInfo.defineTemplatePath);
  }
  if(!templateInfo.contentTemplate){
    templateInfo.contentTemplate = loadTemplate(templateInfo.contentTemplatePath);
  }
  if(!templateInfo.postContentTemplate){
    templateInfo.postContentTemplate = templateInfo.postContentTemplatePath? loadTemplate(templateInfo.postContentTemplatePath) : '';
  }
}

function createMainMedia(defineCall, code, targetInfo, templateInfo){

  loadTemplates(templateInfo);
  var compatDefineTemplate = templateInfo.defineTemplate;
  var compatContentTemplate = templateInfo.contentTemplate;
  var compatPostContentTemplate = templateInfo.postContentTemplate;

  var additionalDependencies = [];
  var isFirstFunc = true;
  var defineCallArgs = defineCall.expression.arguments.map(function(item){

    if(isFirstFunc && item.type === 'ArrayExpression'){

      var isReplaced = false;
      var deps;
      if(targetInfo.dependencyMapping){
        var deps = item.elements.map(function(el){
          // console.log(el)
          var repl = targetInfo.dependencyMapping[el.value];
          if(repl){
            isReplaced = true;
            return el.value !== el.raw? JSON.stringify(repl) : repl;
          }
          return el.raw;
        });

      }

      if(targetInfo.additionalDependencies){

        isReplaced = true;
        var addDeps = targetInfo.additionalDependencies;
        deps = deps || [];

        for(var depName in addDeps){
          deps.push(JSON.stringify(addDeps[depName]));
          additionalDependencies.push(depName);
        }
      }

      if(isReplaced){
        return '[' + deps.join(',') + ']';
      }

      // console.log(code.substring.apply(code, item.range));

      return code.substring.apply(code, item.range);

    } else if(isFirstFunc && item.type === 'FunctionExpression'){

      isFirstFunc = false;

      var defineCallBody = item.body.range;

      var params = item.params;
      if(params){
        params.sort(function(p1, p2){
          return p1.range[0] - p2.range[0];
        });
      }

      // console.log('define call: params ', params[0].range[0], params[params.length - 1].range[1]);
      // return [params[0].range[0], params[params.length - 1].range[1]];

      var hasDeps = params && params.length > 0;
      var strAddDeps = additionalDependencies.join(',');
      var factoryFunc = 'function '+(item.id && item.id.name? item.id.name : '') +
            '(' +
                (!hasDeps? '' : code.substring(params[0].range[0], params[params.length - 1].range[1])) +
                (!strAddDeps? '' : (hasDeps? ',' : '') + strAddDeps) +
            '){' +
              compatContentTemplate.replace(templateDefineContent, code.substring.apply(code, defineCallBody)) +
            '}';

      return factoryFunc;
    }

    return code.substring.apply(code, item.range);
  });

    //if(process.env.verbose) console.log('define call: function details ', defineCallArgs);

  var rawArgs = defineCallArgs.join(', ');
  var args = defineCallArgs.length > 1? 'require(' + rawArgs + ');' : '(' + rawArgs + ')();';

  return compatDefineTemplate.replace(
    templateDefineArgs, args
  ).replace(
    templatePostContent, compatPostContentTemplate
  );
}


function createMainSimple(defineCall, code, targetInfo, templateInfo){

  loadTemplates(templateInfo);
  var compatDefineTemplate = templateInfo.defineTemplate;
  var compatContentTemplate = templateInfo.contentTemplate;
  var compatPostContentTemplate = templateInfo.postContentTemplate;

  var isFirstFunc = true;
  var deps;
  var errFunc = '';
  var reqExpr = '';
  var defineBody = '';
  defineCall.expression.arguments.forEach(function(item, index){

    if(isFirstFunc && item.type === 'ArrayExpression'){

      var hasDepsMap = targetInfo.dependencyMapping;
      deps = item.elements.map(function(el){
        var repl = hasDepsMap? targetInfo.dependencyMapping[el.value] : null;
        if(repl){
          return el.value !== el.raw? JSON.stringify(repl) : repl;
        }
        return el.raw;
      });

    } else if(isFirstFunc && item.type === 'FunctionExpression'){

      isFirstFunc = false;

      var defineCallBody = item.body.range;

      var params = item.params;
      if(params){
        params.forEach(function(depVar, i){
          reqExpr += '  var '+depVar.name+' = require('+deps[i]+');\n';
        });
      }

      if(targetInfo.additionalDependencies){
        var addDeps = targetInfo.additionalDependencies;
        for(var depName in addDeps){
          reqExpr += '  var '+depName+' = require('+JSON.stringify(addDeps[depName])+');\n';
        }
      }

      // console.log('define call: params ', params[0].range[0], params[params.length - 1].range[1]);
      // return [params[0].range[0], params[params.length - 1].range[1]];

      defineBody = compatContentTemplate.replace(templateDefineContent, code.substring.apply(code, defineCallBody));

    } else if(item.type === 'FunctionExpression'){

      errFunc = code.substring.apply(code, item.range);

    } else {
      console.error('ERROR: unkown define arguemeant at '+index+': ', item, ' -> ', code.substring.apply(code, item.range));
    }


  });

  //if(process.env.verbose) console.log('replace define call SIMPLE: ', reqExpr, defineBody, errFunc);

  var main = errFunc? 'try{\n' + defineBody + '\n} catch(err){('+errFunc+')(err);};' : defineBody;

  return compatDefineTemplate.replace(
    templateDefineDeps, reqExpr
  ).replace(
    templateDefineArgs, main
  ).replace(
    templatePostContent, compatPostContentTemplate
  );
}

function createCompatCode(code, templateInfo, targetInfo, packageRoot){

  var type = targetInfo.type;
  if(type === 'none'){
    if(!targetInfo.template){
      throw new Error('Must provide path for module-none template file');
    }
    var templatePath = path.isAbsolute(targetInfo.template)? targetInfo.template : path.join(packageRoot, targetInfo.template);
    var customNoneTemplate = fs.readFileSync(templatePath, 'utf8');
    return customNoneTemplate.replace(templateOriginalContent, code);
  }

  var expName = targetInfo.exportedName || templateInfo.exportedName;
  if(!expName){
    throw new Error('Must provide exported name');
  }

  var ast = esprima.parse(code, {range: true});

  var defineCall = ast.body.find(function(item){
    return item.type = 'ExpressionStatement' &&  item.expression.callee.name === 'define';
  });

  var defineCallName = defineCall.expression.callee;

  //if(process.env.verbose) console.log('define call: function name at ', defineCallName.range, ' -> ', JSON.stringify(code.substring.apply(code, defineCallName.range)));//DEBU


  var pre = code.substring(0, defineCallName.range[0] - 1);
  var main = templateInfo.createMain(defineCall, code, targetInfo);
  var post = code.substring(defineCall.range[1], code.length);

  var compatCode = compatTemplateWrapper.replace(templateExportName, expName)
                            .replace(templatePre, pre)
                            .replace(templateMain, main)
                            .replace(templatePost, post);

  return compatCode;
}

function createCompatFor(inputFile, outName, templateInfo, targetInfo, packageRoot){

  templateInfo = templateInfo || pluginTemplates.media;
  var code = fs.readFileSync(inputFile, 'utf8');

  var ipath = path.dirname(inputFile);
  outName = outName || (path.basename(inputFile, '.js') + 'Compat.js');
  var outputFile = path.isAbsolute(outName)? outName : path.join(ipath, outName);

  var compatCode = createCompatCode(code, templateInfo, targetInfo, packageRoot);

  fs.writeFileSync(outputFile, compatCode);
  return outputFile;
}

function createCompatForAll(pluginPackageDir){

  var packageInfo = getPackageInfo(pluginPackageDir);
  var packageRoot = path.dirname(path.resolve(packageInfo.path));

  var templateInfo;
  var compat = packageInfo.package.mmir && packageInfo.package.mmir.compat;
  var createdFiles = [];
  if(compat){
    var type, target, targetItem, result;
    for(var source in compat){
      targetItem = compat[source];
      target = targetItem.file;
      type = targetItem.type;
      templateInfo = pluginTemplates[type];
      //if(process.env.verbose) console.log('createCompatFor(',path.resolve(packageRoot, source), path.resolve(packageRoot, target),' ...');
      result = createCompatFor(path.resolve(packageRoot, source), path.resolve(packageRoot, target), templateInfo, targetItem, packageRoot);
      if(process.env.verbose) console.log('  createCompatFor("'+source+'", "'+target+'", "'+(targetItem.exportedName || templateInfo.exportedName)+'", "'+type+'") -> ', result);
      createdFiles.push(result);
    }
  }
  return createdFiles;
}

module.exports = {
  templates: pluginTemplates,
  createCompatFor: createCompatFor,
  createCompatForAll: createCompatForAll
}
