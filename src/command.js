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

const loggerLabel = 'wm-cordova-cli';


function setupBuildDirectory(src, dest) {
    const target = dest;
    if (fs.existsSync(target)) {
        fs.rmdirSync(target, {
            recursive: true
        });
    }
    fs.mkdirSync(target);
    fs.copySync(src, dest);
}

function updatePackageJson(dest, cordovaVersion, cordovaIosVersion, cordovaAndroidVersion) {
    const projectDir = dest;
    const packageJsonPath = `${projectDir}package.json`;
    const packageJson = fs.existsSync(packageJsonPath) ? require(packageJsonPath) : {};
    const data = fs.readFileSync(projectDir + 'config.xml').toString();
    const config = et.parse(data);
    packageJson.name = packageJson.name || config.getroot().attrib['id'];
    packageJson.displayName = packageJson.displayName || config.findtext('./name');
    packageJson.description = packageJson.description || config.findtext('./description');
    packageJson.version = packageJson.version || config.getroot().attrib['version'];
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.devDependencies = packageJson.devDependencies || {};
    if (cordovaVersion) {
        packageJson.devDependencies['cordova'] = cordovaVersion;
    }
    packageJson.devDependencies['cordova-ios'] = packageJson.devDependencies['cordova-ios'] || cordovaIosVersion;
    packageJson.devDependencies['cordova-android'] = packageJson.devDependencies['cordova-android'] || cordovaAndroidVersion;
    /*config.findall('./plugin').forEach(e => {
        const name = e.attrib['name'];
        let spec = e.attrib['spec'];
        if (spec.startsWith('http')) {
            spec = 'git+' + spec;
        }
        packageJson.devDependencies[name] = packageJson.devDependencies[name] || spec;
    });*/
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}


module.exports = {
    build: async function (args) {
        setupBuildDirectory(args.src, args.dest);
        updatePackageJson(args.dest, args.cordovaVersion, args.cordovaIosVersion, args.cordovaAndroidVersion);
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

        await exec('npm', ['install'], {
            cwd: config.src
        });

        if (args.platform === 'android') {
            const result = await android.build({
                cordova: cordovaToUse,
                cordovaAndroidVersion: args.cordovaAndroidVersion,
                projectDir: args.dest,
                keyStore: args.aKeyStore,
                storePassword: args.aStorePassword,
                keyAlias: args.aKeyAlias,
                keyPassword: args.aKeyPassword,
                packageType: args.packageType
            });
            if (result.errors && result.errors.length) {
                logger.error({
                    label: loggerLabel,
                    message: 'Android build failed due to: \n\t' + result.errors.join('\n\t')
                });
            } else {
                logger.info({
                    label: loggerLabel,
                    message: 'Android BUILD SUCCEEDED'
                });
            }
        } else if (args.platform === 'ios') {
            const result = await ios.build({
                cordova: cordovaToUse,
                cordovaIosVersion: args.cordovaIosVersion,
                projectDir: args.dest,
                certificate: args.iCertificate,
                certificatePassword: args.iCertificatePassword,
                provisionalFile: args.iProvisioningFile,
                packageType: args.packageType
            });
            if (result.errors && result.errors.length) {
                logger.error({
                    label: loggerLabel,
                    message: 'iOS build failed due to: \n\t' + result.errors.join('\n\t')
                });
            } else {
                logger.info({
                    label: loggerLabel,
                    message: 'iOS BUILD SUCCEEDED : please check the file at :' + result.output
                });
            }
        }
    }
};