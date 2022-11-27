const {faker} = require("@faker-js/faker");
const os = require("os");
const WorkerPool = require("./Worker");


const {UpdateProxyDB} = require("./DataBase");
const zipdir = require("zip-dir");
const AdmZip = require("adm-zip");


const debug = require('debug')('gologin');
const GoLogin = require('../gologin')
const requests = require('requestretry').defaults({timeout: 60000});
const fs = require('fs');
const path = require('path');
const util = require("util");
const {access, unlink, writeFile, readFile} = require('fs').promises;
const rimraf = util.promisify(require('rimraf'));
const _ = require("lodash");
const ExtensionsManager = require("../extensions-manager");
const {BrowserUserDataManager} = require("../browser-user-data-manager");
const {getLocalProfiles} = require("./LocalProfiles")
const {UpdatePidsDB, DeletePidDB} = require("./DataBase")
const {config} = require("./Config")
const WebSocket = require('ws');
const {execFile} = require("child_process");
const cheerio = require("cheerio");
const generator = require("generate-password");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_URL = 'https://api.gologin.com';
const OS_PLATFORM = process.platform;

const express = require('express')
const ProfileRoute = express.Router()

//executablePath: './browser/chrome.exe',

const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

class MyGoLogin extends GoLogin {
    ws;

    async initWebSocket(wsUrl) {

        const ws = this.ws = new WebSocket(wsUrl)

        ws.on('open', () => this.wsOnOpen(ws))
        ws.on('message', data => this.wsOnMessage(data))
        ws.on('error', e => this.wsOnError(e))
        ws.on('close', (code, reason) => this.wsOnClose(ws, code, reason))

        await new Promise((resolve, reject) => {
            ws.once('open', resolve)
            ws.once('error', reject)
            ws.once('close', reject)
        })

        return ws
    }

    async wsOnOpen(ws) {
        console.log("opennnnnnnnnnnnnn")
    }

    async wsOnClose(ws) {
        await this.stop()
        console.log("Clossssssssss")
    }

    async wsOnMessage(data) {

        if (typeof data !== 'string') {
            throw new Error('data should be string...')
        }

        try {
            const obj = JSON.parse(data)
            console.log(obj)
        } catch (e) {
            log.verbose('Io', 'on(message) recv a non IoEvent data[%s]', data)
        }


    }

    wsOnError(e) {
        log.warn('Io', 'initWebSocket() error event[%s]', e && e.message)
        if (!e) {
            return
        }
    }

    async iter(o, j) {
        for (const k of Object.keys(o)) {
            if (o[k] !== null && typeof o[k] === 'object') {
                await this.iter(o[k], j[k]);
                continue;
            }
            if (typeof o[k] === 'string' && j[k] !== o[k]) {
                j[k] = o[k];
            }
        }
        return j
    }

    // async createLocalProfile(config = {}) {
    //
    //     const pid = await this.create(config);
    //     await this.setProfileId(pid);
    //     await this.createStartup();
    //     const zip = await this.commitProfile();
    //     await this.clearProfileFiles();
    //     console.log("Local Profile Created in : ", zip);
    //     // await this.createBrowserExtension();
    //     return pid
    // }

    async getProfileDataBuffer(save = undefined) {
        // const zipPath = path.join(this.tmpdir, `gologin_${this.profile_id}_upload.zip`);
        // const zipExists = await access(zipPath).then(() => true).catch(() => false);
        // if (zipExists) {
        //     await unlink(zipPath);
        // }

        await this.sanitizeProfile();
        debug('profile sanitized');

        const profilePath = this.profilePath();
        // const fileBuff = await new Promise((resolve, reject) => zipdir(profilePath,
        //     {
        //         filter: (path) => !/RunningChromeVersion/.test(path),
        //     }, (err, buffer) => {
        //         if (err) {
        //             reject(err);
        //             return;
        //         }
        //
        //         resolve(buffer);
        //     })
        // )
        // creating archives
        const zip = new AdmZip();
        zip.addLocalFolder(profilePath, undefined, (path) => !/RunningChromeVersion/.test(path));
        // get everything as a buffer
        const fileBuff = zip.toBuffer();


        debug('begin checking Buffer', fileBuff.length);
        if (!fileBuff.length) {
            debug('WARN: profile zip data empty - SKIPPING PROFILE COMMIT');

            return;
        }
        debug('PROFILE Buffer CREATED', profilePath);
        const zipPath = (save !== undefined) ? path.join(save, this.profile_id, `${this.profile_id}.zip`) : false;
        // or write everything to disk
        if (zipPath !== false) zip.writeZip(zipPath);
        return [fileBuff, zipPath];
    }

