const fs = require('fs');
const endWith = (str, suffix) => {
    if (!str.endsWith(suffix)) {
        return str += suffix;
    }
    return str;
};

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
    isDirectory: isDirectory
};