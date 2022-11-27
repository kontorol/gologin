const {resolve} = require('path');
const {readdir, readFile} = require('fs').promises;
const fs = require('fs');
const path = require('path');
const os = require("os");
const AdmZip = require("adm-zip");

class Profiles {
    profilePath;
    path;
    xml;
    isMulti = true

    constructor(url, multi = true) {
        this.path = url
        this.xml = [];
        this.isMulti = multi
        if (multi) {
            this.xml.profiles = [];
            this.xml.allProfilesCount = "0";
            this.xml.currentOrbitaMajorV = "10";
            this.xml.currentBrowserV = "100.0.4896.60";
            this.xml.currentTestBrowserV = "102.0.5005.61";
            this.xml.currentTestOrbitaMajorV = "12";
        }
    }
    
    async getContents(dir = this.path) {
        const dirList = await readdir(dir, {withFileTypes: true})
        const files = await Promise.all(dirList.map(async (dirent) => {
            const res = resolve(dir, dirent.name);
            if (dirent.isDirectory()) {
                if ((dirent.name.length == 24) && fs.existsSync(path.join(res, 'Default', 'Preferences'))) {
                    return res
                } else {
                    return await this.getContents(res)
                }
                // todo    
                //} else if(dirent.isFile() && dirent.name.startsWith("gologin_") && (dirent.name.length == 36) && dirent.name.endsWith(".zip")){
            } else if (dirent.isFile() && dirent.name.endsWith(".zip")) {
                return res
            }
        }));
        return files.flat().filter(function (item) {
            return typeof item !== 'undefined';
        });

    }

    async isTrue(obj) {
        if (!obj) return false;
        return true;
    }

    async readZipArchive(filepath) {
        try {
            const zip = new AdmZip(filepath);

            for (const zipEntry of zip.getEntries()) {
                console.log(zipEntry.entryName)
                if (zipEntry.entryName == "Default/Preferences") {
                    //console.log(zipEntry.getData().toString("utf8"));
                    return zipEntry.getData().toString("utf8")
                    break
                }
            }
        } catch (e) {
            console.log(`Something went wrong. ${e}`);
        }
    }

    async getPref(multi) {
        this.profilePath = await this.getContents(this.path);
        await Promise.all(await this.profilePath.map(async (dirent) => {
            let preferences_raw = ""
            if (dirent.endsWith(".zip")) {
                preferences_raw = await this.readZipArchive(dirent);
            } else {
                preferences_raw = await readFile(path.join(dirent, 'Default', "Preferences"));
            }
            let preferences = await JSON.parse(preferences_raw.toString());
            console.log(preferences)
            multi ? await this.appendToXml(preferences) : this.xml = preferences.gologin;
        }));
        return this.xml
    }

    async appendToXml(preferences) {
        let tzIpBase = await this.isTrue(preferences.gologin.timezone.fillBasedOnIp ?? true);
        if (tzIpBase === true) {
            preferences.gologin.timezone.id = ""
        }
        let geoIpBase = await this.isTrue(preferences.gologin.geoLocation.fillBasedOnIp ?? true);
        if (geoIpBase === true) {
            preferences.gologin.geoLocation.longitude = 0;
            preferences.gologin.geoLocation.latitude = 0
        } else {
            preferences.gologin.geoLocation.fillBasedOnIp = false
        }
        let OS_PLATFORM = "";
        if (preferences.gologin.navigator.platform.toLowerCase() === 'win32') {
            OS_PLATFORM = 'win'
        } else if (preferences.gologin.navigator.platform === 'darwin') {
            OS_PLATFORM = 'mac'
        } else if (preferences.gologin.navigator.platform === 'linux') {
            OS_PLATFORM = 'lin'
        }

        this.xml.profiles.push({
            name: preferences.gologin.name,
            role: preferences.gologin.role ?? "owner",
            id: preferences.gologin.id,
            notes: preferences.gologin.notes ?? "auto generated",
            browserType: preferences.gologin.browserType ?? "chrome",
            lockEnabled: preferences.gologin.lockEnabled ?? false,
            timezone: {
                fillBasedOnIp: tzIpBase,
                timezone: preferences.gologin.timezone.id
            },
            navigator: {
                userAgent: preferences.gologin.userAgent,
                resolution: preferences.gologin.navigator.resolution ?? "",
                language: preferences.gologin.langHeader ?? ""
            },
            geolocation: {
                mode: preferences.gologin.geoLocation.mode ?? "prompt",
                enabled: preferences.gologin.geoLocation.enabled ?? true,
                customize: preferences.gologin.geoLocation.customize ?? true,
                fillBasedOnIp: geoIpBase,
                latitude: preferences.gologin.geoLocation.latitude,
                longitude: preferences.gologin.geoLocation.longitude,
                accuracy: preferences.gologin.geoLocation.accuracy ?? 10
            },
            canBeRunning: preferences.gologin.canBeRunning ?? true,
            os: OS_PLATFORM,
            proxy: {
                mode: preferences.gologin.proxy.mode ?? "none",
                port: preferences.gologin.proxy.port ?? 80,
                autoProxyRegion: preferences.gologin.proxy.autoProxyRegion ?? "us",
                torProxyRegion: preferences.gologin.proxy.torProxyRegion ?? "us",
                host: preferences.gologin.proxy.host ?? "",
                username: preferences.gologin.proxy.username ?? "",
                password: preferences.gologin.proxy.password ?? ""
            },
            sharedEmails: [],
            shareId: preferences.gologin.shareId ?? "",
            createdAt: preferences.gologin.createdAt ?? "",
            updatedAt: preferences.gologin.updatedAt ?? "",
            chromeExtensions: [],
            userChromeExtensions: []
        })
        this.xml.allProfilesCount++
    }

}

// asynchronous factory function
async function getLocalProfiles(url, multi) {
    const ProfilesXml = new Profiles(url, multi)
    return await ProfilesXml.getPref(multi)
}

module.exports = {
    getLocalProfiles
}