    async createLocalProfile(config = {}, saveZip = undefined) {


        const pid = await this.create(config);
        await this.setProfileId(pid);
        await this.createStartup();

        const save = (saveZip !== undefined) ? saveZip : undefined;
        const [buffer, zipPath] = await this.getProfileDataBuffer(save);
        // const zip = await this.commitProfile();
        await this.clearProfileFiles();
        console.log("Local Profile Created in : ", zipPath);
        // await this.createBrowserExtension();
        let response = {};
        response.pid = pid;
        response.config = config;
        response.buffer = buffer;
        response.zipPath = zipPath;
        return response

    }

    async startLocaly(profile_id) {
        await this.setProfileId(profile_id);
        const {status, wsUrl} = await this.startLocal()
        return wsUrl
    }

    async patchFile(fileBuff) {
        const profilePath = path.join(this.tmpdir, this.profile_id)
        const zip_path = path.join(profilePath, `gologin_${this.profile_id}.zip`)
        const bakZip_path = path.join(profilePath, `gologin_${this.profile_id}_bak.zip`)

        if (!fs.existsSync(profilePath)) {
            debug('making profile dir', profilePath);
            fs.mkdirSync(profilePath, {recursive: true})
        }

        if (fs.existsSync(zip_path)) {
            debug('making profile dir', this.tmpdir);
            if (fs.existsSync(bakZip_path)) {
                try {
                    fs.unlinkSync(bakZip_path)
                    //file removed
                } catch (err) {
                    console.error(err)
                }
            }
            fs.rename(
                zip_path,
                bakZip_path,
                (err) => {
                    if (err) throw err;
                    console.log('Rename complete!');
                });
        }


        // const exist = await this.profileExists()
        debug('POSTING FILE', fileBuff.length);
        const bodyBufferBiteLength = Buffer.byteLength(fileBuff);
        // console.log('BUFFER SIZE', bodyBufferBiteLength);

        fs.writeFileSync(zip_path, fileBuff);
        var stats = fs.statSync(zip_path)
        var fileSizeInBytes = stats.size;
        if (fileSizeInBytes !== bodyBufferBiteLength) {
            console.log('Uploaded file is incorrect. Retry with China File size:', fileSizeInBytes);
            throw new Error('Uploaded file is incorrect. Retry with China File size: ' + fileSizeInBytes);
        }

        console.log('Profile has been uploaded to S3 successfully');

        if (fs.existsSync(bakZip_path)) {
            try {
                console.log('Remove Profile Bak File');
                fs.unlinkSync(bakZip_path)
                //file removed
            } catch (err) {
                console.error(err)
            }
        }
    }

    async getRandomFingerprintAll(options) {
        let os = options.os ? options.os : 'win';
        let resolution = (options.navigator && options.navigator.resolution) ? `&resolution=${options.navigator.resolution}` : ''

        let fingerprint = await requests.get(`${API_URL}/browser/fingerprint?os=${os}`.concat(resolution), {
            headers: {
                'Authorization': `Bearer ${this.access_token}`,
                'User-Agent': 'gologin-api',
            }
        });

        return JSON.parse(fingerprint.body);
    }

