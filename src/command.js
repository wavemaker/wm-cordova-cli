const fs = require('fs-extra');
const ios = require('./ios');
const android = require('./android');
const logger = require('./logger');
const config = require('./config');
const semver = require('semver');
const {
    exec
} = require('./exec');
const execa = require('execa');
const et = require('elementtree');
const path = require('path');
const npmCache = require('./npm-cache');
const { showConfirmation } = require('./requirements');
const { isDirectory, readAndReplaceFileContent } = require('./utils');

const loggerLabel = 'wm-cordova-cli';

const PHONEGAP_CLI = {
    'cli-9.0.0' : ['9.0.0', '8.0.0', '5.1.1'],
    'cli-8.1.1' : ['8.1.1', '7.1.2', '4.5.5'],
    'cli-8.0.0' : ['8.0.0', '7.0.0', '4.5.4']
};

async function setupBuildDirectory(src, dest) {
    const target = dest;
    if (fs.existsSync(target)) {
        if (fs.readdirSync(target).length) {
            const response = await showConfirmation('Would you like to empty the dest folder (i.e. ' + dest + ') (yes/no) ?');
            if (response !== 'y' && response !== 'yes') {
                process.exit();
            }
            // using removeSync when target is directory and unlinkSync works when target is file.
            const fsStat = fs.lstatSync(target);
            if (fsStat.isDirectory()) {
                fs.removeSync(target);
            } else if (fsStat.isFile()) {
                fs.unlinkSync(target);
            }
        }
    }
    fs.mkdirsSync(target);
    fs.copySync(src, dest);
}

function getFileSize(path) {
    const stats = path && fs.statSync(path);
    return (stats && stats['size']) || 0;
}

const extractZip = async(zip, dest) => {
    return execa('unzip', [
        '-o',
        zip,
        '-d',
        dest
    ], {
        stdio: process.stdio
    });
};

const findRootPackage = (d) => {
    var rootPackage = null;
    if (fs.statSync(d).isDirectory()) {
        if (fs.existsSync(d + 'package.json')) {
            return d;
        }
        fs.readdirSync(d).find(c => {
            rootPackage = findRootPackage(d + c + '/');
            return !!rootPackage;
        });
    }
    return rootPackage;
};

async function updateConfigXML(projectDir) {
    await readAndReplaceFileContent(`${projectDir}/config.xml`, c => {
        // To fix Camera issues in Android 13
        c = c.replace('<platform name="android">', `
        <platform name="android">
            <hook type="before_prepare" src="camera_7.0.0_upgrade_hooks/use-camera-plugin-7.0.0.js" />
            <hook type="before_compile" src="camera_7.0.0_upgrade_hooks/remove-duplicate-file-permissions.js" />
        `);
        c = c.replace(/<plugin\s+name="wm-cordova-plugin-filepicker"\s+spec="1.0.6"\/>/, 
            '<plugin name="wm-cordova-plugin-filepicker" spec="1.0.7"/>');
        return c;
    });
    fs.copySync(`${__dirname}/../patches/camera_7.0.0_upgrade_hooks`, `${projectDir}/camera_7.0.0_upgrade_hooks`);
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
    packageJson.version = (() => {
        const splits = packageJson.version.split('.');
        return ['0', '0', '0'].map((v, i) => splits[i] || v).join('.'); 
    })();
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
                        if (cache.startsWith('file://')) {
                            cache = cache.replace('file://', '');
                            cache = path.relative(dest, cache);
                        }
                        data = data.replace(spec, cache);
                    }
                });
            } else if(spec.endsWith('.zip')) {
                const extractFolder = dest + 'cordova-plugins/' + name + '/';
                fs.mkdirSync(extractFolder, {
                    recursive: true
                });
                // this pluginFolder contains all the plugin zip files
                let pluginsFolder = dest;
                if (!fs.existsSync(pluginsFolder + spec)) {
                    // fallback to previous implementation
                    if (fs.existsSync(dest + 'www/cordova-plugins/')) {
                        pluginsFolder = dest + 'www/cordova-plugins/';
                    }
                    if (!fs.existsSync(pluginsFolder + spec)) {
                        return Promise.reject('Plugin zip ' + pluginsFolder + spec + ' is not found.');
                    }
                }

                return extractZip(pluginsFolder + spec, extractFolder)
                    .then(() => {
                        data = data.replace(spec, findRootPackage(extractFolder));
                    });
            }
        });
    }));
    if (fs.existsSync(dest + 'www/cordova-plugins')) {
        await exec('rm', ['-rf', dest + 'www/cordova-plugins']);
    }
    if (fs.existsSync(dest + 'plugins')) {
        await exec('rm', ['-rf', dest + 'plugins']);
    }
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    fs.writeFileSync(projectDir + 'config.xml', data);
}

async function setIsAppConnectedToPreviewToFalse(projectDir) {
    const writeFn = function(content) {
        return content.replace(/\.isAppConnectedToPreview\(\)/, '.isAppConnectedToPreview() && false');
    };
    const mobileScriptDir = `${projectDir}www/wmmobile/scripts`;
    await readAndReplaceFileContent(`${mobileScriptDir}/wm-mobileloader.js`, writeFn);
    await readAndReplaceFileContent(`${mobileScriptDir}/wm-mobileloader.min.js`, writeFn);
}

