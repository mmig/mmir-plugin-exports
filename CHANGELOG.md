
# Version 2.5.2

Changes for `pluginexport` script:
 * BUGFIX for _getBuildConfigTemplate(): must not use duplicates-map when joining dependency build-configs (since retrieving did already exclude duplicates & did update the dependency map)
 * MODIFICATION (interal) for _joinTemplate(): changed to more common merge signature `_join(source, target)` -> `_join(target, source)`

# Version 2.5.1

Changes for `createplugincompat` script:
  * BUGFIX for compat-wrapper: fix injected implementation for mmir.conf.get(propertyName, defaultValue, setDefaultIfUnset)
    * properly retrieve value and set as default if unset (and setDefaultIfUnset is TRUTHY)
    * if propertyName is an Array, do use copy since older mmir-lib version will modify the array

# Version 2.5.0

Changes for `createplugincompat` script:
  * FEATURE support compatibility module creation for `mmir-lib` v7.x and `mmir-plugin-encoder-core` v1.x
  * FEATURE added `type` `"none"` and field `template` for specifying custom template files when creating compatibility modules (see README.md)
  * FEATURE support for additional optional field `async` (for types other than `media`; `media` already is wrapped in async-require)
  * FEATURE support for additional optional field `dependencyMapping` for replacing dependencies (in plugin's `define` statement)
  * FEATURE support for additional optional field `additionalDependencies` for specifying additional dependencies (in plugin's `define` statement)

Changes for `dtsdownlevel` script:
  * BUGFIX fixed emitted package.json entry: donwleveling for <3.9 (instead of <3.8)

# Version 2.4.0

Changes for `updateversion` script:
 * FEATURE: support (multi-)option `--regexp-target <file>` for multiple regular-expression target files in option
            (options `--version-regexp` and `--replace-pattern` can also take multiple values)
  * BUGFIX for regexp parser: correctly calculate match length (before was missing last matched character)

Changes for XML modifier util:
 * FEATURE: support finding positions for TAGs in XML files (before only combination of TAG and ATTRIBUTE was supported)  
            NOTE only supported via (default) `sax-wasm` parser, no support for (optional) `saxes` parser

# Version 2.3.4

Changes for `pluginexport` script:
 * FEATURE: support / convert 2nd parameter for getBuildConfig() to duplicate dictionary if it is an array
 * BUGFIX for _getBuildConfigTemplate(): must OR-operator (||) instead of logical OR (|)

# Version 2.3.3

Changes for `pluginexport` script:
 * BUGFIX do allow type `any` for plugin-config main entry/ies

# Version 2.3.2

Changes for `pluginexport` script:
 * BUGFIX avoid duplicate generation of un-specific build-config in case of single plugin (i.e. not multiple plugins) defined

# Version 2.3.1

Changes for `pluginexport` script:
 * BUGFIX guard access to buildPluginNames

# Version 2.3.0

Changes for `updateversion` script:
 * FEATURE: support placeholder `§VERSION§` in option `--version-regexp` for matching (semantic) version strings
 * BUGFIX: for `regexp` correctly support option `{onlyFirst: false}`

Changes for `pluginexport` script:
 * FEATURE: do support build-config definitions for multiple plugins

# Version 2.2.3

Changes for `pluginexport` script:
 * FIX: automatically include default build-config file `module-config.gen.js`,
        if no override is defined in package.json

# Version 2.2.2

Changes for `dtsdownlevel` script:
 * support option `to`: target `typescript` version for down-leveling (default: 3.4.0)
 * BUGFIX: correctly invoke `downlevel-dts.main()` with targted typescript version


# Version 2.2.1

 * updated dependencies
 * migrated `sax-wasm` from 1.x to 2.x

# Version 2.2.0 (unpublished)

Changes for `pluginexport` script (`config-gen.js`):
 * support dynamic build-config definitions (by using a creator function, see README exampel with `PluginExportBuildConfigCreator`)
 * BUGFIX: correctly add all config options for union types in interface definitions
           (before, only options for first type was added)

# Version 2.1.1

Changes for `updateversion` script:
 * BUGFIX: use correct end-position for matches in regexp-parser

# Version 2.1.0

Changes for `updateversion` script:
 * FIX: do only list files as unchanged, if they really exists
 * IMPROVE: support aborting traversing json-data for firstOnly upon first match
 * FEATURE: added support for multiple input files / directories
 * FEATURE: added support for regexp-based replacement of version number in arbitrary text files

# Version 2.0.0

**BREAKING CHANGE:**  
since version 2.0.0-rc.1 to the _meaning_ of the `dtsdownlevel` source- and target-directory
have been switched:

 * in versions before 2.0.0:
   the source-directory contained the backwards compatible "downleved" typings, and the
   target-directory (by default `ts3.6/`) contains the (original) typings for
   more recent `typescript` versions

 * since 2.0.0-rc.1:
   the source-directory contains the (original) typings for more recent
   `typescript` versions, and the target-directory (by default `ts3.6/`)
   contains the backwards compatible "downleved" typings

When running the `dtsdownlevel` script, it will print the recommended configuration
for the `package.json` compatibility entry to the console, i.e. this has changed
with version 2.0.0-rc.1 correspondingly:  
for upgrading to `mmir-plugin-export` change the `package.json` entry `typesVersions`
accoriding to the information printed to the console when running the script.


CHANGES:

 * added `updateversion` tool/script for updating the version field/attribute
   in `npm` and `cordova` configuration files without reformatting the files