    async create(options) {
        options = JSON.parse(options);
        debug('createProfile', options);
        // todo - undefined
        if (!options.token || options.token === "") {
            options.token = config.GoToken
        }
        if (!options.name || options.name === "") {
            debug('Profile Name not defined, Generating Fake name...');
            // const generatedName = await this.generateName();
            // options.name = `${generatedName.fname}-${generatedName.lname}`
            options.name = faker.internet.userName()
            // console.log(options.name)
        }

        const fingerprint = await this.getRandomFingerprint(options);
        debug("fingerprint=", fingerprint)

        if (fingerprint.statusCode === 500) {
            throw new Error("no valid random fingerprint check os param");
        }

        if (fingerprint.statusCode === 401) {
            throw new Error("invalid token");
        }

        const {navigator, canvas, mediaDevices, fonts, webGLMetadata, webglParams, webRTC} = fingerprint;
        let deviceMemory = navigator.deviceMemory || 2;
        if (deviceMemory < 1) {
            deviceMemory = 1;
        }
        navigator.deviceMemory = deviceMemory //* 1024;
        webGLMetadata.mode = webGLMetadata.mode === 'noise' ? 'mask' : 'off';

        // const json = {
        //   ...fingerprint,
        //   navigator,
        //   webGLMetadata,
        //   browserType: 'chrome',
        //   name: 'default_name',
        //   notes: 'auto generated',
        //   fonts: {
        //     families: fonts,
        //   },
        //   webRTC: {
        //     ...webRTC,
        //     mode: 'alerted',
        //   },
        // };

        navigator.doNotTrack = (options.navigator && options.navigator.doNotTrack) ? options.navigator.doNotTrack : false;
        navigator.language = (options.navigator && options.navigator.language) ? options.navigator.language : 'en-US,en;q=0.9';

        const json = {
            name: 'default_name',
            proxyEnabled: options.proxyEnabled || false,
            googleClientId: '',
            googleServicesEnabled: options.googleServicesEnabled || true,
            startUrl: options.startUrl || 'https://iphey.com',
            lockEnabled: options.lockEnabled || false,
            debugMode: options.debugMode || false,
            dns: options.dns || '',
            proxy: {
                mode: 'none',
                host: '',
                port: 80,
                username: '',
                password: '',
                autoProxyRegion: 'us',
                torProxyRegion: 'us'
            },
            browserType: 'chrome',
            os: options.os || 'win',
            isM1: options.isM1 || false,
            timezone: {
                enabled: options.timezone.enabled || true,
                fillBasedOnIp: options.timezone.fillBasedOnIp || true,
                timezone: options.timezone.timezone || ''
            },
            navigator,
            canvas,
            geolocation: {
                mode: options.geolocation.mode || 'prompt',
                enabled: options.geolocation.enabled || true,
                fillBasedOnIp: options.geolocation.fillBasedOnIp || true,
                customize: options.geolocation.customize || false,
                latitude: options.geolocation.latitude || 0,
                longitude: options.geolocation.longitude || 0,
                accuracy: options.geolocation.accuracy || 10
            },
            webRTC: {
                mode: options.webRTC.mode || 'alerted',
                enabled: options.webRTC.enabled || true,
                fillBasedOnIp: options.webRTC.fillBasedOnIp || true,
                localIpMasking: options.webRTC.localIpMasking || false,
                publicIp: options.webRTC.publicIp || '',
                customize: options.webRTC.customize || true,
                localIps: options.webRTC.localIps || webRTC.localIps,
            },
            webGL: {
                mode: options.webGL.mode || 'noise'
            },
            webGLMetadata,
            audioContext: {
                mode: options.audioContext.mode || 'noise'
            },
            notes: options.notes || 'auto generated',
            fonts: {
                enableMasking: options.fonts.enableMasking || true,
                enableDomRect: options.fonts.enableDomRect ||true,
                families: fonts,
            },
            mediaDevices,
            extensions: {
                enabled: options.extensions.enabled || true,
                preloadCustom: options.extensions.preloadCustom || true,
                names: options.extensions.names || []
            },
            storage: {
                local: options.storage.local || true,
                extensions: options.storage.extensions || true,
                bookmarks: options.storage.bookmarks || true,
                history: options.storage.history || true,
                passwords: options.storage.passwords || true,
                session: options.storage.session || true
            },
            plugins: {
                enableVulnerable: options.plugins.enableVulnerable || true,
                enableFlash: options.plugins.enableFlash || true
            },
            cookies: options.cookies || [],
            devicePixelRatio: options.devicePixelRatio || fingerprint.devicePixelRatio,
            updateExtensions: options.updateExtensions || true,
            chromeExtensions: options.chromeExtensions || [],
            chromeExtensionsToAllProfiles: options.chromeExtensionsToAllProfiles || [],
            userChromeExtensions: options.userChromeExtensions || [],
            webglParams
        };
        let user_agent = options.navigator?.userAgent;
        let orig_user_agent = json.navigator.userAgent;
        Object.keys(options).map((e)=>{ json[e] = options[e] });
        if (user_agent === 'random') {
          json.navigator.userAgent = orig_user_agent;
        }
        // console.log('profileOptions', json);    

        const response = await requests.post(`${API_URL}/browser`, {
            headers: {
                'Authorization': `Bearer ${this.access_token}`,
                'User-Agent': 'gologin-api',
            },
            json,
        });

        if (response.statusCode === 400) {
            throw new Error(`gologin failed account creation with status code, ${response.statusCode} DATA  ${JSON.stringify(response.body.message)}`);
        }

        if (response.statusCode === 500) {
            throw new Error(`gologin failed account creation with status code, ${response.statusCode}`);
        }
        debug(JSON.stringify(response.body));
        return response.body.id;
    }