async function getDefaultDestination(projectDir, platform) {
    let data = fs.readFileSync(projectDir + 'config.xml').toString();
    const config = et.parse(data);
    const id = config.getroot().attrib['id'];
    const version = config.getroot().attrib['version'];
    const path = `${require('os').homedir()}/.wm-cordova-cli/build/${id}/${version}/${platform}`;
    fs.mkdirSync(path, {
        recursive: true
    });
    let next = 1;
    if (fs.existsSync(path)) {
        next = fs.readdirSync(path).reduce((a, f) => {
            try {
                const c = parseInt(f);
                if (a <= c) {
                    return c + 1;
                }
            } catch(e) {
                //not a number
            }
            return a;
        }, next);
    }
    const dest = path + '/' + next;
    fs.mkdirSync(dest, {
        recursive: true
    });
    return dest;
}

function disableHooks(projectDir, cordovaVersion) {
    const hooksRunnerPath = projectDir + 'node_modules/cordova-lib/src/hooks/HooksRunner.js';
    let data = fs.readFileSync(hooksRunnerPath).toString();
    const usePromise = semver.gte(cordovaVersion, '9.0.0');
    const disableFn = `.fire = function(hook) { const m = hook + \' hook disabled\'; console.log(m); return ${usePromise ? 'Promise.resolve()' : 'Q(m)'};} || `;
    data = data.replace(/\.fire[\s]*=[\s]/, disableFn);
    fs.writeFileSync(hooksRunnerPath, data);
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

function readPageFile(p) {
    if (fs.existsSync(p)) {
        return encodeURIComponent(fs.readFileSync(p, "utf-8")).replace(/\s/g, '+');
    }
    return '';
}

function generatePages(src) {
    src += src.endsWith('/') ? '' : '/';
    const pagesDir = src + 'www/pages/';
    if (!fs.existsSync(pagesDir)) {
        console.warn(`No folder exists at ${pagesDir}`);
        return;
    }
    fs.readdirSync(pagesDir).forEach(p => {
        try {
            const pageDir = pagesDir + p + '/';
            if (isDirectory(pageDir)) {
                fs.writeFileSync(pageDir + 'page.min.json', JSON.stringify({
                    markup: readPageFile(pageDir + p + '.html'),
                    script: readPageFile(pageDir + p + '.js'),
                    styles: readPageFile(pageDir + p + '.css'),
                    variables: readPageFile(pageDir + p + '.variables.json') || {}
                }, null, 2));
            }
        } catch(e) {
            console.warn('exception occurred while preparing the page ' + p, e);
        }
    });
}

module.exports = {
    build: async function (args) {
        try {
            let folderName = args.src.split('/').pop();
            const isZipFile = folderName.endsWith('.zip');

            folderName = isZipFile ? folderName.replace('.zip', '') : folderName;

            const tmp = `${require('os').homedir()}/.wm-cordova-cli/temp/${folderName}/${Date.now()}`;

            if (args.src.endsWith('.zip')) {
                const zipFile = args.src;
                args.src = tmp + '/src';

                if (!fs.existsSync(args.src)) {
                    fs.mkdirsSync(args.src);
                }
        
                await exec('unzip', [
                    '-o',
                    zipFile,
                    '-d',
                    args.src
                ]);
            }
            args.src = path.resolve(args.src) + '/';
            if(!args.dest) {
            	args.dest = await getDefaultDestination(args.src, args.platform);
            }
            args.dest = path.resolve(args.dest)  + '/';
            if(args.src === args.dest) {
                logger.error({
                    label: loggerLabel,
                    message: 'source and destination folders are same. Please choose a different destination.'
                });
            }
            await setupBuildDirectory(args.src, args.dest);
            setPreferences(args.dest, args);
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
            logger.info({
                label: loggerLabel,
                message: `Building at : ${config.src}`
            });
            if (args.buildType === 'release') {
                await setIsAppConnectedToPreviewToFalse(config.src);
            }
            await updateConfigXML(args.dest);
            await updatePackageJson(args.dest, args.cordovaVersion, args.cordovaIosVersion, args.cordovaAndroidVersion);
            const cordovaToUse = args.cordovaVersion ? config.src + 'node_modules/cordova/bin/cordova' : 'cordova';
            const cordovaVersion = args.cordovaVersion || (await exec('cordova', ['--version'])).join('').match(/[0-9][0-9\.]+/)[0];
            process.env.PWD = config.src;
            await exec('npm', ['install'], {
                cwd: config.src
            });
            if (args.cordovaVersion && !args.allowHooks) {
                disableHooks(config.src, args.cordovaVersion);
            }
            let result = {
                success: false
            };
            generatePages(args.dest);
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
                    buildType: args.buildType,
                    packageType: args.packageType,
                    androidXMigrationEnabled: !args.allowHooks && args.androidXMigrationEnabled
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
                    buildType: args.buildType,
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
    },
    generatePages: generatePages
};