
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