    async createStartup(local = false) {
        const profilePath = path.join(this.tmpdir, `gologin_profile_${this.profile_id}`);
        let profile;
        let profile_folder;
        await rimraf(profilePath);
        debug('-', profilePath, 'dropped');
        profile = local ? await getLocalProfiles(path.join(this.tmpdir, this.profile_id), false) : await this.getProfile();
        const mediaDeviceId = profile.mediaDevices.uid
        profile.id = this.profile_id;


        // profile.s3Path = init ? _.get(profile, 's3Path', '') : path.join(profilePath, `gologin_${this.profile_id}.zip`);
        const {navigator = {}, fonts, os: profileOs} = profile;
        this.fontsMasking = fonts?.enableMasking;
        this.profileOs = profileOs;
        this.differentOs =
            profileOs !== 'android' && (
                OS_PLATFORM === 'win32' && profileOs !== 'win' ||
                OS_PLATFORM === 'darwin' && profileOs !== 'mac' ||
                OS_PLATFORM === 'linux' && profileOs !== 'lin'
            );

        const {
            resolution = '1920x1080',
            language = 'en-US,en;q=0.9',
        } = navigator;
        this.language = language;
        const [screenWidth, screenHeight] = resolution.split('x');
        this.resolution = {
            width: parseInt(screenWidth, 10),
            height: parseInt(screenHeight, 10),
        };

        const profileZipExists = await access(this.profile_zip_path).then(() => true).catch(() => false);
        if (!(local && profileZipExists)) {
            try {
                profile_folder = await this.getProfileS3(_.get(profile, 's3Path', ''));
            } catch (e) {
                debug('Cannot get profile - using empty', e);
            }

            debug('FILE READY', this.profile_zip_path);
            if (!profile_folder.length) {
                profile_folder = await this.emptyProfileFolder();
            }

            await writeFile(this.profile_zip_path, profile_folder);

            debug('PROFILE LENGTH', profile_folder.length);
        } else {
            debug('PROFILE LOCAL HAVING', this.profile_zip_path);
        }

        debug('Cleaning up..', profilePath);

        try {
            await this.extractProfile(profilePath, this.profile_zip_path);
            debug('extraction done');
        } catch (e) {
            console.trace(e);
            profile_folder = await this.emptyProfileFolder();
            await writeFile(this.profile_zip_path, profile_folder);
            await this.extractProfile(profilePath, this.profile_zip_path);
        }

        const singletonLockPath = path.join(profilePath, 'SingletonLock');
        const singletonLockExists = await access(singletonLockPath).then(() => true).catch(() => false);
        if (singletonLockExists) {
            debug('removing SingletonLock');
            await unlink(singletonLockPath);
            debug('SingletonLock removed');
        }

        const pref_file_name = path.join(profilePath, 'Default', 'Preferences');
        debug('reading', pref_file_name);

        const prefFileExists = await access(pref_file_name).then(() => true).catch(() => false);
        if (!prefFileExists) {
            debug('Preferences file not exists waiting', pref_file_name, '. Using empty profile');
            profile_folder = await this.emptyProfileFolder();
            await writeFile(this.profile_zip_path, profile_folder);
            await this.extractProfile(profilePath, this.profile_zip_path);
        }

        const preferences_raw = await readFile(pref_file_name);
        let preferences = JSON.parse(preferences_raw.toString());
        let proxy = _.get(profile, 'proxy');
        let name = _.get(profile, 'name');
        const chromeExtensions = _.get(profile, 'chromeExtensions') || [];
        const userChromeExtensions = _.get(profile, 'userChromeExtensions') || [];
        const allExtensions = [...chromeExtensions, ...userChromeExtensions];
    
        if (allExtensions.length) {
          const ExtensionsManagerInst = new ExtensionsManager();
          ExtensionsManagerInst.apiUrl = API_URL;
          await ExtensionsManagerInst.init()
            .then(() => ExtensionsManagerInst.updateExtensions())
            .catch(() => {});
            ExtensionsManagerInst.accessToken = this.access_token;

            await ExtensionsManagerInst.getExtensionsPolicies();
            let profileExtensionsCheckRes = [];

            if (ExtensionsManagerInst.useLocalExtStorage) {
                const promises = [
                  ExtensionsManagerInst.checkChromeExtensions(allExtensions)
                    .then(res => ({ profileExtensionsCheckRes: res }))
                    .catch((e) => {
                    console.log('checkChromeExtensions error: ', e);
                    return { profileExtensionsCheckRes: [] };
                  }),
                  ExtensionsManagerInst.checkLocalUserChromeExtensions(userChromeExtensions)
                    .then(res => ({ profileUserExtensionsCheckRes: res }))
                    .catch((error) => {
                      console.log('checkUserChromeExtensions error: ', error);
                      return null;
                    }),
                ];
                const extensionsResult = await Promise.all(promises);
        
                const profileExtensionPathRes = extensionsResult.find(el => 'profileExtensionsCheckRes' in el) || {};
                const profileUserExtensionPathRes = extensionsResult.find(el => 'profileUserExtensionsCheckRes' in el);
                profileExtensionsCheckRes =
                  (profileExtensionPathRes?.profileExtensionsCheckRes || []).concat(profileUserExtensionPathRes?.profileUserExtensionsCheckRes || []);
             }

            let extSettings;
            if (ExtensionsManagerInst.useLocalExtStorage) {
                extSettings = await BrowserUserDataManager.setExtPathsAndRemoveDeleted(preferences, profileExtensionsCheckRes, this.profile_id);
            } else {
                const originalExtensionsFolder = path.join(profilePath, 'Default', 'Extensions');
                extSettings = await BrowserUserDataManager.setOriginalExtPaths(preferences, originalExtensionsFolder);
            }

            this.extensionPathsToInstall =
                ExtensionsManagerInst.getExtensionsToInstall(extSettings, profileExtensionsCheckRes);

            if (extSettings) {
                const currentExtSettings = preferences.extensions || {};
                currentExtSettings.settings = extSettings
                preferences.extensions = currentExtSettings;
            }
        }

        if (proxy.mode === 'gologin' || proxy.mode === 'tor') {
            const autoProxyServer = _.get(profile, 'autoProxyServer');
            const splittedAutoProxyServer = autoProxyServer.split('://');
            const splittedProxyAddress = splittedAutoProxyServer[1].split(':');
            const port = splittedProxyAddress[1];

            proxy = {
                'mode': splittedAutoProxyServer[0],
                'host': splittedProxyAddress[0],
                port,
                'username': _.get(profile, 'autoProxyUsername'),
                'password': _.get(profile, 'autoProxyPassword'),
            }

            profile.proxy.username = _.get(profile, 'autoProxyUsername');
            profile.proxy.password = _.get(profile, 'autoProxyPassword');
        }
        // console.log('proxy=', proxy);

        if (proxy.mode === 'geolocation') {
            proxy.mode = 'http';
        }

        if (proxy.mode === 'none') {
            proxy = null;
        }
        this.proxy = proxy;

        await this.getTimeZone(proxy).catch((e) => {
            console.error('Proxy Error. Check it and try again.');
            throw e;
        });

        const [latitude, longitude] = this._tz.ll;
        const accuracy = this._tz.accuracy;

        const profileGeolocation = profile.geolocation;
        const tzGeoLocation = {
            latitude,
            longitude,
            accuracy
        };
        profile.geoLocation = this.getGeolocationParams(profileGeolocation, tzGeoLocation);
        profile.name = name;
        profile.name_base64 = Buffer.from(name).toString('base64');
        profile.profile_id = this.profile_id;

        profile.webRtc = {
            mode: _.get(profile, 'webRTC.mode') === 'alerted' ? 'public' : _.get(profile, 'webRTC.mode'),
            publicIP: _.get(profile, 'webRTC.fillBasedOnIp') ? this._tz.ip : _.get(profile, 'webRTC.publicIp'),
            localIps: _.get(profile, 'webRTC.localIps', []),
        };

        debug('profile.webRtc=', profile.webRtc);
        debug('profile.timezone=', profile.timezone);
        debug('profile.mediaDevices=', profile.mediaDevices);

        const audioContext = profile.audioContext || {};
        const { mode: audioCtxMode = 'off', noise: audioCtxNoise} = audioContext;
        if (profile.timezone.fillBasedOnIp == false) {
            profile.timezone = {
                id: profile.timezone.timezone,
                timezone: profile.timezone.timezone,
                fillBasedOnIp: profile.timezone.fillBasedOnIp
            };
        } else {
            profile.timezone = {
                id: this._tz.timezone,
                timezone: this._tz.timezone,
                enabled: profile.timezone.enabled,
                fillBasedOnIp: profile.timezone.fillBasedOnIp
            };
        }
        profile.webgl_noise_value = profile.webGL.noise;
        profile.get_client_rects_noise = profile.webGL.getClientRectsNoise;
        profile.canvasMode = profile.canvas.mode;
        profile.canvasNoise = profile.canvas.noise;
        profile.audioContext = {
            enable: audioCtxMode !== 'off',
            noiseValue: audioCtxNoise,
        };
        profile.webgl = {
            metadata: {
                vendor: _.get(profile, 'webGLMetadata.vendor'),
                renderer: _.get(profile, 'webGLMetadata.renderer'),
                mode: _.get(profile, 'webGLMetadata.mode') === 'mask',
            }
        };

        profile.custom_fonts = {
            enable: !!fonts?.enableMasking,
        }

        const gologin = this.convertPreferences(profile);

        debug(`Writing profile for screenWidth ${profilePath}`, JSON.stringify(gologin));
        gologin.screenWidth = this.resolution.width;
        gologin.screenHeight = this.resolution.height;
        debug("writeCookesFromServer", this.writeCookesFromServer)
        if (this.writeCookesFromServer) {
            await this.writeCookiesToFile();
        }

        if (this.fontsMasking) {
            const families = fonts?.families || [];
            if (!families.length) {
                throw new Error('No fonts list provided');
            }

            try{
                await BrowserUserDataManager.composeFonts(families, profilePath, this.differentOs);
            } catch (e) {
                console.trace(e);
            }
        }

        const [languages] = this.language.split(';');

        if (preferences.gologin==null) {
            preferences.gologin = {};
        }

        preferences.gologin.langHeader = gologin.language;
        preferences.gologin.languages = languages;
        // debug("convertedPreferences=", preferences.gologin)
        await writeFile(path.join(profilePath, 'Default', 'Preferences'), JSON.stringify(_.merge(preferences, {
            gologin
        })));

        // console.log('gologin=', _.merge(preferences, {
        //     gologin
        // }));

        debug('Profile ready. Path: ', profilePath, 'PROXY', JSON.stringify(_.get(preferences, 'gologin.proxy')));
        return profilePath;
    }

