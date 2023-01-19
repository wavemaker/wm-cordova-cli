const fs = require('fs');
const endWith = (str, suffix) => {
    if (!str.endsWith(suffix)) {
        return str += suffix;
    }
    return str;
};

async function readAndReplaceFileContent(path, writeFn) {
    if (!fs.existsSync(path)) {
        return;
    }
    const content = fs.readFileSync(path, 'utf-8');
    return Promise.resolve().then(() => {    
        return writeFn && writeFn(content);
    }).then((modifiedContent) => {
        if (modifiedContent !== undefined && modifiedContent !== null) {
            fs.writeFileSync(path, modifiedContent);
            return modifiedContent;
        }
        return content;
    });
}

function isDirectory(path) {
    try {
        return fs.existsSync(path) && fs.lstatSync(path).isDirectory();
    } catch(e) {
        return false;
    }
}
module.exports = {
    endWith : endWith,
    findFile: (path, nameregex) => {
        const files = fs.readdirSync(path);
        const f = files.find(f => f.match(nameregex));
        return endWith(path, '/') + f;
    },
    isDirectory: isDirectory,
    readAndReplaceFileContent: readAndReplaceFileContent
};