const fs = require('fs-extra');
const { findFile } = require('./utils');
const {
    exec
} = require('./exec');

const logger = require('./logger');
const { 
    validateForAndroid, 
    hasValidNodeVersion,
    hasValidJavaVersion,
    checkForGradleAvailability,
    isGitInstalled,
    checkForAndroidStudioAvailability
 } = require('./requirements');
const loggerLabel = 'android-build';

const buildSigningFile = (path, keyStore, storePassword, keyAlias, keyPassword, buildType, packageType) => {
    const siginingSettings = {
        keystore: keyStore,
        storePassword: storePassword,
        alias: keyAlias,
        password: keyPassword,
        packageType: packageType
    };
    const settings = {
        android : {}
    };
    settings.android[buildType] = siginingSettings;
    fs.writeFileSync(path, JSON.stringify(settings, null, 2));
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
            buildType,
            packageType,
            androidXMigrationEnabled
        } = args;
        if (buildType === 'debug' && !keyStore) {
            keyStore = __dirname + '/../defaults/android-debug.keystore';
            keyAlias = 'androiddebugkey';
            keyPassword = 'android';
            storePassword = 'android';
        }
        if (!await hasValidNodeVersion() || !await hasValidJavaVersion() || 
            !await checkForGradleAvailability() || !await isGitInstalled() ||
            !await checkForAndroidStudioAvailability()) {
            return {
                success: false
            }
        }
        const errors = validateForAndroid(keyStore, storePassword, keyAlias, keyPassword);
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
        
        // await exec('cordova', ['requirements'], {
        //     cwd: projectDir
        // });
        await exec(cordova, ['prepare', 'android', '--verbose'], {
            cwd: projectDir
        });
        const projectInfo = require(projectDir + 'package.json');
        // Android x migration should be run even when hooks are disabled
        if (androidXMigrationEnabled && fs.existsSync(`${projectDir}/plugins/cordova-plugin-androidx-adapter/apply.js`)) {
            const migrationScript = `${projectDir}/plugins/migrateToAndroidX.js`;
            fs.writeFileSync(migrationScript, 
                'require(\'./cordova-plugin-androidx-adapter/apply.js\')();');
            await exec('node', [migrationScript], {
                cwd: projectDir
            });
        }
        logger.info({
            label: loggerLabel,
            message: 'Prepared for cordova android'
        });
        const settingsPath = projectDir + '__build.json';
        buildSigningFile(
            settingsPath,
            keyStore,
            storePassword,
            keyAlias,
            keyPassword,
            buildType,
            packageType
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
        const outputFilePath = `${output}${projectInfo.displayName || projectInfo.name}(${projectInfo.version}).${buildType}.${packageType === 'bundle' ? 'aab': 'apk'}`;
        let bundlePath = null;
        if (packageType === 'bundle') {
            bundlePath = findFile(`${projectDir}platforms/android/app/build/outputs/bundle/${buildType}`, /\.aab?/);
        } else {
            bundlePath = findFile(`${projectDir}platforms/android/app/build/outputs/apk/${buildType}`, /\.apk?/);    
        }
        fs.mkdirSync(output, {recursive: true});
        fs.copyFileSync(bundlePath, outputFilePath);
        return {
            success: true,
            output: outputFilePath
        };
    }
};