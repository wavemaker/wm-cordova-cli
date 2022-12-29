const fs = require('fs-extra');
const { findFile } = require('./utils');
const {
    exec
} = require('./exec');
const semver = require('semver');
const logger = require('./logger');
const loggerLabel = 'ios-build';
const path = require('path');
const {
    hasValidNodeVersion,
    isGitInstalled,
    isCocoaPodsIstalled,
    validateForIos
 } = require('./requirements');
 const pparse = require('./mobileprovision-parse');

async function importCertToKeyChain(keychainName, certificate, certificatePassword) {
    await exec('security', ['create-keychain', '-p', keychainName, keychainName], {log: false});
    await exec('security', ['unlock-keychain', '-p', keychainName, keychainName], {log: false});
    await exec('security', ['set-keychain-settings', keychainName], {log: false});
    let keychains = await exec('security', ['list-keychains', '-d', 'user'], {log: false});
    keychains = keychains.map(k => k.replace(/[\"\s]+/g, '')).filter(k => k !== '');
    await exec('security', ['list-keychains', '-d', 'user', '-s', keychainName, ...keychains], {log: false});
    await exec('security', 
        ['import',  
        certificate,  
        '-k', keychainName,
        '-P', certificatePassword,
        '-T', '/usr/bin/codesign',
        '-T', '/usr/bin/productsign',
        '-T', '/usr/bin/productbuild',
        '-T', '/Applications/Xcode.app'], {log: false});
    await exec('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign', '-s', '-k', keychainName, keychainName], {log: false});
    await exec('security', ['unlock-keychain', '-p', keychainName, keychainName], {log: false});
    await exec('security', ['set-keychain-settings', '-t', '3600', keychainName], {log: false});
    logger.info({
        label: loggerLabel,
        message: `Cerificate at (${certificate}) imported in (${keychainName})`
    });
    return async () => {
        keychains = keychains.map(k => k.replace(/[\"\s]+/g, ''));
        await exec('security', ['list-keychains', '-d', 'user', '-s', ...keychains], {log: false});
        await deleteKeyChain(keychainName);
        logger.info({
            label: loggerLabel,
            message: `removed keychain (${keychainName}).`
        });
    };
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

async function getLoginKeyChainName() {
    const content = await exec('security list-keychains | grep login.keychain', null, {
        shell: true
    });
    return content[0].substring(content[0].lastIndexOf('/') + 1, content[0].indexOf('-'));
}

async function extractTeamId(provisionalFile) {
    const content = await exec('grep', ['TeamIdentifier', '-A2', '-a', provisionalFile], {log: false});
    return content[2].match(/>[A-Z0-9]+/i)[0].substr(1);
}

async function getUsername() {
    const content = await exec('id', ['-un'], false);
    return content[0];
}

async function getPackageType(provisionalFile) {
    const data = await pparse(provisionalFile);
    //data.
    if (data.type === 'appstore') {
        return 'app-store';
    }
    if (data.type === 'inhouse') {
        return 'enterprise';
    } 
    if (data.type === 'adhoc') {
        return 'ad-hoc';
    }
    throw new Error('Not able find the type of provisioning file.');
}

async function turnOffPodCodeSigning(projectDir) {
    const iosProjectPath = `${projectDir}/platforms/ios`;
    const podFilePath = `${iosProjectPath}/Podfile`;
    let podFileContent = fs.readFileSync(podFilePath);
    if (podFileContent.indexOf(`config.build_settings['CODE_SIGNING_ALLOWED']`) < 0) {
        podFileContent += `
        post_install do |installer|
            installer.pods_project.targets.each do |target|
            if target.respond_to?(:product_type) and target.product_type == "com.apple.product-type.bundle"
                target.build_configurations.each do |config|
                    config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
                end
            end
            end
        end
        `;
        fs.writeFileSync(podFilePath, podFileContent, {
            encoding: 'utf-8'
        });
        await exec("pod", ["install", "--verbose"], {
            cwd: iosProjectPath
        });
    }
}

module.exports = {
    build: async (args) => {
        let {
            cordova,
            cordovaVersion,
            cordovaIosVersion,
            projectDir, 
            certificate, 
            certificatePassword, 
            provisionalFile,
            buildType,
            packageType
        } = args;

        if (!await hasValidNodeVersion() || !await isGitInstalled() || !await isCocoaPodsIstalled()) {
            return {
                success: false
            }
        }
        const errors = validateForIos(certificate, certificatePassword, provisionalFile, buildType);
        if (errors.length > 0) {
            return {
                success: false,
                errors: errors
            }
        }
        const random = Date.now();
        const username = await getUsername();
        const keychainName = `wm-cordova-${random}.keychain`;
        const provisionuuid =  await extractUUID(provisionalFile);
        let removeKeyChain = () => Promise.resolve();
        let useModernBuildSystem = 'YES';
        logger.info({
            label: loggerLabel,
            message: `provisional UUID : ${provisionuuid}`
        });
        if (semver.satisfies(cordovaVersion, '8.x')) {
            useModernBuildSystem = 'NO';
        }
        const developmentTeamId = await extractTeamId(provisionalFile);
        logger.info({
            label: loggerLabel,
            message: `developmentTeamId : ${developmentTeamId}`
        });
        const ppFolder = `/Users/${username}/Library/MobileDevice/Provisioning\ Profiles`;
        fs.mkdirSync(ppFolder, {
            recursive: true
        })
        const targetProvisionsalPath = `${ppFolder}/${provisionuuid}.mobileprovision`;
        fs.copyFileSync(provisionalFile, targetProvisionsalPath);
        logger.info({
            label: loggerLabel,
            message: `copied provisionalFile (${provisionalFile}).`
        });
        try {
            await exec(cordova, ['platform', 'add', `ios@${cordovaIosVersion}`, '--verbose'], {
                cwd: projectDir
            });
            logger.info({
                label: loggerLabel,
                message: 'Added cordova ios'
            });
            await turnOffPodCodeSigning(projectDir);
            await exec(cordova, ['prepare', 'ios', '--verbose'], {
                cwd: projectDir
            });
            const projectInfo = require(projectDir + 'package.json');
            logger.info({
                label: loggerLabel,
                message: 'Prepared for cordova ios'
            });
            packageType = packageType || 'development';
            if (buildType === 'release') {
                packageType = await getPackageType(provisionalFile);
            }
            removeKeyChain = await importCertToKeyChain(keychainName, certificate, certificatePassword);
            const codeSignIdentity = buildType === 'release' ? "iPhone Distribution" : "iPhone Developer";
            await exec(cordova, [
                'build', 'ios', '--verbose', '--device',
                `--${buildType}`,
                `--codeSignIdentity="${codeSignIdentity}"`,
                `--packageType="${packageType}"`,
                `--developmentTeam="${developmentTeamId}"`,
                `--provisioningProfile="${provisionuuid}"`,
                `--buildFlag="-UseModernBuildSystem=${useModernBuildSystem}"`,
                `--buildFlag="CODE_SIGN_KEYCHAIN=~/Library/Keychains/${keychainName}"`
            ], {
                cwd: projectDir,
                shell: true
            });
            logger.info({
                label: loggerLabel,
                message: 'build completed'
            });
            const output =  projectDir + 'output/ios/';
            const outputFilePath = `${output}${projectInfo.displayName || projectInfo.name}(${projectInfo.version}).${buildType}.ipa`;
            fs.mkdirSync(output, {recursive: true});
            fs.copyFileSync(findFile(projectDir + 'platforms/ios/build/device', /\.ipa?/), outputFilePath);
            return {
                success: true,
                output: outputFilePath
            };
        } finally {
            await removeKeyChain();
            /*fs.removeSync(targetProvisionsalPath);
            logger.info({
                label: loggerLabel,
                message: `removed provisionalFile (${provisionalFile}).`
            });*/
        }
    }
}
