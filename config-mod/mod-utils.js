
const path = require('path');
const fs = require('fs');
const stream = require('stream');

/** @type "saxes" | "sax-wasm" | "json" */
const defaultParserType = 'sax-wasm';
var parserType;
var defaultParser;

/**
 * set the default parser engine (and loads the default parser if necessary)
 *
 * @param {"saxes" | "sax-wasm" | "xml" | "json"} [type] the name for the parser engine
 *                                      DEFAULT: "sax-wasm"
 *                                      NOTE you may need to install "sax-wasm" before you can use it
 * @return the default parser engine
 */
function setDefaultParser(type){
  type = _getType(type);
  if(!defaultParser || parserType !== type){
      parserType = type;
      defaultParser = require('./' + parserType + '-parser');
  }
  return defaultParser;
}

/**
 * get the parser engine
 *
 * @param {"saxes" | "sax-wasm" | "xml" | "json" | "regexp" | string} [type] the name for the parser engine
 *                                      If type is specified, but does not match any of the engines, then "regexp" is used.
 *                                      DEFAULT: "sax-wasm"
 *                                      NOTE you may need to install "saxes" before you can use it
 * @return the parser engine module
 */
function getParserFor(type){
  type = _getType(type);
  return require('./' + type + '-parser');
}

/** HELPER determine parser engine type */
function _getType(type){
  if(type){
    switch(type){
      case 'xml':
        return defaultParserType;
      case 'saxes':
      case 'sax-wasm':
      case 'json':
        return type;
      default:
        return 'regexp';
    }
  }
  return parserType || defaultParserType;
}

/** HELPER get parser from options, or the default parser */
function _getParser(options){
  return (options && options.parser) || setDefaultParser();
}

function _getOptionsWithDefaults(options){
  options = options || {};
  if(!options.parser){
    options.parser = _getParser(options)
  }
  return options;
}

/**
 * parse an XML file
 *
 * @param  {string} filePathOrContent a path to XML or JSON file, or (string) XML content to parse:
 *                                    if a file for the given string exists, the file will be opened, otherwise
 *                                    the string will be treated as XML content
 * @param  {Function | SAXParser} parserOrEventHandler an event handler or parser instance
 * @param  {Function} callback the callback that is invoked on completion: callback(error | null)
 * @param  {Options} [options] OPTIONAL if parserOrEventHandler is a function (otherwise ignored), options for the parser DEFAULT
 */
function _parseFile(filePathOrContent, parserOrEventHandler, callback, options){

  options = _getOptionsWithDefaults(options);
  var _parser = _getParser(options);
  const filePath = path.resolve(filePathOrContent);
  const exists = fs.existsSync(filePath);
  const readable = exists? fs.createReadStream(path.resolve(filePath), _parser.getReadOptions(options)) : createStringStream(filePathOrContent);
  _parser.parseStream(readable, parserOrEventHandler, callback, options);
}

function createStringStream(str){
  const Readable = stream.Readable;
  const s = new Readable();
  s._read = function(){}; // for backwards compatiblity, node <= v9.2.1
  s.push(str);
  s.push(null);
  return s;
}

