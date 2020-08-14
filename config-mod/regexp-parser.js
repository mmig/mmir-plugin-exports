
const regexp = require('regexpp');
const defaultOptions = {};

function createParser(eventHandler, options){
  options = Object.assign({}, defaultOptions, options || {});
  const parser = {
    _options: options,
    parse: eventHandler
  };
  return parser;
}

/**
 * parse XML code
 *
 * @param  {Readable} readable a readable stream
 * @param  {Function | SAXParser} parserOrEventHandler an event handler or parser instance
 * @param  {Function} callback the callback that is invoked on completion: callback(error | null)
 * @param  {Options} [options.regexp] a string containing a JavaScript regular expression literal,
 *                            e.g. <code>"/tEsT/i"</code>.
 *                            NOTE: this option is required by the regexp-parser!
 * @param  {Options} [options.replacePattern] a string replacing found regexp matches: if defined,
 *                            replaces the match with this pattern, instead of the <code>newAttrValue</code> string.
 *                            This can be used to include capture groups from the regexp
 *                            <code>"$<group number>"</code>, where the first group has number <code>1</code>,
 *                            and the <code>newAttrValue</code> can be referred to by <code>"$0"</code>
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
      parser.parse(content);
      callback(null, content);
    } catch(err){
      return callback(err, content);
    }
  });
}

function parseRegExp(strRe){//, forceGlobalFlag){
  const parsedRe = regexp.parseRegExpLiteral(strRe);//will throw error if it is not a valid RegExp literal
  const cleaned = parsedRe.pattern.raw.replace(/\\\//g, '/');//remove escaped slash that is required in regexp literals
  let flags = parsedRe.flags.raw;
  //DISABLED: if regexp definition does not have global set, do treat parsing as if onlyFirst was set to true
  // if(forceGlobalFlag && !parsedRe.flags.global){//must set global flag for using the regexp for parsing
  //   flags += 'g';
  // }
  return new RegExp(cleaned, flags);
}

function toPos(position, offset){
  offset = offset || 0;
  return {
    line: -1,
    column: -1,
    offset: position + offset
  };
}

function createAttrPos(_tagName, _attrName, attrData){
  return {
    tagName: _tagName,
    attrName: _attrName,
    nameStart: -1,
    nameEnd: -1,
    attrValue: attrData.value,
    valueStart: toPos(attrData.start, 0),
    valueEnd: toPos(attrData.start + attrData.length, 0)
  };
}

const reLine = /\r?\n/gm;
function findLineColumn(str, offset, pos){
  reLine.lastIndex = 0;
  let currLine = 1;
  let currLineOffset = 0;
  while(reLine.exec(str)){
    if(reLine.lastIndex >= offset){
      break;
    }
    currLineOffset = reLine.lastIndex;
    ++currLine;
  }
  pos.line = currLine;
  pos.column = offset - currLineOffset;
  if(process.env.verbose) console.log('  findLineColumn('+offset+'): line ',currLine, ', line-offset ', currLineOffset, ', column ', pos.column);//, ', m.index ', m.index)
  return pos;
}

function createAttrPosFinderFunc(_tagName, _attrName, positionList, options){
  if(_tagName){
    console.log('[WARN] regexpParser::createAttrPosFinderFunc(): argument tagName is not supported!');
  }
  if(_attrName){
    console.log('[WARN] regexpParser::createAttrPosFinderFunc(): argument attrName is not supported!');
  }

  const strRe = options.regexp;
  // const patternGroup = parseFloat(options.patternGroup) || 0;


  const re = parseRegExp(strRe);//, onlyFirst? false : true);//will throw error if it is not a valid RegExp literal

  const onlyFirst = options.onlyFirst || !re.global;

  if(process.env.verbose) console.log('  regexpParser: created regexp (options.onlyFirst='+options.onlyFirst+'): ', re);

  return function(textData) {
    let m;
    while(m = re.exec(textData)){

      const pos = createAttrPos(_tagName, _attrName, {
        start: m.index,
        length: m[0].length - 1,
        value: m[0]
      });

      findLineColumn(textData, pos.valueStart.offset, pos.valueStart);
      findLineColumn(textData, pos.valueEnd.offset, pos.valueEnd);//TODO make these more efficient by keeping track of the line here(?), instead of re-calculating for each location

      positionList.push(pos);

      if(onlyFirst){
        return;
      }
    }
  };
}

function getReadOptions(options){
  return options || defaultOptions;
}

function replaceValue(newValue, pos, options){

  const replacePattern = options.replacePattern;
  if(!replacePattern){
    return newValue;
  }

  const preparedPattern = substitude(replacePattern, newValue);
  const re = parseRegExp(options.regexp);

  return pos.attrValue.replace(re, preparedPattern);
}

function substitude(str, newValue){
  var res = str, i = 0;
  while((i = res.indexOf('$0', i)) !== -1){
    if(res[i-1] !== '$'){
      res = res.substring(0,i) + newValue + res.substring(i+2);
    }
    i += 3;
  }
  return res;
}

module.exports = {
  type: 'regexp',
  createParser: createParser,
  getReadOptions: getReadOptions,
  // parseFile: parseFile,
  parseStream: parseStream,
  toPos: toPos,
  createAttrPos: createAttrPos,
  createAttrPosFinderFunc: createAttrPosFinderFunc,
  replaceValue: replaceValue
};