    // async spawnBrowser() {
    //     let remote_debugging_port = this.remote_debugging_port;
    //     if (!remote_debugging_port) {
    //         remote_debugging_port = await this.getRandomPort();
    //     }
    //
    //     const profile_path = this.profilePath();
    //
    //     let proxy = this.proxy;
    //     let proxy_host = '';
    //     if (proxy) {
    //         proxy_host = this.proxy.host;
    //         proxy = `${proxy.mode}://${proxy.host}:${proxy.port}`;
    //     }
    //
    //     this.port = remote_debugging_port;
    //
    //     const ORBITA_BROWSER = this.executablePath || this.browserChecker.getOrbitaPath;
    //     debug(`ORBITA_BROWSER=${ORBITA_BROWSER}`)
    //     const env = {};
    //     Object.keys(process.env).forEach((key) => {
    //         env[key] = process.env[key];
    //     });
    //     const tz = await this.getTimeZone(this.proxy).catch((e) => {
    //         console.error('Proxy Error. Check it and try again.');
    //         throw e;
    //     });
    //     env['TZ'] = tz;
    //
    //     if (this.vnc_port) {
    //         const script_path = path.resolve(__dirname, './run.sh');
    //         debug('RUNNING', script_path, ORBITA_BROWSER, remote_debugging_port, proxy, profile_path, this.vnc_port);
    //         execFile(
    //             script_path,
    //             [ORBITA_BROWSER, remote_debugging_port, proxy, profile_path, this.vnc_port, tz],
    //             {env}
    //         );
    //     } else {
    //         const [splittedLangs] = this.language.split(';');
    //         let [browserLang] = splittedLangs.split(',');
    //         if (process.platform === 'darwin') {
    //             browserLang = 'en-US';
    //         }
    //
    //         let params = [
    //             `--remote-debugging-port=${remote_debugging_port}`,
    //             `--user-data-dir=${profile_path}`,
    //             `--password-store=basic`,
    //             `--tz=${tz}`,
    //             `--lang=${browserLang}`,
    //         ];
    //
    //         if (this.extensionPathsToInstall.length) {
    //             if (Array.isArray(this.extra_params) && this.extra_params.length) {
    //                 this.extra_params.forEach((param, index) => {
    //                     if (!param.includes('--load-extension=')) {
    //                         return;
    //                     }
    //
    //                     const [_, extPathsString] = param.split('=');
    //                     const extPathsArray = extPathsString.split(',');
    //                     this.extensionPathsToInstall = [...this.extensionPathsToInstall, ...extPathsArray];
    //                     this.extra_params.splice(index, 1);
    //                 });
    //             }
    //             params.push(`--load-extension=${this.extensionPathsToInstall.join(',')}`);
    //         }
    //
    //         if (this.fontsMasking) {
    //             let arg = '--font-masking-mode=2';
    //             if (this.differentOs) {
    //                 arg = '--font-masking-mode=3';
    //             }
    //             if (this.profileOs === 'android') {
    //                 arg = '--font-masking-mode=1';
    //             }
    //
    //             params.push(arg);
    //         }
    //
    //         if (proxy) {
    //             const hr_rules = `"MAP * 0.0.0.0 , EXCLUDE ${proxy_host}"`;
    //             params.push(`--proxy-server=${proxy}`);
    //             params.push(`--host-resolver-rules=${hr_rules}`);
    //         }
    //
    //         if (Array.isArray(this.extra_params) && this.extra_params.length) {
    //             params = params.concat(this.extra_params);
    //         }
    //
    //         const child = execFile(ORBITA_BROWSER, params, {env});
    //         // const child = spawn(ORBITA_BROWSER, params, { env, shell: true });
    //         child.stdout.on('data', (data) => debug(data.toString()));
    //         debug('SPAWN CMD', ORBITA_BROWSER, params.join(" "));
    //     }
    //
    //     debug('GETTING WS URL FROM BROWSER');
    //
    //     let data = await requests.get(`http://127.0.0.1:${remote_debugging_port}/json/version`, {json: true});
    //
    //     debug('WS IS', _.get(data, 'body.webSocketDebuggerUrl', ''))
    //     this.is_active = true;
    //
    //     this.ws = await this.initWebSocket(_.get(data, 'body.webSocketDebuggerUrl', ''))
    //     return _.get(data, 'body.webSocketDebuggerUrl', '');
    // }

