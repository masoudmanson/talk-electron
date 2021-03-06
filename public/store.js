const electron = require('electron');
const path = require('path');
const fs = require('fs');

class Store {
    constructor(opts) {
        const userDataPath = (electron.app || electron.remote.app).getPath('userData');
        this.path = path.join(userDataPath, opts.configName + '.json');
        this.data = parseDataFile(this.path, opts.defaults);
    }

    get(key) {
        return this.data[key];
    }

    set(key, val, callback) {
        try {
            this.data[key] = val;
            fs.writeFileSync(this.path, JSON.stringify(this.data));
        } catch (e) {
            console.log(e);
        }
    }
}

function parseDataFile(filePath, defaults) {
    try {
        var result = JSON.parse(fs.readFileSync(filePath));
        return result;
    } catch(error) {
        return defaults;
    }
}

module.exports = Store;
