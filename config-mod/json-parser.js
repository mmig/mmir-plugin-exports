
const Parser = require('jsonlint-pos').Parser;
const defaultOptions = {posField: '_pos'};

function createParser(eventHandler, options){
  options = Object.assign({}, defaultOptions, options || {});
  const parser = new Parser();
  parser.setPosEnabled(true);
  parser.setStrict(true);
  parser._processPositions = eventHandler;
  parser._options = options;//FIXME
  return parser;
}

/**
 * parse JSON file
 *
 * @param  {Readable} readable a readable stream
 * @param  {Function | JSONParser} parserOrEventHandler an event handler or parser instance
 * @param  {Function} callback the callback that is invoked on completion: callback(error | null)
 * @param  {Options} [options.breadthFirst] for parsing: if <code>true</code>, and parser-engine supports
 *                            the option, the data hierarchy will be parsed/processed breadth-first.
 *                            This will e.g. ensure that the first match when searching a tag/attribute
 *                            will be in the upper-most/outer hierarchy level.
 */
function parseStream(readable, parserOrEventHandler, callback, options){

  var parser;
  if(typeof parserOrEventHandler === 'function'){
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
    data.push(chunk.toString('utf8'));
  });
  readable.on('end', function(){
    const content = data.join('');
    try {
      var parsedJson = parser.parse(content);
      parser._processPositions(parsedJson);
      callback(null, content);
    } catch(err){
      return callback(err, content);
    }
  });
}

function toPos(position, offset, isStart){
  offset = offset || 0;
  return {
    line: position[isStart? 'first_line' : 'last_line'],
    column: position[isStart? 'first_column' : 'last_column'] + offset
  };
}

function createAttrPos(_tagName, attrData){
  return {
    tagName: _tagName,
    attrName: attrData.name,
    nameStart: toPos(attrData.pos[0], 1, true),//NOTE position includes quotes
    nameEnd: toPos(attrData.pos[0], -1, false),//NOTE position includes quotes
    attrValue: attrData.value,
    valueStart: toPos(attrData.pos[1], 0, true),
    valueEnd: toPos(attrData.pos[1], 0, false)
  };
}

function createAttrPosFinderFunc(_tagName, attrName, positionList, options){
  if(_tagName){
    console.log('[WARN] jsonParser::createAttrPosFinderFunc(): argument tagName is not supported!');
  }
  const breadthFirst = options && options.breadthFirst;
  const onlyFirst = options && options.onlyFirst;
  function traverse(elem, res, _this){

    if(elem && typeof elem === 'object'){

      if(process.env.verbose) console.log('json traversing object -> ', elem);

      if(Array.isArray(elem)){

        var item;
        for(var i=0, size=elem.length; i < size; ++i){
          item = elem[i];
          if(!traverse(item, res, _this)){
            return false;//<- indicate abort
          }
        }

      } else {

        var children = breadthFirst? [] : null, names = Object.keys(elem), fieldName, val, posList;
        for(var i=0, size=names.length; i < size; ++i){
          fieldName = names[i];
          if(fieldName === _this._options.posField){//ignore pos-field itself
            continue;
          }
          val = elem[fieldName];
          if(fieldName === attrName){
            posList = elem[_this._options.posField]['_'+fieldName];
            if(process.env.verbose) console.log('    attribute '+fieldName+'='+JSON.stringify(val)+' at [', posList[0], '] <- [', posList[1], ']')
            res.push(createAttrPos(null, {name: fieldName, value: val, pos: posList}));

            //if only first occurance should be process, abort after submitting first match to the result list
            if(onlyFirst){
              return false;//<- indicate abort
            }
          }
          //store children for visiting later? (i.e. breadth-first visition)
          breadthFirst? children.push(val) : traverse(val, res, _this);
        }
        // use breadth-first traversing, i.e. visit chlidren after level has been visitied:
        if(breadthFirst) {
          // console.log('  bread-first visitaion: finished current object, visiting children -> ', children);//DEBUG

          var ch;
          for(var j=0, len=children.length; j < len; ++j){
            ch = children[j]
            if(!traverse(ch, res, _this)){
              return false;//<- indicate abort
            }
          }
        }
      }
    }
    return true;//<- indicate continue
  }
  return function(jsonData) {
    return traverse(jsonData, positionList, this)
  };
}

function getReadOptions(options){
  return options || defaultOptions;
}

module.exports = {
  type: 'json',
  createParser: createParser,
  getReadOptions: getReadOptions,
  // parseFile: parseFile,
  parseStream: parseStream,
  toPos: toPos,
  createAttrPos: createAttrPos,
  createAttrPosFinderFunc: createAttrPosFinderFunc
};