    async spawnBrowser() {
        let pid;
        let remote_debugging_port = this.remote_debugging_port;
        if (!remote_debugging_port) {
            remote_debugging_port = await this.getRandomPort();
        }

        const profile_path = this.profilePath();

        let proxy = this.proxy;
        let proxy_host = '';
        if (proxy) {
            proxy_host = this.proxy.host;
            proxy = `${proxy.mode}://${proxy.host}:${proxy.port}`;
        }

        this.port = remote_debugging_port;

        const ORBITA_BROWSER = this.executablePath || this.browserChecker.getOrbitaPath;
        debug(`ORBITA_BROWSER=${ORBITA_BROWSER}`)
        const env = {};
        Object.keys(process.env).forEach((key) => {
            env[key] = process.env[key];
        });
        const tz = await this.getTimeZone(this.proxy).catch((e) => {
            console.error('Proxy Error. Check it and try again.');
            throw e;
        });
        env['TZ'] = tz;

        if (this.vnc_port) {
            const script_path = path.resolve(__dirname, './run.sh');
            debug('RUNNING', script_path, ORBITA_BROWSER, remote_debugging_port, proxy, profile_path, this.vnc_port);
            execFile(
                script_path,
                [ORBITA_BROWSER, remote_debugging_port, proxy, profile_path, this.vnc_port, tz],
                {env}
            );
        } else {
            const [splittedLangs] = this.language.split(';');
            let [browserLang] = splittedLangs.split(',');
            if (process.platform === 'darwin') {
                browserLang = 'en-US';
            }

            let params = [
                `--remote-debugging-port=${remote_debugging_port}`,
                `--user-data-dir=${profile_path}`,
                `--password-store=basic`,
                `--tz=${tz}`,
                `--lang=${browserLang}`,
            ];

            if (this.extensionPathsToInstall.length) {
                if (Array.isArray(this.extra_params) && this.extra_params.length) {
                    this.extra_params.forEach((param, index) => {
                        if (!param.includes('--load-extension=')) {
                            return;
                        }

                        const [_, extPathsString] = param.split('=');
                        const extPathsArray = extPathsString.split(',');
                        this.extensionPathsToInstall = [...this.extensionPathsToInstall, ...extPathsArray];
                        this.extra_params.splice(index, 1);
                    });
                }
                params.push(`--load-extension=${this.extensionPathsToInstall.join(',')}`);
            }

            if (this.fontsMasking) {
                let arg = '--font-masking-mode=2';
                if (this.differentOs) {
                    arg = '--font-masking-mode=3';
                }
                if (this.profileOs === 'android') {
                    arg = '--font-masking-mode=1';
                }

                params.push(arg);
            }

            if (proxy) {
                const hr_rules = `"MAP * 0.0.0.0 , EXCLUDE ${proxy_host}"`;
                params.push(`--proxy-server=${proxy}`);
                params.push(`--host-resolver-rules=${hr_rules}`);
            }

            if (Array.isArray(this.extra_params) && this.extra_params.length) {
                params = params.concat(this.extra_params);
            }

            const child = spawn(ORBITA_BROWSER, params, {env, shell: true});
            child.stdout.on('data', function (data) {
                console.log(data.toString());
                pid = child
            });

            child.stderr.on('data', function (data) {
                console.log(data.toString());
            });

            child.on('close', async function (code) {
                console.log("EXITED " + code);
                await this.stop()
            });

            // const child = execFile(ORBITA_BROWSER, params, {env});
            // child.stdout.on('data', (data) => debug(data.toString()));
            debug('SPAWN CMD', ORBITA_BROWSER, params.join(" "));
        }

        if(this.waitWebsocket){
        debug('GETTING WS URL FROM BROWSER');

        let data = await requests.get(`http://127.0.0.1:${remote_debugging_port}/json/version`, {json: true});

        debug('WS IS', _.get(data, 'body.webSocketDebuggerUrl', ''))
        this.is_active = true;


        // this.ws = await this.initWebSocket(_.get(data, 'body.webSocketDebuggerUrl', ''))
        return _.get(data, 'body.webSocketDebuggerUrl', ''), pid.pid;
        }
        return '';
    }

