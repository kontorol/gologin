const { parentPort } = require('worker_threads');
const {getProxyData} = require("./ProxyCheck");
const config = require("./Config")
const {MyGoLogin} = require("./GetProfile");

parentPort.on('message', async (task) => {

    task.option.token = (task.token !== undefined) ? task.token : config.GoToken;
    const GL = new MyGoLogin(task.option);
    //
    // // next parameters are required for creating
    const wss = await GL.createLocalProfile(JSON.stringify(task.option),task.save);
    parentPort.postMessage(wss);
});