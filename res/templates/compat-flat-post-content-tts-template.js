
    // already set var(s): exported
    if(typeof exported === 'function'){
      var expArgsLen = exported.length;
      if(expArgsLen > 0){

        if(expArgsLen > 1){
          console.warn('unknown plugin factory function parameters: expected 0 to 1 parameters, but got ' + expArgsLen);
        }
        exported = exported(require('mmirf/logger').create());

      } else {
        exported = exported();
      }
    }