    async start() {
        if (this.is_remote) {
            return this.startRemote()
        }

        if (!this.executablePath) {
            await this.checkBrowser();
        }

        const ORBITA_BROWSER = this.executablePath || this.browserChecker.getOrbitaPath;

        const orbitaBrowserExists = await access(ORBITA_BROWSER).then(() => true).catch(() => false);
        if (!orbitaBrowserExists) {
            throw new Error(`Orbita browser is not exists on path ${ORBITA_BROWSER}, check executablePath param`);
        }

        await this.createStartup();
        // await this.createBrowserExtension();
        const {wsUrl, pid} = await this.spawnBrowser();
        this.setActive(true);
        await UpdatePidsDB([this.profile_id, pid])
        return {status: 'success', wsUrl};
    }

    async startLocal() {
        await this.createStartup(true);
        // await this.createBrowserExtension();
        const {wsUrl, pid} = await this.spawnBrowser();
        this.setActive(true);
        await UpdatePidsDB([this.profile_id, pid])
        return {status: 'success', wsUrl};
    }

    async stopAndCommit(options, local = false) {
        if (this.is_stopping) {
            return true;
        }
        const is_posting = options.posting ||
            options.postings || // backward compability
            false;

        if (this.uploadCookiesToServer) {
            await this.uploadProfileCookiesToServer();
        }

        this.is_stopping = true;
        await this.sanitizeProfile();

        if (is_posting) {
            await this.commitProfile();
        }

        this.is_stopping = false;
        this.is_active = false;
        await delay(3000);
        await this.clearProfileFiles();

        if (!local) {
            await rimraf(path.join(this.tmpdir, `gologin_${this.profile_id}.zip`));
        }
        debug(`PROFILE ${this.profile_id} STOPPED AND CLEAR`);

        await DeletePidDB(this.profile_id)
        return false;
    }

