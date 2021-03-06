
    //backwards compatibility for media plugins that target mmir-lib < 7.x:
    //remove mediaManager instance from arguments
    var __mmir__ = require('mmirf/core');
    if(!__mmir__.isVersion || __mmir__.isVersion(7, '<')){
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
    }
