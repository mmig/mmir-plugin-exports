
var fileUtils = require('./file-utils.js');

const OUTPUT_FILE_NAME = 'module-config.gen.js';

function reIndent(comment, indent){
	var indentStr = new Array(indent + 1).join(' ');
  return comment.trim().replace(/^\s*\/\*/, indentStr+'/*').replace(/(\r?\n)\s*\*/g, '$1' + indentStr+' *');
}

function generateSubConfig(subConfig, indent, propName){
	var entryNames = Object.keys(subConfig);
	if(entryNames.length < 1){
		return '';
	}
	var indentStr = new Array(indent + 1).join(' ');
	var code = '';
	propName = propName || 'subConfig';
	code += indentStr + propName + ': {\n';
	entryNames.forEach(function(cname){
		var centry = subConfig[cname];
		code += indentStr + '  '+cname+': {\n';
		code += generateConfig(centry.config, centry.docs, indent + 4);
		if(centry.subConfig){
			code += generateSubConfig(centry.subConfig, indent + 4);
		}
		code = code.replace(/,\n$/, '\n');
		code += indentStr + '  },\n';
	});
	code = code.replace(/,\n$/, '\n');
	code += indentStr + '},\n';
	return code;
}

function generateConfig(config, configDocs, indent, isSpeechConfig){
	var indentStr = new Array(indent + 1).join(' ');
	var propName = isSpeechConfig? 'speechConfig' : 'config';

	var defaultValues = [];

	var code = '';
	code += indentStr + propName + ': [\n';
  config.forEach(function(c, index){
    var comment = configDocs[index];
    if(comment){
			if(comment.text){
      	code += reIndent(comment.text, indent + 2) + '\n';
			}
			if(comment.defaultValue){
				defaultValues.push(comment.defaultValue);
			}
    }
    code += indentStr + '  ' + JSON.stringify(c) + ',\n';
  });
	code = code.replace(/,\n$/, '\n');
  code += indentStr + '],\n';

	if(defaultValues.length > 0){
		propName = isSpeechConfig? 'defaultSpeechValues' : 'defaultValues';
		code += indentStr + propName + ': {\n';
		defaultValues.forEach(function(defValue){
			code += indentStr + '  ' + defValue.name + ': ' + JSON.stringify(defValue.value) + ',\n';
		});

		code = code.replace(/,\n$/, '\n');
	  code += indentStr + '},\n';
	}

	return code;
}

/**
 *
 * @param  {ConfigInfo} configInfo the config-info object:
 * 											{
 * 												//the plugin name (as used for configuration)
 * 												pluginName: string | string[],
 * 												//if pluginName is a list, contains the correspoing details for the plugins
 * 												[plugins: {[pluginName: string]: ConfigInfo},]
 * 												//the (main) configuration field-names for the plugin
 * 												config: string[],
 * 												//the (main) speech-configuration field-names for the plugin
 * 												speechConfig: string[],
 * 												//the configuration fields' (optionally) specified default values (via js-doc @default tag)
 * 												defaultValues: {[configName: string]: any},
 * 												//the speech-configuration fields' (optionally) specified default values (via js-doc @default tag)
 * 												sdefaultSpeechValues: {[configName: string]: any},
 * 												//the JS-docs for the configuration field-names (if there is any)
 * 												docs: string[],
 * 												// the exported enums (may be empty): additinonal/optional meta-data
 * 												enums: EnumInfo[],
 * 												// hierachical sub-configuration, if config is complex
 * 												[subConfig: SubConfig]
 * 												// hierachical sub-speech-configuration, if speech-config is complex
 * 												[speechSubConfig: SubConfig]
 * 											}
 * 											where:
 * 												EnumInfo: {name: string, doc: string, values: EnumValueInfo[]}
 * 												EnumValueInfo: {name: string, doc: string, value: string}
 * 												SubConfig: {[subConfigName: string]: SubConfigEntry}
 * 												SubConfigEntry: {config: string[], doc: string, docs: string[], subConfig?: SubConfig}
 * @return {String} generated code
 */
function generateConfigsCode(configInfo){

  var code = fileUtils.fileHeader;

  if(configInfo.doc){
    code += configInfo.doc + '\n';
  }

  code += 'module.exports = {\n';

	if(configInfo.pluginName){
  	code += '  pluginName: ' + JSON.stringify(configInfo.pluginName) + ',\n';
	}

	if(Array.isArray(configInfo.pluginName) && configInfo.plugins){

		code += '  plugins: {\n';

		configInfo.pluginName.forEach(function(subConfigName){


			code += '    '+subConfigName+': {\n';
			var subConfigInfo = configInfo.plugins[subConfigName];
			if(subConfigInfo.pluginName){
		  	code += '      pluginName: ' + JSON.stringify(subConfigName) + ',\n';
			}
			code += doGenerateConfigsCode(subConfigInfo, 6);
			code = code.replace(/,\n$/, '\n');
			code += '    },\n';

		});

		code = code.replace(/,\n$/, '\n');
		code += '  },\n';

	} else {
		code += doGenerateConfigsCode(configInfo, 2);
	}

  if(configInfo.enums && configInfo.enums.length > 0){
    configInfo.enums.forEach(function(enm){
			if(enm.doc){
				code += reIndent(enm.doc, 2) + '\n';
			}
      code += '  '+enm.name+': {\n';
      enm.values.forEach(function(entry){
				if(entry.doc){
					code += reIndent(entry.doc, 4) + '\n';
				}
	      code += '    '+entry.name+': '+JSON.stringify(entry.value)+',\n';
			});
			code = code.replace(/,\n$/, '\n');
      code += '  },\n';
    });
  }

	code = code.replace(/,\n$/, '\n');
  code += '};\n';
  return code;
}

function doGenerateConfigsCode(configInfo, indent){

	var code = '';
	if(configInfo.config && configInfo.config.length > 0){
		code += generateConfig(configInfo.config, configInfo.docs, indent);
	}

	if(configInfo.speechConfig && configInfo.speechConfig.length > 0){
		code += generateConfig(configInfo.speechConfig, configInfo.speechDocs, indent, true);
	}

  if(configInfo.subConfig){
    code += generateSubConfig(configInfo.subConfig, indent);
  }

	if(configInfo.speechSubConfig){
    code += generateSubConfig(configInfo.speechSubConfig, indent, 'speechSubConfig');
  }

	return code;
}

function storeExports(dir, code, fileName){
  fileName = fileName || OUTPUT_FILE_NAME;
  return fileUtils.storeToFile(dir, code, fileName);
}

module.exports = {
  generateCode: generateConfigsCode,
  writeToFile: storeExports,
  getDefaultFileName: function(){ return OUTPUT_FILE_NAME; }
}
