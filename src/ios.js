const fs = require('fs-extra');
const { findFile } = require('./utils');
const {
    exec
} = require('./exec');
const semver = require('semver');
const logger = require('./logger');
const loggerLabel = 'ios-build';
const path = require('path');

async function importCertToKeyChain(keychainName, certificate, certificatePassword) {
    await exec('security', ['create-keychain', '-p', keychainName, keychainName], {log: false});
    await exec('security', ['unlock-keychain', '-p', keychainName, keychainName], {log: false});
    await exec('security', ['import',  certificate,  '-k', keychainName, '-P', certificatePassword], {log: false});
}

async function deleteKeyChain(keychainName) {
    await exec('security', ['delete-keychain', keychainName]);
}

function copyProvisionalFile() {

}

async function extractUUID(provisionalFile) {
    const content = await exec('grep', ['UUID', '-A1', '-a', provisionalFile], {log: false});
    return content.join('\n').match(/[-A-F0-9]{36}/i)[0];
}

async function extractTeamId(provisionalFile) {
    const content = await exec('grep', ['TeamIdentifier', '-A2', '-a', provisionalFile], {log: false});
    return content[2].match(/>[A-Z0-9]+/i)[0].substr(1);
}

async function getUsername() {
    const content = await exec('id', ['-un'], false);
    return content[0];
}

function validate(certificate, password, provisionalFilePath, packageType) {
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
    if (!packageType) {
        errors.push('Package type is required.');
    }
    return errors;
}

module.exports = {
    build: async (args) => {
        const {
            cordova,
            cordovaVersion,
            cordovaIosVersion,
            projectDir, 
            certificate, 
            certificatePassword, 
            provisionalFile,
            packageType 
        } = args;
        const errors = validate(certificate, certificatePassword, provisionalFile, packageType);
        if (errors.length > 0) {
            return {
                success: false,
                errors: errors
            }
        }
        const random = Date.now();
        const username = await getUsername();
        const keychainName = `appBuild-${random}.keychain`;
        const provisionuuid =  await extractUUID(provisionalFile);
        let useModernBuildSystem = 'YES';
        logger.info({
            label: loggerLabel,
            message: `provisional UUID : ${provisionuuid}`
        });
        const codeSignIdentity = packageType === 'production' ? "iPhone Distribution" : "iPhone Developer";

        if (semver.satisfies(cordovaVersion, '8.x')) {
            useModernBuildSystem = 'NO';
        }
        const developmentTeamId = await extractTeamId(provisionalFile);
        logger.info({
            label: loggerLabel,
            message: `developmentTeamId : ${developmentTeamId}`
        });
        const targetProvisionsalPath = `/Users/${username}/Library/MobileDevice/Provisioning\ Profiles/${provisionuuid}.mobileprovision`;
        await importCertToKeyChain(keychainName, certificate, certificatePassword);
        logger.info({
            label: loggerLabel,
            message: `Cerificate at (${certificate}) imported in a temporary keychain (${keychainName})`
        });
        fs.copyFileSync(provisionalFile, targetProvisionsalPath);
        logger.info({
            label: loggerLabel,
            message: `copied provisionalFile (${provisionalFile}).`
        });

        await exec(cordova, ['platform', 'add', `ios@${cordovaIosVersion}`, '--verbose'], {
            cwd: projectDir
        });
        logger.info({
            label: loggerLabel,
            message: 'Added cordova ios'
        });
        await exec(cordova, ['prepare', 'ios', '--verbose'], {
            cwd: projectDir
        });
        const projectInfo = require(projectDir + 'package.json');
        logger.info({
            label: loggerLabel,
            message: 'Prepared for cordova ios'
        });
        await exec(cordova, [
            'build', 'ios', '--verbose', '--device',
            packageType === 'production' ? '--release' : '--debug',
            `--codeSignIdentity="${codeSignIdentity}"`,
            `--packageType="${packageType === 'production' ? 'app-store' : 'development'}"`,
            `--developmentTeam="${developmentTeamId}"`,
            `--provisioningProfile="${provisionuuid}"`,
            `--buildFlag="-UseModernBuildSystem=${useModernBuildSystem}"`
        ], {
            cwd: projectDir,
            shell: true
        });
        logger.info({
            label: loggerLabel,
            message: 'build completed'
        });
        await deleteKeyChain(keychainName);
        logger.info({
            label: loggerLabel,
            message: `removed keychain (${keychainName}).`
        });
        /*fs.removeSync(targetProvisionsalPath);
        logger.info({
            label: loggerLabel,
            message: `removed provisionalFile (${provisionalFile}).`
        });*/
        const output =  projectDir + 'output/ios/';
        const outputFilePath = `${output}${projectInfo.displayName || projectInfo.name}(${projectInfo.version}).${packageType}.ipa`;
        fs.mkdirSync(output, {recursive: true});
        fs.copyFileSync(findFile(projectDir + 'platforms/ios/build/device', /\.ipa?/), outputFilePath);
        return {
            success: true,
            output: outputFilePath
        };
    }
}