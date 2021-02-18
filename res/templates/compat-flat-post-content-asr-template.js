
    // backwards compatiblity for asr-plugins that target earlier versions of mmir-plugin-encoder-core (< 1.x):
    // wrap exported object in factory function
    if(typeof exported !== 'function'){

      var _exported = exported;
      var _exportedConstructor = _exported.constructor;
      exported = function(closeMicFunc, _defaultLogger) {
        var inst = new _exportedConstructor();
        for(var prop in _exported){
          inst[prop] = _exported[prop];
        }
        if(inst._init){
          inst._init(closeMicFunc);
        }
        return inst;
      };
    }
