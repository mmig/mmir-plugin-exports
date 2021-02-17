
    // already set var(s): exported
    if(typeof exported === 'function'){
      var expArgsLen = exported.length;
      if(expArgsLen >= 1){

        if(expArgsLen > 2){
          console.warn('unknown plugin factory function parameters: expected 0 to 2 parameters, but got ' + expArgsLen);
        }

        // create wrapper for injecting closeMicFunc
        var closeMicFunc;
        var closeMicFuncWrapper = function(){
          closeMicFunc();
        };
        exported = exported(closeMicFuncWrapper, expArgsLen === 1? void(0) : require('mmirf/logger').create());

        // create "injection" code for closeMicFunc via deprecated hook _init(closeMicFunc)
        exported.__compat_init = exported._init;
        exported._init = function(_closeMicFunc){
          closeMicFunc = _closeMicFunc;
          exported.__compat_init && exported.__compat_init(_closeMicFunc);
        }

      } else {
        exported = exported();
      }
    }
