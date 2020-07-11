const fs = require('fs-extra');
const ios = require('./ios');
const logger = require('./logger');
const config = require('./config');
const { endWith } = require('./utils');

const loggerLabel = 'wm-cordova-cli';
const args = require('yargs')
    .command('build <platform> [src] [dest] [options]', 'build for target platform', yargs => {
        yargs.positional('platform', {
            describe: 'ios (or) android',
            coerce: (v) => {
                if (v == 'all') {
                    return ['ios', 'android'];
                }
                return [v];
            },
            choices: ['ios', 'android', 'all']
        });
        yargs.positional('src', {
            describe: 'path of cordova project',
            coerce: (v) => endWith(v, '/'),
            default: './',
            type: 'string',
            normalize: true
        });
        yargs.positional('dest', {
            coerce: (v) => endWith(v, '/'),
            describe: 'path of build directory',
            default: '../build',
            type: 'string',
            normalize: true
        });
    })
    .option('civ', {
        alias: 'cordovaIosVersion',
        describe: 'development (or) release',
        default: '6.1.0'
    })
    .option('ic', {
        alias: 'iCertificate',
        describe: '(iOS) path of p12 certificate to use',
        type: 'string'
    })
    .option('icp', {
        alias: 'iCertificatePassword',
        describe: '(iOS) password to unlock certificate',
        type: 'string'
    })
    .option('ipf', {
        alias: 'iProvisioningFile',
        describe: '(iOS) path of the provisional profile to use',
        type: 'string'
    })
    .option('p', {
        alias: 'packageType',
        describe: 'development (or) release',
        choices: ['development', 'production']
    })
    .help('h')
    .alias('h', 'help').argv;


function setupBuildDirectory() {
    const target = args.dest;
    if (fs.existsSync(target)) {
        fs.rmdirSync(target, {
            recursive: true
        });
    }
    fs.mkdirSync(target);
    fs.copySync(args.src, args.dest);
}


module.exports = {
    build: async function () {
        setupBuildDirectory();
        
        config.src = args.dest;
        config.outputDirectory = config.src + 'output/';
        fs.mkdirSync(config.outputDirectory, {recursive: true});
        config.logDirectory = config.outputDirectory + 'logs/';
        fs.mkdirSync(config.logDirectory, {recursive: true});
        logger.setLogDirectory(config.logDirectory);


        if (args.platform.indexOf('android') >= 0) {
            const result = ios.build();
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
        }

        if (args.platform.indexOf('ios') >= 0) {
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