const fs = require('fs');
const logger = require('./logger');
const {
    exec
} = require('./exec');
const loggerLabel = 'cordova-cli-requirements';
const semver = require('semver');
const prompt = require('prompt');

const VERSIONS = {
    'NODE': '12.0.0',
    'JAVA': '1.8.0',
    'GRADLE': '6.0.1'
}

async function checkAvailability(cmd) {
    try {
        let version = (await exec(cmd, ['--version'])).join('');

        // to just return version in x.x.x format
        version = version.match(/[0-9\.]+/)[0];

        logger.info({
            'label': loggerLabel,
            'message': cmd + ' version available is ' + version
        })
        const requiredVersion = VERSIONS[cmd.toUpperCase()];
        if (requiredVersion && semver.lt(version, requiredVersion)) {
            logger.error('Minimum ' + cmd + ' version required is ' + requiredVersion + '. Please update the version.');
            return false;
        }
        return version;
    } catch(e) {
        console.error(e);
        return false;
    }
}

module.exports = {
    showConfirmation: async (message) => {
        return new Promise((resolve, reject) => {
            prompt.get({
                properties: {
                    confirm: {
                        pattern: /^(yes|no|y|n)$/gi,
                        description: message,
                        message: 'Type yes/no',
                        required: true,
                        default: 'no'
                    }
                }
            }, function (err, result) {
                if (err) {
                    reject();
                }
                resolve(result.confirm.toLowerCase());  
            });
        });
    },
    checkForGradleAvailability: async () => {
        return await checkAvailability('gradle');
    },
    checkForAndroidStudioAvailability: async () => {
        // ANDROID_HOME environment variable is set or not. If it is set checking if its a valid path or no.
        const ANDROID_HOME = process.env['ANDROID_HOME'];
        const ANDROID_SDK_ROOT = process.env['ANDROID_SDK_ROOT']
        if (ANDROID_HOME && !ANDROID_SDK_ROOT) {
            logger.warn({
                'label': loggerLabel,
                'message': 'ANDROID_HOME is deprecated. Recommended to set ANDROID_SDK_ROOT'
            });
        }
        envVariable = ANDROID_SDK_ROOT || ANDROID_HOME;
        if (!envVariable) {
            logger.error({
                'label': loggerLabel,
                'message': 'Failed to find \'ANDROID_SDK_ROOT\' environment variable. Try setting it manually.\n' +
                'Try update your \'PATH\' to include path to valid SDK directory.'});
            return false;
        }
        if (!fs.existsSync(envVariable)) {
            logger.error({
                'label': loggerLabel,
                'message': '\'ANDROID_HOME\' environment variable is set to non-existent path: ' + process.env['ANDROID_HOME'] +
                '\nTry update it manually to point to valid SDK directory.'});
            return false;
        }
        const sdkPath = envVariable + '/tools/bin/sdkmanager';

        if (!fs.existsSync(sdkPath)) {
            logger.error({
                'label': loggerLabel,
                'message': 'Failed to find \'android-sdk\' in your \'PATH\'. Install Android-Studio before proceeding to build.'});
            return false;
        }
        logger.info({
            'label': loggerLabel,
            'message': 'Found Android SDK manager at ' + sdkPath
        })

        try {
            await exec('sdkmanager', ['--list']); 
        } catch(e) {
            console.error(e);
            return false;
        }
        return true;
    },
    hasValidJavaVersion: async () => {
        const javaVersion = (await exec('java', ['-version'])).join('').match(/[0-9\.]+/)[0];

        if (semver.lt(javaVersion, VERSIONS.JAVA)) {
            logger.error('Minimum java version required is' + VERSIONS.JAVA + '. Please update the java version.');
            return false;
        }

        const envVariable = process.env['JAVA_HOME']; 

        if (!envVariable) {
            logger.error({
                'label': loggerLabel,
                'message': 'Failed to find \'JAVA_HOME\' environment variable. Try setting it manually.\n' +
                'Try update your \'PATH\' to include path to valid directory.'});
            return false;
        }
        return true;
    }, 
    hasValidNodeVersion: async () => {
        return await checkAvailability('node');
    }, 
    isGitInstalled: async () => {
        return await checkAvailability('git');
    },

    // TODO: cocoapod for ios

    validate: (keyStore, storePassword, keyAlias, keyPassword) => {
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
    }
}