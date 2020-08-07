const fs = require('fs-extra');
const { findFile } = require('./utils');
const {
    exec
} = require('./exec');

const logger = require('./logger');
const loggerLabel = 'android-build';

const buildSigningFile = (path, keyStore, storePassword, keyAlias, keyPassword, buildType) => {
    const siginingSettings = {
        keystore: keyStore,
        storePassword: storePassword,
        alias: keyAlias,
        password: keyPassword
    };
    const settings = {
        android : {}
    };
    settings.android[buildType] = siginingSettings;
    fs.writeFileSync(path, JSON.stringify(settings, null, 2));
};

const validate = (keyStore, storePassword, keyAlias, keyPassword) => {
    let errors = [];
    if (!(keyStore && fs.existsSync(keyStore))) {
        errors.push(`keystore is required (valid file): ${keyStore}`);
    }
    if (!keyAlias) {
        errors.push('keyAlias is required.');
    }
    if (!keyPassword) {
        errors.push('keyPassword is required.');
    }
    if (!storePassword) {
        errors.push('storePassword is required.');
    }
    return errors;
};

module.exports = {
    build: async (args) => {
        let {
            cordova,
            projectDir,
            keyAlias,
            keyPassword,
            storePassword,
            keyStore,
            cordovaAndroidVersion,
            packageType
        } = args;
        if (packageType === 'development' && !keyStore) {
            keyStore = __dirname + '/../defaults/android-debug.keystore';
            keyAlias = 'androiddebugkey';
            keyPassword = 'android';
            storePassword = 'android';
        }
        const errors = validate(keyStore, storePassword, keyAlias, keyPassword);
        if (errors.length > 0) {
            return {
                success: false,
                errors: errors
            }
        }
        await exec(cordova, ['platform', 'add', `android@${cordovaAndroidVersion}`, '--verbose'], {
            cwd: projectDir
        });
        logger.info({
            label: loggerLabel,
            message: 'Added cordova android'
        });
        await exec(cordova, ['prepare', 'android', '--verbose'], {
            cwd: projectDir
        });
        const projectInfo = require(projectDir + 'package.json');
        logger.info({
            label: loggerLabel,
            message: 'Prepared for cordova android'
        });
        const settingsPath = projectDir + '__build.json';
        const buildType = packageType === 'production' ? 'release' : 'debug';
        buildSigningFile(
            settingsPath,
            keyStore,
            storePassword,
            keyAlias,
            keyPassword,
            buildType
        );
        await exec(cordova, [
            'build', 'android', '--verbose',
            '--' + buildType,
            `--buildConfig=${settingsPath}`
        ], {
            cwd: projectDir
        });
        logger.info({
            label: loggerLabel,
            message: 'build completed'
        });
        const output =  projectDir + 'output/android/';
        const outputFilePath = `${output}${projectInfo.displayName || projectInfo.name}(${projectInfo.version}).${packageType}.apk`;
        const apkPath = findFile(`${projectDir}platforms/android/app/build/outputs/apk/${packageType === 'production' ? 'release' : 'debug'}`, /\.apk?/);
        fs.mkdirSync(output, {recursive: true});
        fs.copyFileSync(apkPath, outputFilePath);
        return {
            success: true,
            output: outputFilePath
        };
    }
};