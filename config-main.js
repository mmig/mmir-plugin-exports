
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const configCodeUtil = require('./config-gen.js');

const MODULE_CONFIG_INTERFACE_FILE = 'config.d.ts';

const reMainConfigInterface = /PluginConfig$/;
const reSpeechConfigInterface = /PluginSpeechConfigEntry$/;
const reConfigInterface = /PluginConfigEntry$/;
const mainInterfaceKey = '_main';
const speechInterfaceKey = '_speech';

const PropertyKind = 'PropertySignature';
const InterfaceKind = 'InterfaceDeclaration';
const EnumKind = 'EnumDeclaration';
const EnumValueKind = 'EnumMember';

function getKind(node){
  return ts.SyntaxKind[node.kind];
}

function getInterfaces(sourceFile){

  var interfaces = {};
  var name;
  ts.forEachChild(sourceFile, function(node){
    if(getKind(node) === InterfaceKind){
      name = node.name.getText();
      if(reMainConfigInterface.test(name)){
        interfaces[mainInterfaceKey] = node;
      } else if(reSpeechConfigInterface.test(name)){
        interfaces[speechInterfaceKey] = node;
      } else if(reConfigInterface.test(name)){
        interfaces[name] = node;
      }
    }
  });
  return interfaces;
}

function getEnumList(sourceFile){
  var enums = [];
  ts.forEachChild(sourceFile, function(node){
    if(getKind(node) === EnumKind){
      enums.push(node);
    }
  });
  return enums;
}

function getPropertyList(node){
  /** @type {Array} */
  var members = node.members;
  var list = [];
  var m;
  for(var i = members.length - 1; i >= 0; --i){
    m = members[i];
    if(getKind(m) === PropertyKind){
      list.push(m);
    }
  }
  return list;
}

function getEnumValueList(node){
  /** @type {Array} */
  var members = node.members;
  var list = [];
  var m;
  for(var i = members.length - 1; i >= 0; --i){
    m = members[i];
    if(getKind(m) === EnumValueKind){
      list.push(m);
    }
  }
  return list;
}

function getFirstProperty(node){
  /** @type {Array} */
  var members = node.members;
  var m;
  for(var i = members.length - 1; i >= 0; --i){
    m = members[i];
    if(getKind(m) === PropertyKind){
      return m;
    }
  }
  return null;
}

function getDoc(node, indent){
	if(node.jsDoc){
		var reindent = new Array(indent).join(' ');
    var text = node.getSourceFile().text;
		return node.jsDoc.map(function(entry){
			// var txt = '';
			// if(entry.comment){
			// 	txt += entry.comment;
			// }
			// if(entry.tags){
			// 	txt += entry.tags.map(function(t){return '[@'+ t.tagName.escapedText + ': ' + t.comment + ']' }).join(', ');
			// }
			// return txt;
			return text.substring(entry.pos, entry.end).replace(/^\s*\/\*/, '\n' + reindent+'/*').replace(/(\r?\n)\s*\*/g, '$1' + reindent+' *');
		}).join('\n');
	}
	return '';
}

function processSubConfig(prop, subConfig, interfacesMap, allInterfaces){

  var type = prop.type.getText();
  interfacesMap.delete(type);

  var doc = [];
  var subConfigEntry = {config: null, doc: getDoc(prop), docs: doc};
  subConfig[prop.name.getText()] = subConfigEntry;

  var subConfigList = [];
  subConfigEntry.config = getPropertyList(allInterfaces[type]).map(function(subProp){
    if(allInterfaces[subProp.type.getText()]){
      subConfigList.push(subProp);
    }
    doc.push(getDoc(subProp));
    return subProp.name.getText();
  });

  if(subConfigList.length > 0){
    var subSubConfig = {};
    subConfigEntry.subConfig = subSubConfig;
    subConfigList.forEach(function(entry){
      processSubConfig(entry, subSubConfig, interfacesMap, allInterfaces);
    });
  }
}