/**
 * get the attribute positions from an XML file
 *
 * @param  {string} filePathOrContent a path to XML or JSON file, or (string) XML content to parse:
 *                                    if a file for the given string exists, the file will be opened, otherwise
 *                                    the string will be treated as XML content
 * @param  {string} tagName the tag name, e.g. "plugin" for <pre><plugin></pre>
 * @param  {string} attrName the attribute name
 * @param  {Function} callback the callback that will be invoked with the array of found positions:
 *                              <pre>callback(positions: {positions: Position[], content: string})</pre>
 *                              Each Position will have at least the following fields:
 *                              <pre>{
 *                                tagName: tagName,
 *                                attrName: string,
 *                                nameStart: {line: number, column: number, offset?: number},
 *                                nameEnd: {line: number, column: number, offset?: number}
 *                                attrValue: string,
 *                                valueStart: {line: number, column: number, offset?: number},
 *                                valueEnd: {line: number, column: number, offset?: number}
 *                              }
 *                              </pre>
 *                              OR if XML was parsed and only a tagName was specified:
 *                              <pre>{
 *                                tagName: tagName,
 *                                tagStart: {line: number, column: number, offset?: number},
 *                                tagEnd: {line: number, column: number, offset?: number}
 *                                tagValue: string,
 *                                valueStart: {line: number, column: number, offset?: number},
 *                                valueEnd: {line: number, column: number, offset?: number}
 *                              }
 *                              </pre>
 * @param  {Options} [options] see options argument for {@link #replaceAttrValue}
 *
 * @see #replaceAttrValue
 */
function getPositions(filePathOrContent, tagName, attrName, callback, options){
  options = _getOptionsWithDefaults(options);
  const list = [];
  var _parser = _getParser(options);
  const getPosHandler = _parser.createAttrPosFinderFunc(tagName, attrName, list, options);
  _parseFile(filePathOrContent, getPosHandler, function(err, content){
    if(err){
      return callback(err);
    }
    if(options && options.resolvePositionOffset){
      list.forEach(function(pos){
        for(var prop in pos){
          if(pos[prop] && typeof pos[prop].line === 'number'){
            pos[prop].offset = getOffset(pos[prop], content);
          }
        }
      });
    }
    callback(null, {content: content, positions: list});
  }, options);
}

/**
 * replace the value of a tag-attribute
 *
 * @param  {string} filePathOrContent a path to XML or JSON file, or (string) XML content to parse:
 *                                    if a file for the given string exists, the file will be opened, otherwise
 *                                    the string will be treated as XML content
 * @param  {string} tagName the tag name, e.g. "plugin" for <pre><plugin></pre>
 * @param  {string} attrName the attribute name
 * @param  {string} newAttrValue the new value for the attribute
 * @param  {Function} callback callback that will be invoked with the XML string
 *                              where the attribute value has been replaced, or
 *                              empty string if no replacement was done.
 * @param  {Options} [options.parser] the parser engine. If not defined, the current parser-engine
 *                            will be used.
 * @param  {Options} [options.onlyFirst] if <code>true</code>, only the first attribute's
 *                            that is found, will be replaced
 * @param  {Options} [options.breadthFirst] if <code>true</code>, and parser-engine supports
 *                            the option, the data hierarchy will be parsed/processed breadth-first.
 *                            This will e.g. ensure that the first match when searching a tag/attribute
 *                            will be in the upper-most/outer hierarchy level.
 *                              supported engines: "json"
 * @param  {Options} [options.regexp] a string containing a JavaScript regular expression literal,
 *                            e.g. <code>"/tEsT/i"</code>.
 *                            NOTE: for using the regexp-engine, this option is required!
 *                              supported engines: "regexp"
 * @param  {Options} [options.replacePattern] a string replacing found regexp matches: if defined,
 *                            replaces the match with this pattern, instead of the <code>newAttrValue</code> string.
 *                            This can be used to include capture groups from the regexp
 *                            <code>"$<group number>"</code>, where the first group has number <code>1</code>,
 *                            and the <code>newAttrValue</code> can be referred to by <code>"$0"</code>
 *                              supported engines: "regexp"
 * @param  {Options} [options.resolvePositionOffset] if <code>true</code>,
 *                            all position results will include the <code>offset</code> property, i.e.
 *                            <pre>{line: number, column: number, offset: number}</pre>
 *                            (i.e. if necessary computed via helper <code>getOffset()</code>)
 */
