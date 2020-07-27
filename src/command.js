const fs = require('fs-extra');
const ios = require('./ios');
const android = require('./android');
const logger = require('./logger');
const config = require('./config');
const { endWith } = require('./utils');
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

function updatePackageJson(dest, cordovaIosVersion, cordovaAndroidVersion) {
    const projectDir = dest;
    const packageJsonPath = `${projectDir}package.json`;
    const packageJson = fs.existsSync(packageJsonPath) ? require(packageJsonPath): {};
    const data = fs.readFileSync(projectDir +  'config.xml').toString();
    const config = et.parse(data);
    packageJson.name = packageJson.name ||config.getroot().attrib['id'];
    packageJson.displayName = packageJson.displayName || config.findtext('./name');
    packageJson.description = packageJson.description || config.findtext('./description');
    packageJson.version = packageJson.version || config.getroot().attrib['version'];
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.dependencies['cordova-ios'] = packageJson.dependencies['cordova-ios'] || cordovaIosVersion;
    packageJson.dependencies['cordova-android'] = packageJson.dependencies['cordova-android'] || cordovaAndroidVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}


module.exports = {
    build: async function (args) {
        setupBuildDirectory(args.src, args.dest);
        updatePackageJson(args.dest, args.cordovaIosVersion, args.cordovaAndroidVersion);
        config.src = args.dest;
        config.outputDirectory = config.src + 'output/';
        fs.mkdirSync(config.outputDirectory, {recursive: true});
        config.logDirectory = config.outputDirectory + 'logs/';
        fs.mkdirSync(config.logDirectory, {recursive: true});
        logger.setLogDirectory(config.logDirectory);


        if (args.platform === 'android') {
            const result = await android.build({
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
        } else if (args.platform ==='ios') {
            const result = await ios.build({
                cordovaIosVersion: args.cordovaIosVersion,
                projectDir: args.dest,
                certificate: args.iCertificate,
                certificatePassword: args.iCertificatePassword,
                provisionalFile: args.iProvisioningFile,
                packageType: args.packageType});
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