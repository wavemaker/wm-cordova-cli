#!/usr/bin/env node
const updateNotifier = require('update-notifier');
const pkg = require('./package.json');
updateNotifier({
    pkg: pkg,
    updateCheckInterval : 60 * 60 * 1000
}).notify({
	defer: false
});
const {
    build, generatePages
} = require('./src/command');

const args = require('yargs')
    .command('generate pages [src]', 'prepare for build', yargs => {
        yargs.positional('src', {
            describe: 'path of cordova project',
            default: './',
            type: 'string',
            normalize: true
        });
    }, args => generatePages(args.src))
    .command('build', 'build for target platform', yargs => {
        yargs.command('android [src] [dest] [options]', 'build for android', yargs => {
            yargs.positional('src', {
                describe: 'path of cordova project',
                default: './',
                type: 'string',
                normalize: true
            });
            yargs.positional('dest', {
                describe: 'path of build directory',
                type: 'string',
                normalize: true
            })
            .option('cav', {
                alias: 'cordovaAndroidVersion',
                describe: 'Cordova Android Version'
            })
            .option('aks', {
                alias: 'aKeyStore',
                describe: '(Android) path to keystore',
                type: 'string'
            })
            .option('axm', {
                alias: 'androidXMigrationEnabled',
                describe: 'Run android x migration (true or false)',
                default: false,
                type: 'boolean'
            })
            .option('asp', {
                alias: 'aStorePassword',
                describe: '(Android) password to keystore',
                type: 'string'
            })
            .option('aka', {
                alias: 'aKeyAlias',
                describe: '(Android) Alias name',
                type: 'string'
            })
            .option('akp', {
                alias: 'aKeyPassword',
                describe: '(Android) password for key.',
                type: 'string'
            })
        }, args => {
            args.platform = 'android';
            build(args)
        })
        .command('ios [src] [dest] [options]', 'build for iOS', yargs => {
            yargs.positional('src', {
                describe: 'path of cordova project',
                default: './',
                type: 'string',
                normalize: true
            });
            yargs.positional('dest', {
                describe: 'path of build directory',
                type: 'string',
                normalize: true
            })
            .option('civ', {
                alias: 'cordovaIosVersion',
                describe: 'Cordova iOS Version'
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
            });
        }, args => {
            args.platform = 'ios';
            build(args)
        })
        .option('cv', {
            alias: 'cordovaVersion',
            describe: 'Cordova  Version'
        })
        .option('p', {
            alias: 'packageType',
            describe: 'development (or) release',
            default: 'development',
            choices: ['development', 'production']
        })
        .option('ah', {
            alias: 'allowHooks',
            describe: 'true or false',
            default: false,
            type: 'boolean'
        }).demandCommand(1);
    })
    .help('h')
    .alias('h', 'help').argv;