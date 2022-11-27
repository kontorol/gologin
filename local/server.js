const WorkerPool = require('./Worker.js');
const os = require('os');
const fs = require("fs");
const {UpdateProxyDB} = require("./database");

function Pool(TaskProcessor, task, cpus) {
    const pool = (cpus) ? new WorkerPool(cpus, TaskProcessor) : new WorkerPool(os.cpus().length, TaskProcessor);
    let finished = 0;
    let res = [];

    pool.runTask(task,
        (err, result) => {
            res.push(result)
            // console.log(result);
            if (++finished === Proxies.length) {
                pool.close();
            }
        });
    return res
}


module.exports = {
    Pool
}