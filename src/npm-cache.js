const fs = require('fs-extra');
const execa = require('execa');
const md5 = require('md5');
const axios = require('axios');
const cacheDir =  require('os').homedir() + '/.wm-cordova-cli/npm-cache';

const getLocalPath = async (module, version, gitUrl) => {
    const folderPath = cacheDir + '/' + module + '/' + version;
    if (fs.existsSync(folderPath + '/package.json')) {
        return 'file://' + folderPath;
    }
    if (gitUrl && gitUrl.indexOf('#')) {
        return await download(gitUrl, folderPath).catch(() => gitUrl || version);
    }
    return version;

};

const download = async (gitUrl, dest) => {
    gitUrl = gitUrl.replace('.git', '');
    const splits = gitUrl.split('#');
    const downloadUrl = splits[0] + '/archive/' + splits[1] + '.zip';
    await fs.mkdirSync(dest, {
        recursive: true
    });
    return axios({
        method: 'get',
        url: downloadUrl,
        responseType: 'stream'
    }).then(response => {
        return new Promise((resolve, reject) => {
            const stream = fs.createWriteStream(dest + '/package.zip')
            response.data.pipe(stream);
            stream.on('close', resolve);
        });
    }).then(() => {
        return execa('unzip', [
            '-o',
            dest + '/package.zip',
            '-d',
            dest
        ], {
            stdio: process.stdio
        })
    }).then(() => {
        fs.removeSync(dest + '/package.zip');
        const target = fs.readdirSync(dest).find(c => {
            const d = dest + '/' + c;
            return fs.statSync(d).isDirectory() && fs.existsSync(d + '/package.json');
        });
        fs.copySync(dest + '/' + target, dest);
        fs.remove(dest + '/' + target);
        return 'file://' + dest;
    });
};

module.exports = {
    get: async (module, version) => {
        let hash = version;
        if (version.indexOf('://')) {
            hash = md5(version);
        }
        return await getLocalPath(module, hash, version);
    }
};