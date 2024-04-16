
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
    path: attrData.parentPath? attrData.parentPath + '.' + attrData.name : attrData.name,
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

  const isAttrPath = Array.isArray(attrName);
  const attrPath = isAttrPath? attrName.join('.') : attrName;
  const isMatch = isAttrPath? function(fieldName, parentPath) {
      return attrPath === getAttrPath(fieldName, parentPath);
    } : function(fieldName, _parentPath) {
      return attrPath === fieldName;
    };
  function getAttrPath(fieldName, parentPath) {
    return parentPath? parentPath + '.' + fieldName : fieldName || '';
  }
  function shouldTraverse(fieldPath) {
    // if attName was a full attribute path: no need to traverse further, if current field path is not part of the target path:
    return isAttrPath? attrPath && attrPath.indexOf(fieldPath) === 0 : true;
  }

  if(process.env.verbose) console.log('  preparing to parse for attr:', attrName, '->', attrPath);

  function traverse(elem, res, ppath, _this){

    if(process.env.verbose) console.log('  checking JSON path:', JSON.stringify(ppath), '...');

    if(elem && typeof elem === 'object'){

      if(process.env.verbose) console.log('json traversing object -> ', elem);

      if(Array.isArray(elem)){

        var item, ipath = getAttrPath(''+i, ppath);
        for(var i=0, size=elem.length; i < size; ++i){
          item = elem[i];
          if(!shouldTraverse(ipath) || !traverse(item, res, ipath, _this)){
            return false;//<- indicate abort
          }
        }

      } else {

        var children = breadthFirst? [] : null, names = Object.keys(elem), fieldName, val, posList, fieldPath;
        for(var i=0, size=names.length; i < size; ++i){
          fieldName = names[i];
          if(fieldName === _this._options.posField){//ignore pos-field itself
            continue;
          }
          val = elem[fieldName];
          if(process.env.verbose) console.log('    processing field ', JSON.stringify(getAttrPath(fieldName, ppath)))
          if(isMatch(fieldName, ppath)){
            posList = elem[_this._options.posField]['_'+fieldName];
            if(process.env.verbose) console.log('    attribute '+fieldName+'='+JSON.stringify(val)+' at [', posList[0], '] <- [', posList[1], ']')
            res.push(createAttrPos(null, {name: fieldName, value: val, pos: posList, parentPath: ppath}));

            //if only first occurance should be process, abort after submitting first match to the result list
            if(onlyFirst || isAttrPath){
              return false;//<- indicate abort
            }
          }

          fieldPath = getAttrPath(fieldName, ppath);
          if(!shouldTraverse(fieldPath)){
            continue;
          }

          //store children for visiting later? (i.e. breadth-first visition)
          if(breadthFirst) {
            children.push({name: fieldName, value: val});
          } else if(!traverse(val, res, fieldPath, _this)){
            return false;//<- indicate abort
          }
        }
        // use breadth-first traversing, i.e. visit chlidren after level has been visitied:
        if(breadthFirst) {
          // console.log('  bread-first visitaion: finished current object, visiting children -> ', children);//DEBUG

          var ch;
          for(var j=0, len=children.length; j < len; ++j){
            ch = children[j];
            if(!traverse(ch.value, res, getAttrPath(ch.name, ppath), _this)){
              return false;//<- indicate abort
            }
          }
        }
      }
    }
    return true;//<- indicate continue
  }
  return function(jsonData) {
    return traverse(jsonData, positionList, '', this);
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
