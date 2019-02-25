
const fs = require('fs');
// const path = require('path');
const ts = require('typescript');

//const code = "type EinType = string;\n\n/** ein KOmmentar\n mit zwei Zeilen */\ninterface EineKlasse{ \n/** ein kommentar für das feld */\nfeld: EinType; }"
var file = 'D:/git_repo/mmir-plugin-speech-android/config.d.ts';
var code = fs.readFileSync(file, 'utf8');
const sc = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true);

const exportedTypes = new Set(['PropertySignature', 'InterfaceDeclaration', 'EnumDeclaration', 'EnumMember', 'UnionType']);

const text = sc.text;

function getDoc(node, indent){
	if(node.jsDoc){
		var reindent = new Array(indent).join(' ');
		return node.jsDoc.map(function(entry){
			return text.substring(entry.pos, entry.end).replace(/^\s*\/\*/, '\n' + reindent+'/*').replace(/(\r?\n)\s*\*/g, '$1' + reindent+' *');
		}).join('\n');
	}
	return '';
}

function getDocTags(node, includeComentText){
	if(node.jsDoc){
		return node.jsDoc.map(function(entry){
			var txt = '';
			if(includeComentText && entry.comment){
				txt += entry.comment;
			}
			if(entry.tags){
				console.log('      ', entry.tags);//DEBUG
				txt += entry.tags.map(function(t){return '[@'+ t.tagName.escapedText + ': ' + getTypeString(t) + ']' }).join(', ');
			}
			return txt;
		}).join(', \t');
	}
	return '';
}

function getTypeString(tag){
	if(tag.typeExpression){
		return tag.typeExpression.type.getText();
	}
	return tag.comment;
}

function getInterface(node){
	if(ts.SyntaxKind[node.kind] !== 'InterfaceDeclaration'){
		//TODO must also be public!
		return '';
	}
	return ' -> ' + node.name.getText() + ' ';
}


function getProperty(node){
	if(ts.SyntaxKind[node.kind] !== 'PropertySignature'){
		return '';
	}
	return ' -> ' + node.name.getText() + ' : ' + node.type.getText() + ' ';
}

function getEnum(node){
	if(ts.SyntaxKind[node.kind] !== 'EnumDeclaration'){
		//TODO must also be public!
		return '';
	}
	return ' -> ' + node.name.getText() + ' ';
}

function getEnumValue(node){
	if(ts.SyntaxKind[node.kind] !== 'EnumMember'){
		return '';
	}
	return ' -> ' + node.name.getText() + (node.initializer? ' : ' + node.initializer.getText() : '') + ' ';
}

let indent = 0;
function print(node) {
	// var docs = (node.jsDoc? '\t\t ######## js-doc: '+(node.jsDoc[0].comment? node.jsDoc[0].comment.replace(/\r?\n/g, ' ') : '') + ' ' : '');
	// var tags = node.jsDoc && node.jsDoc[0].tags? node.jsDoc[0].tags.map(function(t){return '[@'+ t.tagName.escapedText + ': ' + t.comment + ']' }).join(', ') : '';
	// if(node.jsDoc){
		// console.log(node.jsDoc[0].tags)
	// }
		var additionalText = getInterface(node) || getProperty(node) || getEnum(node) || getEnumValue(node);
		additionalText += ' \t ' + getDocTags(node, false);
    console.log(new Array(indent + 1).join(' ') + ts.SyntaxKind[node.kind] + additionalText + getDoc(node, indent + 10));//docs + tags);
    indent++;
    ts.forEachChild(node, print);
    indent--;
}

print(sc);
// console.log(sc)
var printAll = function(n){
	if(exportedTypes.has(ts.SyntaxKind[n.kind])){
		console.log('\n--------'+ts.SyntaxKind[n.kind]+'--------\n', n);
	}
	ts.forEachChild(n, printAll)
};
ts.forEachChild(sc, printAll)
