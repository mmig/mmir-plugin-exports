
var fileUtils = require('./file-utils.js');

const OUTPUT_FILE_NAME = 'module-config.gen.js';

function reIndent(comment, indent){
	var indentStr = new Array(indent + 1).join(' ');
  return comment.trim().replace(/^\s*\/\*/, indentStr+'/*').replace(/(\r?\n)\s*\*/g, '$1' + indentStr+' *');
}

function generateSubConfig(subConfig, indent){
	var indentStr = new Array(indent + 1).join(' ');
	var code = '';
	code += indentStr + 'subConfig: {\n';
	Object.keys(subConfig).forEach(function(cname){
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

function generateConfig(config, configDocs, indent){
	var indentStr = new Array(indent + 1).join(' ');

	var code = '';
	code += indentStr + 'config: [\n';
  config.forEach(function(c, index){
    var comment = configDocs[index];
    if(comment){
      code += reIndent(comment, indent + 2) + '\n';
    }
    code += indentStr + '  ' + JSON.stringify(c) + ',\n';
  });
	code = code.replace(/,\n$/, '\n');
  code += indentStr + '],\n';

	return code;
}

/**
 *
 * @param  {ConfigInfo} configInfo the config-info object:
 * 											{
 * 												//the plugin name (as used for configuration)
 * 												pluginName: string,
 * 												//the (main) configuration field-names for the plugin
 * 												config: string[],
 * 												//the JS-docs for the configuration field-names (if there is any)
 * 												docs: string[],
 * 												// the exported enums (may be empty): additinonal/optional meta-data
 * 												enums: EnumInfo[],
 * 												// hierachical sub-configuration, if config is complex
 * 												[subConfig: SubConfig]
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

	if(configInfo.config && configInfo.config.length > 0){
		code += generateConfig(configInfo.config, configInfo.docs, 2);
	}

  if(configInfo.subConfig){
    code += generateSubConfig(configInfo.subConfig, 2);
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

function storeExports(dir, code, fileName){
  fileName = fileName || OUTPUT_FILE_NAME;
  return fileUtils.storeToFile(dir, code, fileName);
}

module.exports = {
  generateCode: generateConfigsCode,
  writeToFile: storeExports,
  getDefaultFileName: function(){ return OUTPUT_FILE_NAME; }
}
