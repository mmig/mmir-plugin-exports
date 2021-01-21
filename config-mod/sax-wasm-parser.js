
const fs = require('fs');
const sax = require('sax-wasm');


const SaxEventType = sax.SaxEventType
const SAXParser = sax.SAXParser;

// for loading & initializing WebAssembly binary
const saxPath = require.resolve('sax-wasm/lib/sax-wasm.wasm');
var saxWasmBuffer;

function doPrepareWasm(parser, callback){
  parser.prepareWasm(saxWasmBuffer).then(function(ready){
    callback(ready? null : 'not ready');
  }).catch(function(err){
    callback(err)
  })
}

function prepareWasm(parser, callback){
  if(!saxWasmBuffer){
    fs.readFile(saxPath, function(err, data){
      if(err){
        return callback(err);
      }
      saxWasmBuffer = data;
      doPrepareWasm(parser, callback);
    });
  } else {
    doPrepareWasm(parser, callback);
  }
}


const defaultOptions = {highWaterMark: 32 * 1024}; // 32k chunks
const defaultEvents = SaxEventType.Attribute | SaxEventType.OpenTag;// | SaxEventType.Comment | SaxEventType.OpenTagStart;

function createParser(eventHandler, options){
  options = Object.assign({}, defaultOptions, options || {});
  const events = typeof options.events === 'number'? options.events : defaultEvents;
  const parser = new SAXParser(events, options);
  parser.eventHandler = eventHandler;
  return parser
}

/**
 * parse XML code
 *
 * @param  {Readable} readable a readable stream
 * @param  {Function | SAXParser} parserOrEventHandler an event handler or parser instance
 * @param  {Function} callback the callback that is invoked on completion: callback(error | null)
 * @param  {Options} [options] OPTIONAL if parserOrEventHandler is a function (otherwise ignored), options for the parser DEFAULT:
 *                    {
 *                      highWaterMark: 32 * 1024,
 *                      events?: number // OPTIONAL if parserOrEventHandler is a function (otherwise ignored), bitmask for events that should be passed to the eventHandler (DEFAULT: SaxEventType.Attribute | SaxEventType.OpenTag;)
 *                    }
 */
function parseStream(readable, parserOrEventHandler, callback, options){

  var parser;
  if(typeof parserOrEventHandler === 'function'){
    parser = createParser(parserOrEventHandler, options);
  } else {
    parser = parserOrEventHandler;
  }

  prepareWasm(parser, function(err){
    if(err){
      return callback(err);
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
      parser.end();
      callback(null, data.join(''));
    });
  });
}

function toPos(position, offset){
  offset = offset || 0;
  return {
    line: position.line + 1,//NOTE SAXParser starts line count at 0!!!
    column: position.character + offset
  };
}

function createAttrPos(tagName, attrData){
  return {
    tagName: tagName,
    attrName: attrData.name.value,
    nameStart: toPos(attrData.name.start),
    nameEnd: toPos(attrData.name.end),
    attrValue: attrData.value.value,
    valueStart: toPos(attrData.value.start),
    valueEnd: toPos(attrData.value.end)
  };
}

function createAttrPosFinderFunc(tagName, attrName, positionList){
  return function(event, data) {
    // console.log('sax event ',event,' -> ', data)
    if(!tagName){

      if (event === SaxEventType.Attribute) {
        // process attribute
        if(process.env.verbose) console.log('sax event Attribute (',event,') -> '+data.name.value+'='+JSON.stringify(data.value.value)+' at [', data.name.start, ',', data.name.end, '] <- [', data.value.start, ',', data.value.end, ']', data)
        positionList.push(createAttrPos(null, data));
      }

    } else {

      if (event === SaxEventType.OpenTag) {
        // process open tag
        const tname = data.name;
        if(process.env.verbose) console.log('sax event OpenTag (',event,') -> ', tname)
        if(tagName === tname){
          data.attributes.forEach(function(attrData) {
            if(process.env.verbose) console.log('    attribute '+attrData.name.value+'='+JSON.stringify(attrData.value.value)+' at [', attrData.name.start, ',', attrData.name.end, '] <- [', attrData.value.start, ',', attrData.value.end, ']', attrData)
            if(!attrName || attrName === attrData.name.value){
              positionList.push(createAttrPos(tname, attrData))
            }
          });
        } else if(process.env.verbose){
          data.attributes.forEach(function(attrData) {
            if(process.env.verbose) console.log('    IGNORED non-matching tag attribute '+attrData.name.value+'='+JSON.stringify(attrData.value.value)+' at [', attrData.name.start, ',', attrData.name.end, '] <- [', attrData.value.start, ',', attrData.value.end, ']')
          });
        }

      } else if(process.env.verbose) {
        if (event === SaxEventType.Attribute) {
          // process attribute
          if(process.env.verbose) console.log('IGNORED sax event Attribute (',event,') -> '+data.name.value+'='+JSON.stringify(data.value.value)+' at [', data.name.start, ',', data.name.end, '] <- [', data.value.start, ',', data.value.end, ']')
        } else if (event === SaxEventType.CloseTag) {
          // process close tag
          const tname = data.name.value;
          if(process.env.verbose) console.log('IGNORED sax event CloseTag (',event,') -> ', tname)
          if(tagName === tname){
            data.attributes.forEach(function(attrData) {
              if(process.env.verbose) console.log('    IGNORED attribute '+attrData.name.value+'='+JSON.stringify(attrData.value.value)+' at [', attrData.name.start, ',', attrData.name.end, '] <- [', attrData.value.start, ',', attrData.value.end, ']')
            });
          }

        } else if (event === SaxEventType.Comment) {
          // process comment tag
          console.log('sax event Comment -> ', data.name || (data.constructor && data.constructor.name), data.value)

        } else {
          // process open tag
          console.log('IGNORED sax event ',event,' -> ', data.name || (data.constructor && data.constructor.name), Buffer.from(data.data).toString('utf8'), data)
        }
      }
    }
  };
}

function getReadOptions(options){
  return options || defaultOptions;
}

module.exports = {
  type: 'sax-wasm',
  createParser: createParser,
  getReadOptions: getReadOptions,
  // parseFile: parseFile,
  parseStream: parseStream,
  toPos: toPos,
  createAttrPos: createAttrPos,
  createAttrPosFinderFunc: createAttrPosFinderFunc
};
