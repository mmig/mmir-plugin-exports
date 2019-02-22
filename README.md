# Plugin Exports

utility for creating `module-ids.gen.js` for mmir-plugins:

## `module-ids.gen.js`

running `pluginexport <dir>`

parses the `package.json` of a plugin and
 * creates alias i.e. `paths` entries for all files in (recursively except for workers (sub)dir(s))
   * `directories.lib`
 * creates a list of `workers` for all files in (non-recursive!)
   * `<custom field> mmir.workers`  
     `string | Array<string>`: single or list of directory/ies or file(s)
 * creates a list of exported `modules` for (non-recursive!)
   * `<custom field> mmir.exports`:  
     `string | Array<string>`: single or list of directory/ies or file(s)
 * adds as entry to exported `modules` with alias/path for the plugin itself, i.e `{<plugin ID>: <main file>}`
   * `main`
 * creates a list of `dependencies` for all entries in
   * `dependencies`


## `module-config.gen.js`

running `pluginexport <dir>`

parses the `config.d.ts` of a plugin and
 * exports the properties (name) of `[.*]PluginConfig` interface as `pluginName`:  
   `export interface SomeNamePluginConfig { <the plugin config name>: <the config entry type>; }`
   * if there is only one property specified, the generated module will represent a single plugin, e.g.
     ```
     pluginName: "someName",
     config: [
       ...
     ```
   * if multiple properties are declared, the generated module's `pluginName` will be an array
     and an additional field `plugins` will hold the corresponding plugin information, e.g.
     ```
     pluginName: ["pl1", "pl2"],
     plugins: {
       pl1: {
         pluginName: "pl1",
         config: [
           ...
     ```
   * the properties' type will be used as "main" entry point for creating the config-list, e.g.
     ```
       somePluginName: SomePluginConfigEntry;
       ...
     }
     export interface SomePluginConfigEntry extends MediaManagerPluginEntry {
       someConfig: string;
     }
     ```
     ->
     ```
     pluginName: "somePluginName",
     config: ["someConfig"],
     ```
   * optionally, if relevant for the plugin, the SpeechConfig entry is specified by adding it as Union type:
    ```
      somePluginName: SomePluginConfigEntry | SomePluginSpeechConfigEntry;
      ...
    }
    ...
    export interface SomePluginSpeechConfigEntry extends SpeechConfigPluginEntry {
      someSpeechConfig: string;
    }
    ```
    ->
    ```
    pluginName: "somePluginName",
    config: ...,
    speechConfig: ["someSpeechConfig"],
    ```
 * exports other interfaces (their properties) with suffix **PluginSpeechConfigEntry** as speechConfig-property lists:  
   `export interface SomeNamePluginSpeechConfigEntry {...`
   * NOTE should extend `mmir.SpeechConfigPluginEntry`
 * exports other interfaces (their properties) with suffix **PluginConfigEntry** as config-property lists:  
   `export interface AnotherNamePluginConfigEntry {...`
   * NOTE should extend `mmir.MediaManagerPluginEntry`
 * exports enums as properties:  
   `export enum SomeName {...`

NOTE all interfaces etc. must be defined in the root of `config.d.ts`

## Creating Compatibility Modules

running `createcompat <dir>`

if run with a directory as input:  
parses the `package.json` of the plugin and
 * for each entry in <custom field> mmir.compat.{<name>: <entry>} a compatibility is created:
   * <name>: the source file (relative path within the package)
   * <entry>: the details for generating the compatibility module with {file: <file path>, type: <module type>, exportedName?: string}:
     * file: the target file path where the created module will be stored (within the package)
     * type: the module type, one of "media" | "asr" | "tts" | "custom" (DEFAULT: "media")
     * exportedName: if type is "custom", the name for the (global) variable must be specified, to which the module will be exported
  * example: `mmir.compat = {"./www/recorderExt.js": {"file": "./res/recorderExtCompat.js", "type": "custom", "exportedName": "Recorder"}}`
