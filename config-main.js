
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const configCodeUtil = require('./config-gen.js');
const fileUtils = require('./file-utils.js');

const MODULE_CONFIG_INTERFACE_FILE = 'config.d.ts';
const BUILD_CONFIG_FILE = 'build-config.ts';

const reMainConfigInterface = /PluginConfig$/;
const reSpeechConfigInterface = /PluginSpeechConfigEntry$/;
const reConfigInterface = /PluginConfigEntry$/;
const reAppConfigType = /AppConfig|BuildConfigCreator$/;
const reMainBuildConfigType = /PluginBuildConfig$/;
const mainInterfaceKey = '_main';

const PropertyKind = 'PropertySignature';
const InterfaceKind = 'InterfaceDeclaration';
const ClassKind = 'ClassDeclaration';
const MemberKind = 'PropertyDeclaration';
const EnumKind = 'EnumDeclaration';
const EnumValueKind = 'EnumMember';
const UnionTypeKind = 'UnionType';
const VariableKind = 'VariableDeclaration';
const IdentifierKind = 'Identifier';
const ExportKind = 'ExportKeyword';

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
        if(!interfaces[mainInterfaceKey]){
          interfaces[mainInterfaceKey] = [node];
        } else {
          interfaces[mainInterfaceKey].push(node);
        }
      } else if(reConfigInterface.test(name) || reSpeechConfigInterface.test(name)){
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

function getPropertyList(node, list){
  return _getMemberKindsAsList(node, list, PropertyKind);
}

function getMemberList(node, list){
  return _getMemberKindsAsList(node, list, MemberKind);
}

function _getMemberKindsAsList(node, list, memberKind){
  /** @type {Array} */
  var members = node.members;
  list = list || [];
  var m;
  for(var i = members.length - 1; i >= 0; --i){
    m = members[i];
    if(getKind(m) === memberKind){
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

function getDoc(node, indent, includeDefaultValues){
  if(node.jsDoc){
    var reindent = new Array(indent).join(' ');
    var text = node.getSourceFile().text;
    var defaultValues = includeDefaultValues? [] : null;
    var text = node.jsDoc.map(function(entry){
      if(includeDefaultValues){
        var defVal = getDefaultValue(entry);
        if(typeof defVal !== 'undefined'){
          defaultValues.push({name: node.name.getText(),value: defVal});
        }
      }
      return text.substring(entry.pos, entry.end).replace(/^\s*\/\*/, '\n' + reindent+'/*').replace(/(\r?\n)\s*\*/g, '$1' + reindent+' *');
    }).join('\n');
    if(includeDefaultValues){
      return {text: text, defaultValue: defaultValues[0]};
    }
    return text;
  }
  return '';
}

function getDefaultValue(comment){
  var defaultTags = comment.tags && comment.tags.length > 0? comment.tags.filter(function(tag){ return tag.tagName.getText() === 'default';}) : null;
  if(defaultTags){
    // console.log('#########  export-utils: found @default tag(s) in JSDoc comment ('+defaultTags.length+') ', defaultTags);
    var len = defaultTags.length;
    if(process.env.verbose && len > 1){
      console.log('  export-utils: too many @default tags in JSDoc comment for (using last one!) ', comment.parent);
    }
    var tag = defaultTags[len - 1];
    if(tag){
      var val = getTypeStringFrom(tag);
      try{
        //try to convert non-string default-values -> if it fails, assume it's a string
        val = JSON.parse(val);
        if(process.env.verbose) console.log('  export-utils: extracted default-value '+val+' ('+(typeof val)+') for ', comment.parent.name.getText());
      } catch(err){
        if(process.env.verbose) console.log('  export-utils: extracted default-value '+val+' (string) for ', comment.parent.name.getText());
      }
      return val;
    }
    defaultTags = void(0);
  }
  return defaultTags;
}

function getTypeStringFrom(tag){
  var val;
  if(tag.typeExpression){
    val = tag.typeExpression.type.getText();
  } else {
    val = tag.comment;
  }
  return val;
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
    doc.push(getDoc(subProp, void(0), true));
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

function addOrCreate(entry, list){
  if(list){
    list.push(entry);
  } else {
    list = [entry];
  }
  return list;
}

function parseFile(dir, fileName){
  var file = path.resolve(dir, fileName);
  var code = fs.readFileSync(file, 'utf8');
  return ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
}

function createConfigInfosFor(ast, mainConfigEntry, interfaces, allInterfaces){

  var configInfo = {};

  if(mainConfigEntry){

    configInfo.pluginName = mainConfigEntry.name.getText();
      // console.log('  export-utils: getting main-config entry ', mainConfigEntry.type.getText());//DEBUG
    var mainConfigType = mainConfigEntry.type;
    // console.log('  export-utils: processing main-config entry type ', mainConfigType.kind, ' -> ', mainConfigType);//DEBUG
    var mainConfigSubTypes = [], mainSpeechConfigSubTypes = [];
    var targetTypes = [
      {filter: reConfigInterface, typeNames: mainConfigSubTypes},
      {filter: reSpeechConfigInterface, typeNames: mainSpeechConfigSubTypes}
    ];
    if(getKind(mainConfigType) === UnionTypeKind){
      getConfigTypes(mainConfigType.types, targetTypes);
    } else {
      getConfigTypes([mainConfigType], targetTypes);
      if(mainConfigSubTypes.length === 0 && mainSpeechConfigSubTypes.length === 0){

        if(process.env.verbose) console.log('  export-utils: WARN found type does not filters for main or speech config definition, using as main definition ', mainConfigType.getText());

        mainConfigSubTypes.push(mainConfigType.getText());
      }
    }

    var mainConfigTypeName = mainConfigSubTypes[0];
    var mainConfigInterface = allInterfaces[mainConfigTypeName];

    var mainSpeechConfigTypeName = mainSpeechConfigSubTypes[0];
    var speechConfigInterface;
    if(mainSpeechConfigTypeName){
      speechConfigInterface = allInterfaces[mainSpeechConfigTypeName];
      // console.log('  export-utils: using main-speechConfig ', mainSpeechConfigTypeName , ' -> ', speechConfigInterface);//DEBUG
    }

    if(mainConfigInterface){

      var subConfig = {};
      configInfo.docs = [];
      configInfo.config = [];
      addInterface(mainConfigInterface, configInfo.config, configInfo.docs, subConfig, interfaces, allInterfaces);

      if(mainConfigSubTypes.length > 1){
        for(var i=1,size=mainConfigSubTypes.length; i < size; ++i){
          var subTypeInterface = allInterfaces[ mainConfigSubTypes[i] ];
          addInterface(subTypeInterface, configInfo.config, configInfo.docs, subConfig, interfaces, allInterfaces);
        }
      }

      configInfo.subConfig = subConfig;

    } else if(process.env.verbose) console.log('  export-utils: could not find main config definition for '+configInfo.pluginName+' in ', ast.getSourceFile().fileName);//DEBUG

    if(speechConfigInterface){

      var speechSubConfig = {};
      configInfo.speechDocs = [];
      configInfo.speechConfig = [];
      addInterface(speechConfigInterface, configInfo.speechConfig, configInfo.speechDocs, speechSubConfig, interfaces, allInterfaces);

      if(mainSpeechConfigSubTypes.length > 1){
        for(var i=1,size=mainSpeechConfigSubTypes.length; i < size; ++i){
          var subTypeInterface = allInterfaces[ mainSpeechConfigSubTypes[i] ];
          addInterface(subTypeInterface, configInfo.speechConfig, configInfo.speechDocs, speechSubConfig, interfaces, allInterfaces);
        }
      }

      configInfo.speechSubConfig = speechSubConfig;

    } else if(process.env.verbose) console.log('  export-utils: could not find speech config definition for '+configInfo.pluginName+' in ', ast.getSourceFile().fileName);//DEBUG


  } else if(process.env.verbose) console.log('  export-utils: cannot set plugin-name for main config entry... ');//DEBUG

  return configInfo;
}

/**
 * [getConfigTypes description]
 * @param  {TypeDefinition[]} configTypes the UnionType definition from which to extract the types
 * @param  {{id?: string, filter: RegExp, typeNames?: []}[]} targetTypes (INOUT param) list of types that should be extracted
 * @param  {{id?: string, filter: RegExp, typeNames?: []}[]} targetTypes.id: OPTIONAL given ID for the entry
 * @param  {{id?: string, filter: RegExp, typeNames?: []}[]} targetTypes.filter: a regular expression (matching type names will be included in the result)
 * @param  {{id?: string, filter: RegExp, typeNames?: []}[]} targetTypes.typeNames: the result list of matched type definitions (if not specified a new list will be created)

 * @return {{id?: string, filter: RegExp, typeNames?: []}[]} the matched targetTypes.typeNames (undefined if it was not specified before and there were no matches for the entry)
 */
function getConfigTypes(configTypes, targetTypes){
  var size = targetTypes.length;
  configTypes.forEach(function(type){
    var name = type.typeName.getText();
    var found = false, target;
    for(var i = 0; i < size; ++i){
      target = targetTypes[i];
      if(target.filter.test(name)){
        found = true;
        target.typeNames = addOrCreate(name, target.typeNames);
        break;
      }
    }
    if(!found && process.env.verbose) {
      console.log('  export-utils: unknow type for main entry: got ', name, ', but expected type names matching with ', targetTypes.map(function(e){ return e.filter}));
    }
  });
  return targetTypes;
}

function addInterface(typeInterface, propList, docList, subConfig, interfaces, allInterfaces){
  interfaces.delete(typeInterface.name.getText());
  getPropertyList(typeInterface).forEach(function(prop){
    addInterfaceProperty(prop, propList, docList, subConfig, interfaces, allInterfaces);
  });
}

function addInterfaceProperty(prop, propList, docList, subConfig, interfaces, allInterfaces){
  if(allInterfaces[prop.type.getText()]){
    processSubConfig(prop, subConfig, interfaces, allInterfaces)
    // subConfig.push({name: prop.name.getText(), type: prop.type.getText(), doc: getDoc(prop)});
  }
  propList.push(prop.name.getText());
  docList.push(getDoc(prop, void(0), true));
}

function createConfigInfo(ast){

  var allInterfaces = getInterfaces(ast);
  var interfaces = toMap(allInterfaces);
  interfaces.delete(mainInterfaceKey);
  var mainConfigs = allInterfaces[mainInterfaceKey];
  var mainConfigEntries = [];
  if(mainConfigs){
    interfaces.delete(mainInterfaceKey);
    mainConfigs.forEach(function(mainConfig){
      getPropertyList(mainConfig, mainConfigEntries);
    });
  } else if(process.env.verbose) console.log('  export-utils: could not find main interface definition in ', ast.getSourceFile().fileName);//DEBUG

  var configInfos = [];
  mainConfigEntries.forEach(function(mainConfigEntry){
    configInfos.push(createConfigInfosFor(ast, mainConfigEntry, interfaces, allInterfaces));
  });
  var configInfo;
  if(configInfos.length === 1){
    configInfo = configInfos[0];
  } else {
    configInfo = {
      pluginName: [],
      plugins: {}
    }
    if(configInfos.length > 0){
      configInfos.forEach(function(cinf){
        configInfo.pluginName.push(cinf.pluginName);
        configInfo.plugins[cinf.pluginName] = cinf;
        // console.log('  export-utils: add sub main config definition for '+cinf.pluginName+' to plugins -> ', cinf);//DEBUG
      });
    }
  }

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
    console.log('WARNING ignored interface declaration for ', interf.typeName? interf.typeName.getText() : interf);
  });

  return configInfo;
}

function getBuildConfigs(ast){


  // [1] parse all exported build-config definitions in the modules main-namespace
  var pluginBuildConfigs = {};
  var hasSpecificEntries = false;
  ts.forEachChild(ast, function(node){
    if(getKind(node) === ClassKind) {
      var name = node.name.getText();
      if(reMainBuildConfigType.test(name)){
        getMemberList(node).forEach(function(member){

          if(member.name && member.initializer){
            var mname = member.name.getText();
            var entry = pluginBuildConfigs[mname] = pluginBuildConfigs[mname] || {vars: {}, sources: []};
            var values = member.initializer.elements? member.initializer.elements : [ member.initializer ];
            values.forEach(function(memValue){
              // console.log('    adding member ('+mname+') value ', getKind(memValue));
              hasSpecificEntries = true;
              if(getKind(memValue) === IdentifierKind){
                // -> if it is a variable, add entry:
                //    the source-string will be added later when parsing the
                //    module's main-namespace (see below [2])
                var id = memValue.getText();
                entry.vars[id] = {name: id, source: false};
                entry.sources.push(entry.vars[id]);
              } else {
                // if it is something other than a variable:
                // assume that it specifies the build-config entry directly
                // -> i.e. include as source-string
                entry.sources.push({name: false, source: memValue.getText()});
              }
            });
          }

        });
      }
      // console.log( '    export-utils: ', node, node.members? node.members.map(function(m){ return getKind(m)}) : null);

    } else if(process.env.verbose) console.log('  export-utils: on parsing build-config, ignoring statement '+getKind(node)+' (name '+(node.name? node.name.getText() : '<NA>')+')');

  });

  // create a mapping build-config variable name -> list of plugin-build-entries for that variable:
  var varEntries = {};
  if(hasSpecificEntries){
    for(var n in pluginBuildConfigs){
      for(var n2 in pluginBuildConfigs[n].vars){
        var e = pluginBuildConfigs[n].vars[n2];
        var l = varEntries[e.name] = varEntries[e.name] || [];
        l.push(e);
      }
    }
  }

  // console.log( pluginBuildConfigs, JSON.stringify(pluginBuildConfigs, null, 2), varEntries)

  // [2] parse all exported build-config definitions in the modules main-namespace
  var buildConfigs = [];
  ts.forEachChild(ast, function(node){

    var isExport = false;
    if(Array.isArray(node.modifiers) && node.modifiers.length > 0){
      for(var i = node.modifiers.length - 1; i >= 0; --i){
        if(getKind(node.modifiers[i]) === ExportKind){
          isExport = true;
          break;
        }
      }
    }

    // if(!isExport){
    //   return;
    // }

    if(node.declarationList && Array.isArray(node.declarationList.declarations) && node.declarationList.declarations.length > 0){
      node.declarationList.declarations.forEach(function(node){

        if(getKind(node) === VariableKind && reAppConfigType.test(node.type.getText()) && node.initializer){
          var name = node.name? node.name.getText() : '';
          var src = node.initializer.getText();
          // console.log('      adding build config for ', node.name? node.name.getText() : 'NA')
          if(varEntries[name]){
            varEntries[name].forEach(function(entry){
              entry.source = src;
            });
          } else if(isExport) {
            buildConfigs.push(src);
          }
        }
      });
    }

  });

  var plugins;
  if(hasSpecificEntries){
    plugins = {};
    for(var n in pluginBuildConfigs){
      plugins[n] = pluginBuildConfigs[n].sources.map(function(item){ return item.source});
    }
  }

  var result = {
    plugins: plugins,
    all: buildConfigs
  };

  return result;
}

module.exports = {

  parseFile: parseFile,
  createConfigsInfo: createConfigInfo,

  createModuleConfigs: function(packageRootDir, outputFileName, moduleConfigDFile, buildConfigFile){
    moduleConfigDFile = moduleConfigDFile || MODULE_CONFIG_INTERFACE_FILE;
    buildConfigFile = buildConfigFile || BUILD_CONFIG_FILE;

    var ast = parseFile(packageRootDir, moduleConfigDFile);
    var configInfo = createConfigInfo(ast, moduleConfigDFile);

    if(fileUtils.exists(packageRootDir, buildConfigFile)){

      var astBuildConfig = parseFile(packageRootDir, buildConfigFile);
      var buildConfigs = getBuildConfigs(astBuildConfig);

      if(buildConfigs.plugins || buildConfigs.all.length > 0){

        // create a set of all plugin names which have a specific build-config
        // -> do WARN if there was a build-config for a plugin, but was not used,
        //    i.e if the plugin-config at configInfo.plugins[pluginName]
        //    does not have a corresponding entry -> see below)
        var buildPluginNames = buildConfigs.plugins? new Set(Object.keys(buildConfigs.plugins)) : null;

        if(Array.isArray(configInfo.pluginName) && configInfo.plugins && buildPluginNames){

          configInfo.pluginName.forEach(function(pluginName){
            var pluginBuildConfig = buildConfigs.plugins[pluginName];
            if(pluginBuildConfig){

              buildPluginNames.delete(pluginName);
              configInfo.plugins[pluginName].buildConfigs = pluginBuildConfig;

            } else if(process.env.verbose) console.log('  export-utils: no specific build configuration for plugin '+pluginName);
          });

        }

        if(buildConfigs.all.length > 0) {

          configInfo.buildConfigs = buildConfigs.all;
        }

        if(buildPluginNames && buildPluginNames.size > 0){
          console.log('WARN export-utils: did specify plugin-specific build-configurations, but found no matching plugin specification ', Array.from(buildPluginNames));
        }

      }
    }

    var code = configCodeUtil.generateCode(configInfo);
    return configCodeUtil.writeToFile(packageRootDir, code, outputFileName);
  }
}
