const _ = require('lodash');
const ProxyAgent = require("simple-proxy-agent");
const requests = require('requestretry').defaults({timeout: 60000});
const https = require('https');
const cheerio = require("cheerio");
const path = require('path');
const WorkerPool = require('./Worker.js');
const os = require('os');
const fs = require("fs");
const {UpdateProxyDB} = require("./database");

class Proxy {
    extraUrls;
    res;
    ip;
    proxyData;

    constructor(proxy) {
        this.proxyData = {
            mode: proxy.mode,
            host: proxy.host,
            port: proxy.port,
        }

        this.proxyData.username = proxy.username || '';
        this.proxyData.password = proxy.password || '';

        this.extraUrls = [`https://scamalytics.com/ip/MYIP`, `https://v2.api.iphub.info/guest/ip/MYIP`]

    }

    async fetchTable(arr, scam, tz, iphub, proxy) {
        const escapeRegExpMatch = function (s) {
            return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        };
        const isExactMatch = (str, match) => {
            return new RegExp(`\\b${escapeRegExpMatch(match)}\\b`).test(str)
        }
        let matchVal = ['Hostname', 'ASN', 'ISP Name', 'Organization Name', 'Connection type',
            'Country Name', 'Country Code', 'Region', 'City', 'Postal Code', 'Metro Code', 'Area Code', 'Latitude', 'Longitude',
            ' HTTP80/http', 'SSL443/ssl/http', ' HTTP-PROXY8080/http-proxy', 'OPSMESSAGING8090/opsmessaging', ' TOR-ORPORT9001/tor-orport', 'TCP9030/tcp/udp', ' SSH22/ssh',
            'Anonymizing VPN', 'Tor Exit Node', 'Server', 'Public Proxy', 'Web Proxy', 'Search Engine Robot',
            'Domain Names'
        ]
        let param = tz ? JSON.parse(tz) : {};


        param["proxy"] = proxy || {};
        param['ping'] = scam.ping || "true";
        param['ipB'] = scam.ip || "n/a";
        param['score'] = scam.score || "n/a";
        param['risk'] = scam.risk || "n/a";

        param['block'] = JSON.parse(iphub).block || "";


        for (let i = 0; i < arr.length; i++) {
            for (let x = 0; x < matchVal.length; x++) {
                const supp = arr[i];
                let match = matchVal[x]
                if (isExactMatch(supp, match)) {
                    const spl = supp.split(match)
                    if (match !== 'Domain Names' && match !== 'City') {
                        param[match.replace(/(\s+)/g, '')] = spl[1].replace(/(\s+)/g, '') || ""
                    } else if (match === 'Domain Names') {
                        i++
                        const domainVal = arr[i];
                        param[match.replace(/(\s+)/g, '')] = domainVal || ""
                    } else if (match === 'City') {
                        param['CityB'] = spl[1].replace(/(\s+)/g, '') || ""
                    }
                }
            }
        }
        return param
    }

    async scamalytics(data, proxy) {
        const [tz, response, iphub] = data
        let table = [];
        try {
            const $ = await cheerio.load(response.body);

            let scam = JSON.parse($('pre').text().replace(/(\s+)/g, ' '));

            $('tr').each((_, e) => {
                let row = $(e).text().replace(/(\s+)/g, ' ');
                table.push(`${row}`);
            });

            return await this.fetchTable(table, scam, tz, iphub.body, proxy)

        } catch (e) {
            console.log('Io', 'on(message) recv a non IoEvent data[%s]', e)
        }
    }

    async getResponse(url, proxyUrl, socks = false) {

        if (url.includes('MYIP')) {
            url = url.replace('MYIP', this.ip)
        }
        if (!socks) {
            try {
                return await requests.get(url, {
                    proxy: proxyUrl,
                    timeout: 1000,
                    maxAttempts: 1
                })
            } catch (e) {
                throw Error(e.message)
            }

        } else {
            const agent = new ProxyAgent(proxyUrl, {tunnel: true, timeout: 10000});

            const checkData = await new Promise((resolve, reject) => {
                https.get(url, {agent}, (res) => {
                    let resultResponse = '';
                    res.on('data', (data) => resultResponse += data);

                    res.on('end', () => {
                        let parsedData;
                        try {
                            parsedData = JSON.parse(resultResponse);
                        } catch (e) {
                            reject(e);
                        }

                        resolve({
                            ...res,
                            body: parsedData,
                        });
                    });
                }).on('error', (err) => reject(err));
            });

            // console.log('checkData:', checkData);
            body = checkData.body || {};
            if (!body.ip && checkData.statusCode.toString().startsWith('4')) {
                throw checkData;
            }
            return checkData;

        }
    }

    async waitForPromises(promises, result) {
        try {
            for (const resPromise of promises) {
                result.push(await resPromise)
            }
        } catch (e) {
            console.log(e)
        }

        return result
    }

