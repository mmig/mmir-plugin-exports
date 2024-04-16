/*
 * DISABLED:
 * requires a modified version of saxes that can include position information for attributes
 *
 * for enabling:
 * install git+https://github.com/mmig/saxes#feature_attributePosition
 *
 * @deprecated use `sax-wasm` parser instead (the `saxes` parser is only supported with special support for position information, see note above)
 */

var saxes = require("saxes");

var defaultOptions = {
  position: true,
  attributePosition: true,
  xmlns: true
};

function addEventHandler(parser, eventHandlerDict){
  Object.keys(eventHandlerDict).forEach(function(name){
    parser.on(name, eventHandlerDict[name]);
  })
}

function createParser(eventHandlerDict, options){
  options = Object.assign({}, defaultOptions, options || {});
  const parser = new saxes.SaxesParser(options);
  addEventHandler(parser, eventHandlerDict);
  return parser
}

/**
 * parse XML code
 *
 * @param  {Readable} readable a readable stream
 * @param  {EventHandlerDictionary | SAXParser} parserOrEventHandler a dictionary of event handlers or parser instance
 * @param  {Function} callback the callback that is invoked on completion: callback(error | null)
 * @param  {number} [events] OPTIONAL if parserOrEventHandler is a function (otherwise ignored), bitmask for events that should be passed to the eventHandler (DEFAULT: SaxEventType.Attribute | SaxEventType.OpenTag;)
 * @param  {Options} [options] OPTIONAL if parserOrEventHandler is a function (otherwise ignored), options for the parser (DEFAULT: {highWaterMark: 32 * 1024})
 */
function parseStream(readable, parserOrEventHandler, callback, options){

  var parser;
  if(typeof parserOrEventHandler.write !== 'function'){
    parser = createParser(parserOrEventHandler, options);
  } else {
    parser = parserOrEventHandler;
  }

  const data = [];
  readable.on('error', function(err) {
    parser.end();
    callback(err);
  });
  readable.on('data', function(chunk) {
    parser.write(chunk);
    data.push(chunk.toString('utf8'));
  });
  readable.on('end', function(){
    parser.close();
    callback(null, data.join(''));
  });
}

function toPos(position, offset){
  offset = offset || 0;
  return {
    offset: position.position + offset,
    line: position.line,
    column: position.column + offset
  };
}

function createAttrPos(tagName, attrData, path){
  return {
    tagName: tagName,
    attrName: attrData.name,
    path: path.join(),
    nameStart: toPos(attrData.namePosition.start),
    nameEnd: toPos(attrData.namePosition.end, -1),
    attrValue: attrData.value,
    valueStart: toPos(attrData.valuePosition.start),
    valueEnd: toPos(attrData.valuePosition.end, -1)
  };
}

function createAttrPosFinderFunc(tagName, attrName, positionList){
  var path = [];
  return {
    'opentag': function(data){
      const tname = data.name;
      if(process.env.verbose) console.log('sax event OpenTag -> ', tname, data)
      path.push(tname);
      if(!tagName || tagName === tname){
        Object.values(data.attributes).forEach(function(attrData) {
          if(process.env.verbose) console.log('    attribute '+attrData.name+'='+JSON.stringify(attrData.value)+' at ', attrData.valuePosition)
          if(!attrName || attrName === attrData.name){
            positionList.push(createAttrPos(tname, attrData, path))
          }
        });
      } else if(process.env.verbose){
        Object.values(data.attributes).forEach(function(attrData) {
          if(process.env.verbose) console.log('    IGNORED non-matching tag attribute '+attrData.name+'='+JSON.stringify(attrData.value)+' at ', attrData.valuePosition)
        });
      }
    },
    'closetag': function(data){
      const tname = data.name;
      if(process.env.verbose) console.log('sax event CloseTag -> ', tname, data);
      path.pop();
    },
    'end': function(){
      if(process.env.verbose) console.log('sax event End!');
      path.splice(0);
    }
  };
}

function getReadOptions(_options){
  return void(0);
}

module.exports = {
  type: 'saxes',
  createParser: createParser,
  getReadOptions: getReadOptions,
  // parseFile: parseFile,
  parseStream: parseStream,
  toPos: toPos,
  createAttrPos: createAttrPos,
  createAttrPosFinderFunc: createAttrPosFinderFunc
};
