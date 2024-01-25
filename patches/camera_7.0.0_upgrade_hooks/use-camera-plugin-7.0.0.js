// Camera issues in Android 13 were addressed in cordova-plugin-camera@7.0.0
// So, updating camera plugin version from 6.0.0 to 7.0.0
//
(function() {
    var fs = require('fs');
    var cameraPluginRegexp = new RegExp('<plugin\\s+name="cordova-plugin-camera"\\s*spec="6.0.0"');
    var configXMLPath = `${__dirname}/../config.xml`;
    var configXML = fs.readFileSync(configXMLPath, {
        encoding: 'utf-8'
    });
    if (cameraPluginRegexp.test(configXML)) {
        configXML = configXML.replace(cameraPluginRegexp,
            '<plugin name="cordova-plugin-camera" spec="7.0.0"');
        console.log('Updated cordova-plugin-camera from 6.0.0 to 7.0.0');
        fs.writeFileSync(configXMLPath, configXML);
    } else {
        console.log('cordova-plugin-camera@6.0.0 not found. Hence, upgrade is skipped.');
    }
}());