// Removes duplicate READ and WRITE permissions
(function() {
    var fs = require('fs');
    var androidManifestXMLPath = `${__dirname}/../platforms/android/app/src/main/AndroidManifest.xml`;
    var androidManifestXML = fs.readFileSync(androidManifestXMLPath, {
        encoding: 'utf-8'
    });
    var writeExternalStorageRegex = /(<uses-permission.*android\.permission\.READ_EXTERNAL_STORAGE.*\/>)/g;
    var readExternalStorageRegex = /(<uses-permission.*android\.permission\.WRITE_EXTERNAL_STORAGE.*\/>)/g;
    var write = false;
    function removeDuplictes(content, regex) {
        var tokens = (content.match(regex) || []);
        var tokenToRetain = tokens[0];
        var maxSdk = 0;
        tokens.forEach((v, i) => {
            var sdk = v.match(/maxSdkVersion=\"(\d*)\"/);
            if (sdk) {
                sdk = parseInt(sdk[1]);
                if (sdk > maxSdk) {
                    maxSdk = sdk;
                    tokenToRetain = v;
                }
            }
        });
        tokens.splice(tokens.indexOf(tokenToRetain), 1);
        tokens.forEach((v) => {
            content = content.replace(v, `<!--${v}-->`);
            write = true;
        });
        return content;
    }
    androidManifestXML = removeDuplictes(androidManifestXML, writeExternalStorageRegex);
    androidManifestXML = removeDuplictes(androidManifestXML, readExternalStorageRegex);
    if (write) {
        fs.writeFileSync(androidManifestXMLPath, androidManifestXML);
        console.log('Commented storage permission duplicates');
    }
}());