function replaceAttrValue(filePathOrContent, tagName, attrName, newAttrValue, callback, options){

  options = _getOptionsWithDefaults(options);

  var posResult = null;
  if(typeof filePathOrContent !== 'string' && filePathOrContent && filePathOrContent.positions && filePathOrContent.content){
    posResult = filePathOrContent;
    options = newAttrValue;
    callback = attrName;
    newAttrValue = tagName;
    tagName = attrName = filePathOrContent = void(0);
  }

  if(posResult){
    replFunc(null, posResult);
  } else {
    getPositions(filePathOrContent, tagName, attrName, replFunc, options);
  }

  function replFunc(err, posResult){
    if(err){
      return callback(err);
    }

    const _parser = _getParser(options);
    const isJsonVal = _parser.type === 'json';
    const onlyFirst = options && options.onlyFirst;

    const content = posResult.content, positions = posResult.positions;
    let result = content, pos;
    const len = positions.length;
    if(len > 0){

      //ensure posisions are sorted ASC by their occurance:
      positions.sort(function(p1, p2){
        const s1 = p1.valueStart, s2 = p2.valueStart;
        if(s1.line === s2.line) return s1.column - s2.column;
        return s1.line - s2.line;
      });

      if(process.env.verbose) console.log('  replace ',tagName,attrName,' for ', positions);

      //process replacement, starting from last position
      for(let i = onlyFirst? 0 : positions.length - 1; i >= 0; --i){

        pos = positions[i];
        if(process.env.verbose) console.log('  processing item['+i+']: ', pos);

        const offsetStart = getOffset(pos.valueStart, content);
        const offsetEnd =  getOffset(pos.valueEnd, content);

        if(offsetStart === -1 || offsetEnd === -1){
          return callback('could not find offsets for '+JONS.parse(pos));
        }

        if(process.env.verbose) console.log('value for ', pos.attrName, ': ['+offsetStart+', '+offsetEnd+'] -> ', JSON.stringify(content.substring(offsetStart, offsetEnd)));
        if(process.env.verbose) console.log('replacing (isJson? '+isJsonVal+', parserType='+_parser.type+') with -> ', (isJsonVal? JSON.stringify(newAttrValue) : newAttrValue));

        let replVal = (isJsonVal? JSON.stringify(newAttrValue) : newAttrValue);
        if(typeof _parser.replaceValue === 'function'){
          replVal = _parser.replaceValue(replVal, pos, options);
          if(process.env.verbose) console.log('  replacing with processed value -> ', replVal);
        }

        result = result.substring(0, offsetStart) + replVal + result.substring(offsetEnd);

        if(onlyFirst){
          return callback(null, result === content? '' : result);
        }
      }
    }

    callback(null, result === content? '' : result);
  }
}


function getOffset(pos, content){
  return typeof pos.offset === 'number'? pos.offset : findOffset(content, pos.line, pos.column);
}

const reLine = /\r?\n/gm;
function findOffset(str, line, column){
  reLine.lastIndex = 0;
  let currLine = 1;
  while(currLine < line && reLine.exec(str)){//(m = reLine.exec(str))){
    ++currLine;
  }
  if(currLine !== line){
    return -1;
  }
  if(process.env.verbose) console.log('  findOffset('+line+','+column+'): line ',currLine, ', lastIndex ', reLine.lastIndex);//, ', m.index ', m.index)
  return reLine.lastIndex + column;
}

function toDebugResult(result){
  const copy = Object.assign({}, result) || {};
  copy.content = copy.content && typeof copy.content.length === 'number'? '<string.length='+copy.content.length+'>' : copy.content;
  return copy;
}

module.exports = {
  replaceAttrValue: replaceAttrValue,
  getPositions: getPositions,
  parseFile: function(){
    setDefaultParser();
    return _parseFile.apply(module, arguments);
  },
  setDefaultParser: setDefaultParser,
  getParserFor: getParserFor,
  getParserType: function(){
    return parserType || defaultParserType;
  },
  getOffset: getOffset,
  findOffset: findOffset,
  _toDebugResult: toDebugResult,
}
