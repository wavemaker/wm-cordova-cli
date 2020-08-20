#!/usr/bin/env node
const {
    build
} = require('./src/command');
const { endWith } = require('./src/utils');

const args = require('yargs')
    .command('build <platform> [src] [dest] [options]', 'build for target platform', yargs => {
        yargs.positional('platform', {
            describe: 'ios (or) android',
            choices: ['ios', 'android']
        });
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
        });
    })
    .option('cv', {
        alias: 'cordovaVersion',
        describe: 'Cordova  Version',
        default: '9.0.0'
    })
    .option('cav', {
        alias: 'cordovaAndroidVersion',
        describe: 'Cordova Android Version',
        default: '8.0.0'
    })
    .option('civ', {
        alias: 'cordovaIosVersion',
        describe: 'Cordova iOS Version',
        default: '5.1.1'
    })
    .option('aks', {
        alias: 'aKeyStore',
        describe: '(Android) path to keystore',
        type: 'string'
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
        default: 'development',
        choices: ['development', 'production']
    })
    .help('h')
    .alias('h', 'help').argv;
try {
    build(args);
} catch (e) {
    console.error(e);
}