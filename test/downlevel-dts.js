// Based on web-streams-polyfill/build/downlevel-dts (MIT licensed) by Mattias Buelens, Diwank Singh Tomer
// https://github.com/MattiasBuelens/web-streams-polyfill/blob/57d83d0372428532fab83f8d252a5aad950892da/build/downlevel-dts.js
// Based on downlevel-dts (MIT licensed) by Nathan Shively-Sanders
// https://github.com/sandersn/downlevel-dts/blob/e7d1cb5aced5686826fe8aac4d4af2f745a9ef60/index.js

// IMPORTANT this script requires ts-morph version >= 6 < 7

/* eslint-env node */

const {Project, ts} = require("ts-morph")
const path = require("path")
const os = require("os")
const fs = require("fs-extra")
const futil = require("./file-utils")

function dtsDownlevel(dtsInputDir, outputDirName) {

  const inputPath = path.resolve(dtsInputDir)
  const project = new Project()
  const inputDir = project.addDirectoryAtPath(inputPath)

  const outDir = path.resolve(inputDir.getPath().toString(), outputDirName);
  fs.removeSync(outDir)

  const tmpDir = createTempDir()
  fs.copySync(inputPath, tmpDir, {filter: function(src){
    if(futil.isDirectory(src) || /\.d\.ts$/i.test(src)){
      return true
    }
    return false
  }});
  if(process.env.verbose) console.log('    copied unmodified dts files to temporary dir '+tmpDir)

  processProjectDir(inputDir)

  const dirs = inputDir.getDirectories()
  for(const d of dirs){
    const inDir = path.resolve(d.getPath().toString())
    if(process.env.verbose) console.log('    processing dts-downlevel src-dir '+inDir+'...')
    processProjectDir(d);
  }
  project.saveSync()

  fs.moveSync(tmpDir, outDir)
  if(process.env.verbose) console.log('    moved unmodified dts files from temporary dir to '+outDir)
}

function createTempDir(){
  const tmpDir = os.tmpdir();
  return fs.mkdtempSync(`${tmpDir}${path.sep}`)
}


function processProjectDir(inputDir) {

  // Down-level all *.d.ts files in input directory
  const files = inputDir.addSourceFilesAtPaths("*.d.ts")
  for (const f of files) {
    if(process.env.verbose) console.log('      processing dts file '+f.getFilePath()+'...')
    downlevelTS38(f)
    downlevelTS36(f)
    downlevelTS34(f)
    // Original file will be overwritten by down-leveled file when saved
  }
}


/**
 * Down-level TypeScript 3.8 types in the given source file
 */
function downlevelTS38(f) {
  // convert "import type" to "import"

  //FIXME ts-morph does not return "import type" statements, only "import" statements for these
  //      -> when this is fixed, should use these, then filter imp.isTypeOnly() and change via imp.setIsTypeOnly(false)
  // const imps = f.getImportDeclarations();
  // const imps = f.getDescendantsOfKind(ts.SyntaxKind.ImportDeclaration);
  // for (const imp of imps) {
    // if(imp.isTypeOnly()) imp.setIsTypeOnly(false);
  // }

  const imps = f.getDescendantsOfKind(ts.SyntaxKind.ImportEqualsDeclaration);
  if(!imps || imps.length === 0){
    return;
  }

  //HACK ts-morph does not return "import type" when querying f.getDescendantsOfKind(ts.SyntaxKind.ImportDeclaration)
  //     AND the structure for "import type" is plain text
  //QUICK FIX "hard code" the transformation by rewriting the strings in the returned structure statement property
  // console.log(imp.print())
  // imp.replaceWithText('import')
  const imp = imps[0];//<- take only the first one (the HACK will process all in the file)
  // console.log(f.getFilePath(), imp.getText(), imp.getParent().getStructure())
  if(imp.getParent().getStructure().statements){
    var p = imp.getParent();
    var str = imp.getParent().getStructure();
    //NOTE: if the string statements are not collected, they get later joined with new-lines, so collect them now manually and join with space char
    var conv = {};
    var i = 0;
    var isActive = false;
    str.statements = str.statements.filter(function(s){
      if(typeof s === 'string'){
        var isType = /^\s*import\s+type\s*$/.test(s);
        if(isType && isActive){
          ++i;
        }
        var sb = conv[i] || [];
        if(!conv[i]){
          conv[i] = sb;
          isActive = false;
        }
        sb.push(isType? 'import' : s);//convert "import type" to "import"
        if(!isActive){
          isActive = true;
          return true;
        }
        return false;
      }
      return true;
    });
    i = 0;
    str.statements = str.statements.map(function(s){
      return typeof s === 'string'? conv[i++].join(' ') : s;
    });
    // console.log(str.statements)
    p.set(str);
  }
}


