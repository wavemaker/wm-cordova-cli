var htmlDecode = require('htmlencode').htmlDecode
var child_process = require('child_process')
var escape = require('shell-argument-escape').escape
var Path = require('path');

function exec(cmd, opt) {
    opt = Object.assign({
        cwd: __dirname
    }, opt)
    return new Promise((resolve, reject) => {
        child_process.exec(cmd, opt, (err, stdout, stderr) => {
            if(err) {
                reject(stderr)
            } else {
                resolve(stdout)
            }
        })
    })
}

function getVal(xml, name) {
    var m = new RegExp(`<key>${name}<\\/key>\\n\\s*<string>(.+)<\\/string>`)
    return htmlDecode(xml.match(m)[1])
}

function getType(xml) {
    var types = {
        appstore: 'appstore',
        inhouse: 'inhouse',
        adhoc: 'adhoc',
        dev: 'dev',
    }
    if(xml.indexOf('<key>ProvisionsAllDevices</key>') >= 0) {
        return types.inhouse
    }
    if(xml.indexOf('<key>ProvisionedDevices</key>') < 0) {
        return types.appstore
    }
    if(xml.match(/<key>get-task-allow<\/key>\n\s*<true\/>/)) {
        return types.dev
    }
    return types.adhoc
}

function getInfo(xml) {
    var info = {}
    info.uuid = getVal(xml, 'UUID')
    info.team = {
        name: getVal(xml, 'TeamName'),
        id: getVal(xml, 'com.apple.developer.team-identifier'),
    }
    info.appid = getVal(xml, 'application-identifier')
    info.name = getVal(xml, 'Name')
    info.type = getType(xml)
    var cers = xml.match(/<key>DeveloperCertificates<\/key>\n\s*<array>\n\s*((?:<data>\S+?<\/data>\n\s*)+)<\/array>/)[1]
    info.cers = cers.match(/[^<>]{10,}/g)
    return info
}

function main(profilePath, cb) {
    var cmd = `security cms -D -i ${escape(Path.resolve(profilePath))}`
    return exec(cmd)
        .then(stdout => {
            var info = getInfo(stdout)
            if(typeof cb === 'function') {
                cb(info)
            }
            return Promise.resolve(info)
        })
}

module.exports = main