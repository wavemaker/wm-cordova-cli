# wm-cordova-cli

The main goal of wm-cordova-cli is simplify generating APK or IPA simpler for WaveMaker developers. Wm-cordova-cli reduces multiple cordova commands into a single command. First, one has to make sure all the required hardware and software are available and installed. Then execute the command with the appropriate values for arguments. At present, wm-cordova-cli is supported only on mac os.


## ANDROID build

### Requirements

-   MAC machine
    
-   Latest Android Studio
    
-   Node 12.x ([https://nodejs.org/en/download/](https://nodejs.org/en/download/))
    
-   GIT ([https://git-scm.com/download/mac](https://git-scm.com/download/mac))
    
-   Java 8
    
-   Gradle 6
    
-   KeyStore file for production release builds
    
-   Install wm-cordova-cli (npm install -g [https://github.com/wavemaker/wm-cordova-cli](https://github.com/wavemaker/wm-cordova-cli))
    
-   Make sure JAVA_HOME, ANDROID_SDK and GRADLE_HOME are set in the environment variables and also in PATH.
    

  

### Command

wm-cordova build android <src_dir> <dest_dir> [additional_arguments]

  
  


|&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**Argument**&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| **Description** |
|--|--|
| **src_dir** | **DEFAULT:** current working directory.<br> Path to the cordova zip (or) path to the cordova project folder. |
|**dest_dir**|**DEFAULT:** <src_dir>/../build<br>Path to the directory where all build files are to be kept.|
|**\-\-cordovaVersion**|**DEFAULT:** 9.0.0<br>Cordova cli version to use|
|**\-\-cordovaAndroidVersion**|**DEFAULT:** 8.0.0<br>Version of cordova-ios to use|
|**\-\-aKeyStore**|Absolute path of the key store. If keystore is not given the, android debug is used.|
|**\-\-aStorePassword**|Password to key store|
|**\-\-aKeyAlias**|Alias name of the key|
|**\-\-aKeyPassword**|Key Password|
|**\-\-packageType**|**DEFAULT:** development<br>development or production<br>Use ‘production’ with keystore specified.|

  

### Example 1

~~~
wm-cordova build android “/path/to/src”
~~~
### Example 2    
~~~
wm-cordova build android “/path/to/src” \
--aKeyStore=”/path/to/file.keystore” \
--aStorePassword=”store_password” \
--aKeyAlias=”key_alias_name” \
--aKeyPassword=”key” \
--packageType=”production”
~~~

## IOS build

### Requirements

-   MAC machine
    
-   Latest XCODE
    
-   Node 12.x ([https://nodejs.org/en/download/](https://nodejs.org/en/download/))
    
-   GIT ([https://git-scm.com/download/mac](https://git-scm.com/download/mac))
    
-   Apple developer or distribution P12 certificates
    
-   Provisioning profile
    
-   Install wm-cordova-cli (npm install -g [https://github.com/wavemaker/wm-cordova-cli](https://github.com/wavemaker/wm-cordova-cli))
    

  

### Command

wm-cordova build ios <src_dir> <dest_dir> [additional_arguments]

  
  
|&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**Argument**&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| **Description** |
|--|--|
| **src_dir** | **DEFAULT:** current working directory.<br> Path to the cordova zip (or) path to the cordova project folder. |
|**dest_dir**|**DEFAULT:** <src_dir>/../build<br>Path to the directory where all build files are to be kept.|
|**\-\-cordovaVersion**|**DEFAULT:** 9.0.0<br>Cordova cli version to use|
|**\-\-cordovaIosVersion**|**DEFAULT:** 5.1.1<br>Version of cordova-ios to use|
|**\-\-iCertificate**|Absolute path of P12 certificate location|
|**\-\-iCertificatePassword**|Password to unlock the certificate.|
|**\-\-iProvisioningFile**|Absolute path of provisioning file|
|**\-\-packageType**|**DEFAULT:** development<bR>development or production <br>Use ‘production’ with an AppStore distribution certificate.|


### Example

  
~~~
wm-cordova build ios “/path/to/src” \
--iCertificate=”/path/to/distribution.p12” \
--iCertificatePassword=”unlock_password” \
--iProvisioningFile=”/path/to/profile.mobileprovision” \
--packageType=”production”
~~~

## License
MIT License
Copyright (c)  2020  WaveMaker