    async commitProfile() {
        const dataBuff = await this.getProfileDataToUpdate();

        debug('begin updating', dataBuff.length);
        if (!dataBuff.length) {
            debug('WARN: profile zip data empty - SKIPPING PROFILE COMMIT');

            return;
        }

        try {
            debug('Patching profile');
            await this.patchFile(dataBuff)
            // if (await this.profileExists()) await this.postFile('profile', dataBuff);
        } catch (e) {
            debug('CANNOT COMMIT PROFILE', e);
        }

        debug('COMMIT COMPLETED');
        return path.join(this.tmpdir, this.profile_id, `gologin_${this.profile_id}.zip`)
    }

    async SaveBuffer(dataBuff) {

        debug('begin updating', dataBuff.length);
        if (!dataBuff.length) {
            debug('WARN: profile zip data empty - SKIPPING PROFILE COMMIT');

            return;
        }

        try {
            debug('Patching profile');
            await this.patchFile(dataBuff)
            // if (await this.profileExists()) await this.postFile('profile', dataBuff);
        } catch (e) {
            debug('CANNOT COMMIT PROFILE', e);
        }

        debug('COMMIT COMPLETED');
        return path.join(this.tmpdir, this.profile_id, `gologin_${this.profile_id}.zip`)
    }


}



// middleware that is specific to this router
ProfileRoute.use((req, res, next) => {
    console.log('Time: ', Date.now())
    next()
})
// http://localhost:3000/profile?count=2&option={}&save=''&saveZipAll=''&cpus=''
// define the about route
// ProfileRoute.get('/', async function (req, res) {
//     const count = req.query.count
//     const option = req.query.option || {}
//     const save = req.query.save || undefined
//     const saveZipAll = req.query.saveZipAll || undefined
//     let cpus = req.query.cpus || os.cpus().length
//     const j = await CreatePool(count, option, save, saveZipAll, cpus)
//     res.send(j)
//
// })

ProfileRoute.get('/', function (req, resp) {
    const count = req.query.count
    const option = JSON.parse(req.query.option) || {}
    const save = req.query.save || undefined
    const saveZipAll = req.query.saveZipAll || undefined
    let cpus = req.query.cpus || os.cpus().length
    const j = CreatePool(count, option, save, saveZipAll, cpus)
    resp.send(j)

})

function CreatePool(count, option = {}, save = undefined, saveZipAll = undefined, cpus = os.cpus().length) {
    const TaskProcessor = path.resolve(__dirname, 'CreateTaskProcessor.js')
    if (count < cpus) {
        cpus = count
    }
    const pool = new WorkerPool(cpus, TaskProcessor);


    let finished = 0;
    let res = [];
    let name = (option.name) ? option.name : faker.internet.userName();
    const zip = new AdmZip();
    let resDetails = {};

    for (let i = 0; i < count; i++) {

        let tasks = {};
        if (count > 1) {
            option.name = `${name}_${i + 1}`
            // Todo - Append To folder list (folder list = option.name)
        } else (option.name = name)


        tasks.option = option
        tasks.save = save

        let resDet = {};
        pool.runTask(tasks,
            (err, result) => {
                if (err) return err

                if (count > 1) {
                    zip.addFile(`${result.pid}.zip`, result.buffer, result.pid);
                }

                res.push(result)

                // console.log(result);
                if (++finished === count) {
                    // if( count > 1 ){
                    //     res.buffer = zip.toBuffer()
                    //     // write everything to disk
                    //     if (saveZipAll !== undefined) zip.writeZip(path.join(saveZipAll, `${name}.zip`));
                    // }
                    pool.close();
                    console.log(res);
                }
            });
    }
    return res

}


module.exports = {
    MyGoLogin,
    CreatePool,
    ProfileRoute
}
