
    __AsyncExport__ = exported;
    if(typeof exported !== 'function'){
      for(var prop in exported){
        AsyncExportWrapper[prop] = exported[prop];
      }
    }
