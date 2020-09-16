const fs = require('fs-extra');
const ios = require('./ios');
const android = require('./android');
const logger = require('./logger');
const config = require('./config');
const {
    endWith
} = require('./utils');
const {
    exec
} = require('./exec');
const et = require('elementtree');
const path = require('path');
const npmCache = require('./npm-cache');
const { showConfirmation } = require('./requirements');

const loggerLabel = 'wm-cordova-cli';

logger.info('adsfasf');

const PHONEGAP_CLI = {
    'cli-9.0.0' : ['9.0.0', '8.0.0', '5.1.1'],
    'cli-8.1.1' : ['8.1.1', '7.1.2', '4.5.5'],
    'cli-8.0.0' : ['8.0.0', '7.0.0', '4.5.4']
};

async function setupBuildDirectory(src, dest) {
    const target = dest;
    if (fs.existsSync(target)) {
        if (fs.readdirSync(target).length) {
            const response = await showConfirmation('Would you like to empty the dest folder (i.e. ' + dest + ') ?');
            if (response !== 'y' && response !== 'yes') {
                return false;
            }
            fs.removeSync(target);
        }
    }
    fs.mkdirsSync(target);
    fs.copySync(src, dest);
}

function getFileSize(path) {
    const stats = path && fs.statSync(path);
    return (stats && stats['size']) || 0;
}

async function updatePackageJson(dest, cordovaVersion, cordovaIosVersion, cordovaAndroidVersion) {
    const projectDir = dest;
    const packageJsonPath = `${projectDir}package.json`;
    const packageJson = fs.existsSync(packageJsonPath) ? require(packageJsonPath) : {};
    let data = fs.readFileSync(projectDir + 'config.xml').toString();
    const config = et.parse(data);
    packageJson.name = packageJson.name || config.getroot().attrib['id'];
    packageJson.displayName = packageJson.displayName || config.findtext('./name');
    packageJson.description = packageJson.description || config.findtext('./description');
    packageJson.version = packageJson.version || config.getroot().attrib['version'];
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.devDependencies = packageJson.devDependencies || {};
    if (cordovaVersion) {
        packageJson.dependencies['cordova'] = cordovaVersion;
    }
    packageJson.dependencies['cordova-ios'] = packageJson.dependencies['cordova-ios'] || cordovaIosVersion;
    packageJson.dependencies['cordova-android'] = packageJson.dependencies['cordova-android'] || cordovaAndroidVersion;
    await Promise.all(config.findall('./plugin').map(e => {
        return Promise.resolve().then(() => {
            const name = e.attrib['name'];
            let spec = e.attrib['spec'];
            if (spec.startsWith('http')) {
                return npmCache.get(name, spec).then(cache => {
                    if (spec != cache) {
                        data = data.replace(spec, cache);
                    }
                });
            }
        });
    }));
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    fs.writeFileSync(projectDir + 'config.xml', data);
}

function setPreferences(projectDir, args) {
    let data = fs.readFileSync(projectDir + 'config.xml').toString();
    const config = et.parse(data);
    const preferences = config.findall('./preference');
    const preferenceValue = (pName) => {
        const sp = preferences.find(p => p.attrib['name'] === pName);
        return sp && sp.attrib['value'];
    };
    const phonegapCli = PHONEGAP_CLI[preferenceValue('phonegap-version')] || [];
    args.cordovaVersion = args.cordovaVersion || args.cv || preferenceValue('wm-cordova') || phonegapCli[0];
    args.cordovaAndroidVersion = args.cordovaAndroidVersion || args.cav ||preferenceValue('wm-cordova-android') || phonegapCli[1];
    args.cordovaIosVersion = args.cordovaIosVersion || args.civ ||preferenceValue('wm-cordova-ios') || phonegapCli[2];
}


module.exports = {
    build: async function (args) {
        try {
            let folderName = args.src.split('/').pop();
            const isZipFile = folderName.endsWith('.zip');

            folderName = isZipFile ? folderName.replace('.zip', '') : folderName;

            const tmp = `${require('os').homedir()}/.wm-cordova-cli/build/${folderName}/${Date.now()}`;

            if (args.src.endsWith('.zip')) {
                const zipFile = args.src;
                args.src = tmp + '/src';
                await exec('unzip', [
                    '-o',
                    zipFile,
                    '-d',
                    args.src
                ])
            }
            args.src = path.resolve(args.src) + '/';
            args.dest = path.resolve(args.dest || `${tmp}/build-${args.platform}`) + '/';
            await setupBuildDirectory(args.src, args.dest);
            setPreferences(args.dest, args);
            await updatePackageJson(args.dest, args.cordovaVersion, args.cordovaIosVersion, args.cordovaAndroidVersion);
            config.src = args.dest;
            config.outputDirectory = config.src + 'output/';
            fs.mkdirSync(config.outputDirectory, {
                recursive: true
            });
            config.logDirectory = config.outputDirectory + 'logs/';
            fs.mkdirSync(config.logDirectory, {
                recursive: true
            });
            logger.setLogDirectory(config.logDirectory);
            const cordovaToUse = args.cordovaVersion ? config.src + 'node_modules/cordova/bin/cordova' : 'cordova';
            const cordovaVersion = args.cordovaVersion || (await exec('cordova', ['--version'])).join('').match(/[0-9][0-9\.]+/)[0];
            await exec('npm', ['install'], {
                cwd: config.src
            });
            let result = {
                success: false
            };
            if (args.platform === 'android') {
                result = await android.build({
                    cordova: cordovaToUse,
                    cordovaVersion: cordovaVersion,
                    cordovaAndroidVersion: args.cordovaAndroidVersion,
                    projectDir: args.dest,
                    keyStore: args.aKeyStore,
                    storePassword: args.aStorePassword,
                    keyAlias: args.aKeyAlias,
                    keyPassword: args.aKeyPassword,
                    packageType: args.packageType
                });
            } else if (args.platform === 'ios') {
                result = await ios.build({
                    cordova: cordovaToUse,
                    cordovaVersion: cordovaVersion,
                    cordovaIosVersion: args.cordovaIosVersion,
                    projectDir: args.dest,
                    certificate: args.iCertificate,
                    certificatePassword: args.iCertificatePassword,
                    provisionalFile: args.iProvisioningFile,
                    packageType: args.packageType
                });
            }
            if (result.errors && result.errors.length) {
                logger.error({
                    label: loggerLabel,
                    message: args.platform + ' build failed due to: \n\t' + result.errors.join('\n\t')
                });
            } else if (!result.success) {
                logger.error({
                    label: loggerLabel,
                    message: args.platform + ' BUILD FAILED'
                });
            } else {
                logger.info({
                    label: loggerLabel,
                    message: `${args.platform} BUILD SUCCEEDED. check the file at : ${result.output}.`
                });
                logger.info({
                    label: loggerLabel,
                    message: `File size : ${Math.round(getFileSize(result.output) * 100 / (1024 * 1024)) / 100} MB.`
                });
            }
            return result;
        } catch (e) {
            logger.error({
                label: loggerLabel,
                message: args.platform + ' BUILD Failed. Due to :' + e
            });
            console.error(e);
            return { success : false };
        }
    }
};