    async getTimeZoneAll(proxy = this.proxyData) {
        // debug('getting timeZone proxy=', proxy);
        let socks = false;
        const {mode = 'http', host, port, username = '', password = ''} = proxy;
        let proxyUrl = mode + '://';
        if (username) {
            const resultPassword = password ? ':' + password + '@' : '@';
            proxyUrl += username + resultPassword;
        }
        proxyUrl += host + ':' + port;


        if (proxy.mode.includes('socks')) {
            socks = true
        }

        if (!proxy || proxy.mode === "none") {
            proxyUrl = ""
        }
        proxy.url = proxyUrl
        const empty = 'n/a';

        const result = []
        let promises = "";
        let RES;
        await this.getResponse('https://time.gologin.com/timezone', proxyUrl, socks)
            .then(a => {
                result.push(a.body);
                this.ip = JSON.parse(a.body).ip
            })
            .then(() => promises = this.extraUrls.map(url => this.getResponse(url, proxyUrl, socks)))
            .then(() => this.waitForPromises(promises, result))
            .then(r => this.scamalytics(r, proxy))
            .then(res => RES = {
                // proxy: {
                mode: proxy.mode || empty,
                host: proxy.host || empty,
                port: proxy.port || empty,
                username: proxy.username || empty,
                password: proxy.password || empty,
                url: proxy.url || empty,
                // },
                ip: res.ip || empty,
                timezone: res.timezone || empty,
                accuracy: res.accuracy || empty,
                Latitude: res.ll[0] || empty,
                longitude: res.ll[1] || empty,
                // ll: [res.ll[0] || empty, res.ll[1] || ''],
                country: res.country || empty,
                city: res.city || empty,
                stateProv: res.stateProv || empty,
                proxyType: res.proxyType || empty,
                ping: res.ping || empty,
                ipB: res.ipB || empty,
                score: res.score || empty,
                risk: res.risk || empty,
                block: res.block === 0 ? 'false' : 'true' || empty,
                Hostname: res.Hostname || empty,
                ASN: res.ASN || empty,
                ISPName: res.ISPName || empty,
                OrganizationName: res.OrganizationName || empty,
                Connectiontype: res.Connectiontype || empty,
                CountryName: res.CountryName || empty,
                CountryCode: res.CountryCode || empty,
                Region: res.Region || empty,
                CityB: res.CityB || empty,
                PostalCode: res.PostalCode || empty,
                MetroCode: res.MetroCode || empty,
                AreaCode: res.AreaCode || empty,
                LatitudeB: res.LatitudeB || empty,
                longitudeB: res.longitudeB || empty,
                SSL443sslhttp: res.SSL443sslhttp || empty,
                OPSMESSAGING8090opsmessaging: res.OPSMESSAGING8090opsmessaging || empty,
                TCP9030tcpudp: res.TCP9030tcpudp || empty,
                AnonymizingVPN: res.AnonymizingVPN || empty,
                TorExitNode: res.TorExitNode || empty,
                Server: res.Server || empty,
                PublicProxy: res.PublicProxy || empty,
                WebProxy: res.WebProxy || empty,
                SearchEngineRobot: res.SearchEngineRobot || empty,
                DomainNames: res.DomainNames || empty
            })
            .catch(err => RES = {
                // proxy: {
                mode: proxy.mode || empty,
                host: proxy.host || empty,
                port: proxy.port || empty,
                username: proxy.username || empty,
                password: proxy.password || empty,
                url: proxy.url || empty,
                // },
                ip: empty,
                timezone: empty,
                accuracy: empty,
                Latitude: empty,
                longitude: empty,
                // ll: [empty, empty],
                country: empty,
                city: empty,
                stateProv: empty,
                proxyType: empty,
                ping: err.message || empty,
                ipB: empty,
                score: empty,
                risk: empty,
                block: empty,
                Hostname: empty,
                ASN: empty,
                ISPName: empty,
                OrganizationName: empty,
                Connectiontype: empty,
                CountryName: empty,
                CountryCode: empty,
                Region: empty,
                CityB: empty,
                PostalCode: empty,
                MetroCode: empty,
                AreaCode: empty,
                LatitudeB: empty,
                longitudeB: empty,
                SSL443sslhttp: empty,
                OPSMESSAGING8090opsmessaging: empty,
                TCP9030tcpudp: empty,
                AnonymizingVPN: empty,
                TorExitNode: empty,
                Server: empty,
                PublicProxy: empty,
                WebProxy: empty,
                SearchEngineRobot: empty,
                DomainNames: empty
            })
            .then(() => this.res = RES)

        return this.res

    }


}


async function getProxyData(proxy) {
    try {
        const PXY = new Proxy(proxy)
        return await PXY.getTimeZoneAll().catch(e => console.log(e))
    } catch (e) {
        console.log(e)
    }

}

function ProxyPool(mode, proxyUrls, file = false, cpus = os.cpus().length) {
    const TaskProcessor = path.resolve(__dirname, 'ProxyTaskProcessor.js')
    const pool = new WorkerPool(cpus, TaskProcessor) ;
    let Proxies;
    
    if(!mode) throw new Error('Proxy Mode Not Defined')
    
    if(file){
        try {
            Proxies = fs.readFileSync(proxyUrls, 'utf-8').split(/\r?\n/);
        } catch (e) {
            throw new Error(e.message)
        }
    } else if (!file) {
        Proxies = proxyUrls.split(/\r?\n/);
    } else{
        throw new Error('Proxy Not Defined')
    }
    let finished = 0;
    // let res = [];
    for (let i = 0; i < Proxies.length; i++) {
        if (Proxies[i].split(':')[0] !== '' && Proxies[i].split(':')[1] !== '') {
            const PXY = {
                mode: mode,
                host: Proxies[i].split(':')[0],
                port: Proxies[i].split(':')[1],
            }
            if (Proxies[i].split(':')[2] || Proxies[i].split(':')[2] !== '') PXY.username = Proxies[i].split(':')[2];
            if (Proxies[i].split(':')[3] || Proxies[i].split(':')[3] !== '') PXY.password = Proxies[i].split(':')[3];
            
            pool.runTask(PXY,
                (err, result) => {
                    // res.push(result)
                    UpdateProxyDB(result).then(m => console.log(m))
                    console.log(result);
                    if (++finished === Proxies.length) {
                        pool.close();
                    }
                });
        }
    }
}

module.exports = {
    getProxyData,
    ProxyPool
}