function toMap(obj){
  var map = new Map();
  for(var n in obj){
    map.set(n, obj);
  }
  return map;
}

function parseFile(dir, fileName){
  var file = path.resolve(dir, fileName);
  var code = fs.readFileSync(file, 'utf8');
  return ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
}

function createConfigInfo(ast){

  var allInterfaces = getInterfaces(ast);
  var interfaces = toMap(allInterfaces);
  interfaces.delete(mainInterfaceKey);
  var mainConfig = allInterfaces[mainInterfaceKey];
  var mainConfigEntry;
  if(mainConfig){
    interfaces.delete(mainInterfaceKey);
    mainConfigEntry = getFirstProperty(mainConfig);
  } else if(process.env.verbose) console.log('  export-utils: could not find main interface definition in ', ast.getSourceFile().fileName);//DEBUG

  var configInfo = {};

  if(mainConfigEntry){

    configInfo.pluginName = mainConfigEntry.name.getText();

    var mainConfigInterface = allInterfaces[mainConfigEntry.type.getText()];

    if(mainConfigInterface){
      interfaces.delete(mainConfigInterface.name.getText());
      var subConfig = {};
      configInfo.docs = [];
      configInfo.config = getPropertyList(mainConfigInterface).map(function(prop){
        if(allInterfaces[prop.type.getText()]){
          processSubConfig(prop, subConfig, interfaces, allInterfaces)
          // subConfig.push({name: prop.name.getText(), type: prop.type.getText(), doc: getDoc(prop)});
        }
        configInfo.docs.push(getDoc(prop));
        return prop.name.getText();
      });

    } else if(process.env.verbose) console.log('  export-utils: could not find main config definition in ', ast.getSourceFile().fileName);//DEBUG

    var speechConfigInterface = allInterfaces[speechInterfaceKey];

    if(speechConfigInterface){
      interfaces.delete(speechInterfaceKey);
      interfaces.delete(speechConfigInterface.name.getText());
      var subConfig = {};
      configInfo.speechDocs = [];
      configInfo.speechConfig = getPropertyList(speechConfigInterface).map(function(prop){
        if(allInterfaces[prop.type.getText()]){
          processSubConfig(prop, subConfig, interfaces, allInterfaces)
          // subConfig.push({name: prop.name.getText(), type: prop.type.getText(), doc: getDoc(prop)});
        }
        configInfo.speechDocs.push(getDoc(prop));
        return prop.name.getText();
      });

    } else if(process.env.verbose) console.log('  export-utils: could not find speech config definition in ', ast.getSourceFile().fileName);//DEBUG


  } else if(process.env.verbose) console.log('  export-utils: cannot set plugin-name for main config entry... ');//DEBUG

  var enums = [];
  configInfo.enums = enums;
  getEnumList(ast).forEach(function(en){
    eInfo = [];
    getEnumValueList(en).forEach(function(ev){
      eInfo.push({
        name: ev.name.getText(),
        doc: getDoc(ev),
        value: ev.initializer? eval(ev.initializer.getText()) : ev.name.getText()
      });
    });
    var name = en.name.getText();
    enums.push({name: name[0].toLowerCase() + name.substring(1), doc: getDoc(en), values: eInfo});
  });

  interfaces.forEach(function(interf){
    console.log('TODO process remaining sub-config for ', interf);
  });

  configInfo.subConfig = subConfig;

  return configInfo;
}

module.exports = {

  parseFile: parseFile,
  createConfigsInfo: createConfigInfo,

  createModuleConfigs: function(packageRootDir, outputFileName, moduleConfigDFile){
    moduleConfigDFile = moduleConfigDFile || MODULE_CONFIG_INTERFACE_FILE;

    var ast = parseFile(packageRootDir, moduleConfigDFile);
    var configInfo = createConfigInfo(ast, moduleConfigDFile);

    var code = configCodeUtil.generateCode(configInfo);
    return configCodeUtil.writeToFile(packageRootDir, code, outputFileName);
  }
}
