const fs = require('fs');
const os = require('os');
const logger = require('./logger');
const {
    exec
} = require('./exec');
const loggerLabel = 'cordova-cli-requirements';
const semver = require('semver');
const prompt = require('prompt');
const VERSIONS = {
    'NODE': '10.0.0',
    'POD' : '1.9.0',
    'JAVA': '1.8.0'
}

async function checkAvailability(cmd, transformFn) {
    try {
        let output = (await exec(cmd, ['--version'])).join('');
        
        if (transformFn) {
            output = transformFn(output);	
        }	
        // to just return version in x.x.x format
        let version = output.match(/[0-9]+\.[0-9\.]+/)[0];

        logger.info({
            'label': loggerLabel,
            'message': cmd + ' version available is ' + version
        })
        const requiredVersion = VERSIONS[cmd.toUpperCase()];
        version = semver.coerce(version).version;
        if (requiredVersion && semver.lt(version, requiredVersion)) {
            logger.error('Minimum ' + cmd + ' version required is ' + requiredVersion + '. Please update the version.');
            return false;
        }
        return version;
    } catch(e) {
        console.error(e);
        logger.error('Observing error while checking ' + cmd.toUpperCase() + ' availability');
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
        return await checkAvailability('gradle', o => o && o.substring(o.indexOf('Gradle')) );
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
        let sdkPath = envVariable + '/tools/bin/sdkmanager';

        // file extension has to be added for windows os for existsSync to work.
        sdkPath = os.type().includes('Windows') ? sdkPath + '.bat' : sdkPath;

        if (fs.existsSync(sdkPath)) {
            logger.info({
                'label': loggerLabel,
                'message': 'Found Android SDK manager at ' + sdkPath
            });
            try {
                await exec(sdkPath, ['--list']); 
            } catch(e) {
                console.warn(e);
            }
        } else {
            logger.warn({
                'label': loggerLabel,
                'message': 'Failed to find \'android-sdk\' in your \'PATH\'. Install Android-Studio before proceeding to build.'});
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

    isCocoaPodsIstalled: async () => {
        return await checkAvailability('pod');
    },

    validateForAndroid: (keyStore, storePassword, keyAlias, keyPassword) => {
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
    },

    validateForIos: (certificate, password, provisionalFilePath, buildType) => {
        let errors = [];
        if (!(certificate && fs.existsSync(certificate))) {
            errors.push(`p12 certificate does not exists : ${certificate}`);
        }
        if (!password) {
            errors.push('password to unlock certificate is required.');
        }
        if (!(provisionalFilePath && fs.existsSync(provisionalFilePath))) {
            errors.push(`Provisional file does not exists : ${provisionalFilePath}`);
        }
        if (!buildType) {
            errors.push('Build type is required.');
        }
        return errors;
    }
}