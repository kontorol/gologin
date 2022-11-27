const { parentPort } = require('worker_threads');
const {getProxyData} = require("./ProxyCheck");
parentPort.on('message', async (task) => {
    const response = await getProxyData(task);
    parentPort.postMessage(response);
});