
    //remove mediaManager instance from arguments:
    var __mediaManager__ = require('mmirf/mediaManager');
    var modifiedArgs = [];
    for(var i=0, offset=0, size=origArgs.length; i < size; ++i){
      if(origArgs[i] === __mediaManager__){
        ++offset;
      } else {
        modifiedArgs[i - offset] = origArgs[i];
      }
    }
    origArgs = modifiedArgs;
