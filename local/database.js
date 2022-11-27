const Database = require("better-sqlite3");
const config = require("./config")
let db;

class DB {
    proxydb;
    pidsdb;


    constructor(dbPath, sql) {
        db = new Database(dbPath, {verbose: console.log});

        // const sql = `
        //     CREATE TABLE IF NOT EXISTS proxy
        //     (
        //         host                         VARCHAR(256) PRIMARY KEY NOT NULL,
        //         port                         VARCHAR(256),
        //         mode                         VARCHAR(256),
        //         username                     VARCHAR(256),
        //         password                     VARCHAR(256),
        //         url                          VARCHAR(256),
        //         used                         BOOLEAN,
        //         profileId                    VARCHAR(256),
        //         timezone                     VARCHAR(256),
        //         accuracy                     VARCHAR(256),
        //         Latitude                     VARCHAR(256),
        //         longitude                    VARCHAR(256),
        //         country                      VARCHAR(256),
        //         city                         VARCHAR(256),
        //         stateProv                    VARCHAR(256),
        //         proxyType                    VARCHAR(256),
        //         ping                         VARCHAR(256),
        //         ip                           VARCHAR(256),
        //         ipB                          VARCHAR(256),
        //         score                        VARCHAR(256),
        //         risk                         VARCHAR(256),
        //         block                        BOOLEAN,
        //         Hostname                     VARCHAR(256),
        //         ASN                          VARCHAR(256),
        //         ISPName                      VARCHAR(256),
        //         OrganizationName             VARCHAR(256),
        //         Connectiontype               VARCHAR(256),
        //         CountryName                  VARCHAR(256),
        //         CountryCode                  VARCHAR(256),
        //         Region                       VARCHAR(256),
        //         CityB                        VARCHAR(256),
        //         PostalCode                   VARCHAR(256),
        //         MetroCode                    VARCHAR(256),
        //         AreaCode                     VARCHAR(256),
        //         LatitudeB                    VARCHAR(256),
        //         longitudeB                   VARCHAR(256),
        //         SSL443sslhttp                VARCHAR(256),
        //         OPSMESSAGING8090opsmessaging VARCHAR(256),
        //         TCP9030tcpudp                VARCHAR(256),
        //         AnonymizingVPN               VARCHAR(256),
        //         TorExitNode                  VARCHAR(256),
        //         Server                       VARCHAR(256),
        //         PublicProxy                  VARCHAR(256),
        //         WebProxy                     VARCHAR(256),
        //         SearchEngineRobot            VARCHAR(256),
        //         DomainNames                  VARCHAR(256)
        //     )`

        db.exec(sql);

    }
    
    async UpdateProxy(aData) {
        let languages = [];
        let values = [];
        for (const key in aData) {
            const value = aData[key];
            languages.push(key)
            values.push(value)

        }
        // construct the insert statement with multiple placeholders
        // based on the number of rows
        let placeholders = languages.map((language) => '(?)').join(',');
        let sql = 'INSERT or REPLACE INTO proxy (' + languages + ') VALUES(' + placeholders + ')';
        const stmt = db.prepare(sql)
        const state = stmt.run(values);
        // console.log(state)
        return state

    }
    
    async UpdatePids(aData) {

        // construct the insert statement with multiple placeholders
        // based on the number of rows
        let sql = 'INSERT or REPLACE INTO pids ( pid, profileId ) VALUES(?,?)';
        const stmt = db.prepare(sql)
        const state = stmt.run(aData);
        // console.log(state)
        return state

    }
    
    async DeletePid(profile_id) {

        // construct the insert statement with multiple placeholders
        // based on the number of rows
        let sql = 'INSERT or REPLACE INTO pids ( pid, profileId ) VALUES(?,?)';
        const stmt = db.prepare(sql)
        const state = stmt.run(aData);
        // console.log(state)
        return state

    }

    async getProxyBy(target, req, select = '*') {
        return db.prepare('SELECT ${select} FROM proxy WHERE ${target} = ?').get(req)
    }

    async closeDB() {
        return db.close();
    }

}

async function UpdateProxyDB(aData, dbPath= config.GoDB) {
    const sql = `
            CREATE TABLE IF NOT EXISTS proxy
            (
                host                         VARCHAR(256) PRIMARY KEY NOT NULL,
                port                         VARCHAR(256),
                mode                         VARCHAR(256),
                username                     VARCHAR(256),
                password                     VARCHAR(256),
                url                          VARCHAR(256),
                used                         BOOLEAN,
                profileId                    VARCHAR(256),
                timezone                     VARCHAR(256),
                accuracy                     VARCHAR(256),
                Latitude                     VARCHAR(256),
                longitude                    VARCHAR(256),
                country                      VARCHAR(256),
                city                         VARCHAR(256),
                stateProv                    VARCHAR(256),
                proxyType                    VARCHAR(256),
                ping                         VARCHAR(256),
                ip                           VARCHAR(256),
                ipB                          VARCHAR(256),
                score                        VARCHAR(256),
                risk                         VARCHAR(256),
                block                        BOOLEAN,
                Hostname                     VARCHAR(256),
                ASN                          VARCHAR(256),
                ISPName                      VARCHAR(256),
                OrganizationName             VARCHAR(256),
                Connectiontype               VARCHAR(256),
                CountryName                  VARCHAR(256),
                CountryCode                  VARCHAR(256),
                Region                       VARCHAR(256),
                CityB                        VARCHAR(256),
                PostalCode                   VARCHAR(256),
                MetroCode                    VARCHAR(256),
                AreaCode                     VARCHAR(256),
                LatitudeB                    VARCHAR(256),
                longitudeB                   VARCHAR(256),
                SSL443sslhttp                VARCHAR(256),
                OPSMESSAGING8090opsmessaging VARCHAR(256),
                TCP9030tcpudp                VARCHAR(256),
                AnonymizingVPN               VARCHAR(256),
                TorExitNode                  VARCHAR(256),
                Server                       VARCHAR(256),
                PublicProxy                  VARCHAR(256),
                WebProxy                     VARCHAR(256),
                SearchEngineRobot            VARCHAR(256),
                DomainNames                  VARCHAR(256)
            )`
    if(this.proxydb === undefined) this.proxydb = new DB(dbPath,sql)
    const state = await this.proxydb.UpdateProxy(aData);
    // const result = dbObj.UpdateProxy(aData)
    await this.proxydb.closeDB()
    return state
}

async function UpdatePidsDB(aData) {
    const sql = `
            CREATE TABLE IF NOT EXISTS pids
            (
                pid                         VARCHAR(256) PRIMARY KEY NOT NULL,
                profileId                    VARCHAR(256)
            )`
    if(this.pidsdb === undefined) this.pidsdb = new DB(":memory:",sql)
    const state = await this.pidsdb.UpdatePids(aData);
    // const result = dbObj.UpdateProxy(aData)
    await this.pidsdb.closeDB()
    return state
}

async function DeletePidDB(profile_id) {
    const state = await this.pidsdb.DeletePid(profile_id);
    // const result = dbObj.UpdateProxy(aData)
    await dbObj.closeDB()
    return state
}

async function getProxyBy(target, req, dbPath) {
    const dbObj = new DB(dbPath)
    const result = dbObj.getProxyBy(target, req)
    await dbObj.closeDB()
    return result
}

module.exports = {
    UpdateProxyDB,
    getProxyBy,
    UpdatePidsDB,
    DeletePidDB
}
