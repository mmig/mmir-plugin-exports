# Plugin Exports

utility for creating `module-ids.gen.js` for mmir-plugins:

## `module-ids.gen.js`

parses the `package.json` of a plugin and
 * creates alias i.e. `paths` entries for all files in (recursively except for workers (sub)dir(s))
   * directories.lib
 * creates a list of `workers` for all files in (non-recursive!)
   * <custom field> mmir.workers  
     string | Array<string>: single or list of directory/ies or file(s)
 * creates a list of exported `modules` for (non-recursive!)
   * <custom field> mmir.exports:  
     string | Array<string>: single or list of directory/ies or file(s)
 * adds as entry to exported `modules` with alias/path for the plugin itself, i.e {<plugin ID>: <main file>}
   * main
 * creates a list of `dependencies` for all entries in
   * dependencies


## `module-config.gen.js`

parses the `config.d.ts` of a plugin and
 * exports the property (name) of `<name>ConfigEntry` interface as `pluginName`:  
   `export interface ThePluginNameConfigEntry {...`
 * exports other interfaces (their properties) with suffix `Config` as config-property lists:  
   `export interface AnotherNameConfig {...`
 * exports enums as properties:  
   `export enum SomeName {...`

NOTE all interfaces etc. must be defined in the root of `config.d.ts`
