# Plugin Exports

[![MIT license](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/mmig/mmir-plugin-exports/master)](https://github.com/mmig/mmir-plugin-exports)
[![npm](https://img.shields.io/npm/v/mmir-plugin-exports)](https://www.npmjs.com/package/mmir-plugin-exports)
[![API](https://img.shields.io/badge/docs-API%20reference-orange.svg?style=flat)](https://mmig.github.io/mmir/api)
[![Guides](https://img.shields.io/badge/docs-guides-orange.svg?style=flat)](https://github.com/mmig/mmir/wiki)

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
 * creates a list of exported `files` for (non-recursive!)
   * `<custom field> mmir.exportedFiles`:  
     `string | Array<string>`: single or list of file(s)
 * creates an object `modes` for
   * `<custom field> mmir.modes`:  
     `{[modeName: string]: ModeDefinition}`: where each `ModeDefinition` may have file-replacement-mappings and, optionally, `exports` and `exportFiles` fields
     * `ModeDefinition`: `{[originalFile: string]: ReplacementFile, exports?, exportFiles?}`
 * creates (string) entry `buildConfig` for
   * `<custom field> mmir.buildConfig`:  
      `string`: a file(s) containing a CommonJS module that exports a single or a list of (mmir) build configurations for the plugin
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
     ```javascript
     pluginName: "someName",
     config: [
       ...
     ```
   * if multiple properties are declared, the generated module's `pluginName` will be an array
     and an additional field `plugins` will hold the corresponding plugin information, e.g.
     ```javascript
     pluginName: ["pl1", "pl2"],
     plugins: {
       pl1: {
         pluginName: "pl1",
         config: [
           ...
     ```
   * the properties' type will be used as "main" entry point for creating the config-list, e.g.
     ```typescript
       somePluginName: SomePluginConfigEntry;
       ...
     }
     export interface SomePluginConfigEntry extends MediaManagerPluginEntry {
       someConfig: string;
     }
     ```
     ->
     ```javascript
     pluginName: "somePluginName",
     config: ["someConfig"],
     ```
   * optionally, if relevant for the plugin, the SpeechConfig entry is specified by adding it as Union type:
    ```typescript
      somePluginName: SomePluginConfigEntry | SomePluginSpeechConfigEntry;
      ...
    }
    ...
    export interface SomePluginSpeechConfigEntry extends SpeechConfigPluginEntry {
      someSpeechConfig: string;
    }
    ```
    ->
    ```javascript
    pluginName: "somePluginName",
    config: ...,
    speechConfig: ["someSpeechConfig"],
    ```
    * if configuration-properties (or speech-configuration) have JSDoc `@default` values specified, they will be included in the property `defaultValues` (NOTE the default value must be `JSON.parse`'able or simple string):
     ```typescript
       somePluginName: SomePluginConfigEntry | SomePluginSpeechConfigEntry;
       ...
     }
     ...
     export interface SomePluginConfigEntry extends MediaManagerPluginEntry {
       /** @default theDefault */
       someConfig: string;
     }
     export interface SomePluginSpeechConfigEntry extends SpeechConfigPluginEntry {
       /** @default 7 */
       someSpeechNumConfig: number;
     }
     ```
     ->
     ```javascript
     pluginName: "somePluginName",
     config: [/** <js-doc> */"someConfig"],
     speechConfig: [/** <js-doc> */"someSpeechNumConfig"],
     defaultValues: { someConfig: "theDefault"},
     defaultspeechValues: { someSpeechNumConfig: 7},
     ```
 * exports other interfaces (their properties) with suffix **PluginSpeechConfigEntry** as speechConfig-property lists:  
   `export interface SomeNamePluginSpeechConfigEntry {...`
   * NOTE should extend `mmir.SpeechConfigPluginEntry`
 * exports other interfaces (their properties) with suffix **PluginConfigEntry** as config-property lists:  
   `export interface AnotherNamePluginConfigEntry {...`
   * NOTE should extend `mmir.MediaManagerPluginEntry`
 * exports enums as properties:  
   `export enum SomeName {...`
 * NOTE: protected/special property names (for properties in `<*>PluginConfigEntry` and `<*>PluginSpeechConfigEntry`)
   * `mod`: module name for the configuration entry of `MediaManager.plugins.env`
   * `ctx`: the (optional) context for the configuration entry of `MediaManager.plugins.env`
   * `config`: the custom plugin-configuration for the configuration entry of `MediaManager.plugins.env`

NOTE all interfaces etc. must be defined in the root of `config.d.ts`


In addition, if it exists, 'pluginexport' parses the build-configuration file `build-config.ts` and collects all `export`ed
variables of type `AppConfig` (type from module `mmir-tooling`) into a list and stores it into field `buildConfigs`.

For example:
   ```typescript
   import { AppConfig } from 'mmir-tooling';
   export const buildConfig: AppConfig = {
     states: {
       models: {
         myStateModel: {
           moduleId: 'mmirf/myCustomStateModel',
           file: __dirname + '/states/my-model.xml'
         },
         myOtherModel: {
           moduleId: 'mmirf/otherCustomStateModel',
           file: __dirname + '/states/my-other-model.xml'
         },
       }
     }
   };
   ```
   ->
   ```javascript
   buildConfigs: [
     {
       states: {
         models: {
           myStateModel: {
             moduleId: 'mmirf/myCustomStateModel',
             file: __dirname + '/states/my-model.xml'
           },
           myOtherModel: {
             moduleId: 'mmirf/otherCustomStateModel',
             file: __dirname + '/states/my-other-model.xml'
           },
         }
       }
     }
   ]
   ```

NOTE 1: build-configuration parsing only considers `AppConfig` variables that are immediately initialized.

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