/**
 * Down-level TypeScript 3.6 types in the given source file
 */
function downlevelTS36(f) {
  // Replace get/set accessors with (read-only) properties
  const gs = f.getDescendantsOfKind(ts.SyntaxKind.GetAccessor)
  for (const g of gs) {
    const comment = getLeadingComments(g)
    const s = g.getSetAccessor()
    const returnTypeNode = g.getReturnTypeNode()
    const returnType = returnTypeNode ? returnTypeNode.getText() : "any"
    g.replaceWithText(
      `${comment}${getModifiersText(g)}${
        s ? "" : "readonly "
      }${g.getName()}: ${returnType};`,
    )
    if (s) {
      s.remove()
    }
  }
  const ss = f.getDescendantsOfKind(ts.SyntaxKind.SetAccessor)
  for (const s of ss) {
    const g = s.getGetAccessor()
    if (!g) {
      const comment = getLeadingComments(s)
      const firstParam = s.getParameters()[0]
      const firstParamTypeNode = firstParam && firstParam.getTypeNode()
      const firstParamType = firstParamTypeNode
        ? firstParamTypeNode.getText()
        : "any"
      s.replaceWithText(
        `${comment}${getModifiersText(s)}${s.getName()}: ${firstParamType};`,
      )
    }
  }
}

/**
 * Down-level TypeScript 3.4 types in the given source file
 */
function downlevelTS34(f) {
  // Replace "es2018.asynciterable" with "esnext.asynciterable" in lib references
  const refs = f.getLibReferenceDirectives()
  for (const r of refs) {
    if (r.getFileName() === "es2018.asynciterable") {
      f.replaceText([r.getPos(), r.getEnd()], "esnext.asynciterable")
    }
  }
  downlevelEs2018(f)
}

/**
 * Down-level es2018 to esnext library in the given source file
 */
function downlevelEs2018(f) {
  // Replace AsyncIterator<T1,T2> with AsyncIterator<T1>
  const typeParams = f.getDescendantsOfKind(ts.SyntaxKind.TypeReference)
  for (const t of typeParams) {
    if (t.wasForgotten()) {
      continue
    }
    const typeName = t.getTypeName().getText()
    if (typeName === "AsyncIterator") {
      const params = t.getTypeArguments()
      if (params.length > 1) {
        t.replaceWithText(`${typeName}<${params[0].getText()}>`)
      }
    }
  }
}

function getModifiersText(node) {
  const modifiersText = node
    .getModifiers()
    .map(m => m.getText())
    .join(" ")
  return modifiersText.length > 0 ? modifiersText + " " : ""
}

function getLeadingComments(node) {
  const t = node.getText()
  const tlen = t.length
  const ct = node.getText(true)
  const ctlen = ct.length
  // if no comment, or comment not leading, return empty string:
  if (tlen === ctlen || ct.indexOf(t) !== ctlen - tlen) {
    return ""
  }
  // remove indentation (execept 1 space for "stars-aligning") of comment lines,
  // since they will be re-indented on insertion
  // (and remove all leading whitespaces from non-comment lines)
  return ct
    .replace(t, "")
    .replace(/(\r?\n)\s+ /gm, "$1 ")
    .replace(/(\r?\n)\s+$/gm, "$1")
}

module.exports = {
  dtsDownlevel: dtsDownlevel
}
