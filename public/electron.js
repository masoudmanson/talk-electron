const {app, Menu, Tray, BrowserWindow, ipcMain, protocol} = require('electron');
const path = require("path");
const isDev = require("electron-is-dev");
const notifier = require('node-notifier');
const fs = require('fs');
const request = require('request');
const url = require('url');

let mainWindow;
let mainWindowFocus = false;
let deeplinkingUrl;
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
    return;
} else {
    app.on('second-instance', (event, argv, workingDirectory) => {
        if (process.platform == 'win32') {
            deeplinkingUrl = argv.slice(1);
        }
        logEverywhere("argv ==== " + argv);
        logEverywhere(argv);
        logEverywhere("app.makeSingleInstance# " + deeplinkingUrl);

        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }

            mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.setAppUserModelId("Talk-Desktop");
    app.setAsDefaultProtocolClient('talk');
    protocol.registerSchemesAsPrivileged([{ scheme: 'talk', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

    app.on('will-finish-launching', function () {
        app.on('open-url', function (event, url) {
            event.preventDefault();
            deeplinkingUrl = url;
            logEverywhere("open-url# " + deeplinkingUrl);
        });
    });

    app.on("ready", function () {
        protocol.registerHttpProtocol('talk', (request) => {

            logEverywhere(request);
            try {
                let finalUrl = url.parse(request.url);
                logEverywhere("finalUrl" + finalUrl);
                if (finalUrl.path.match(/login\/\?code/)) {
                    // Get code from url query and send code to ipcMain event
                    logEverywhere('Some shit has happened');
                    // authenticator.fetchToken(url.query.split('=')[1]);
                }
            } catch(e) {
                logEverywhere(e);
            }
        });
        createWindow();
    });

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            app.quit();
        }
    });

    app.on("activate", () => {
        if (mainWindow === null) {
            createWindow();
            mainWindowFocus = true;
        }
    });

    app.on('browser-window-focus', () => {
        mainWindowFocus = true;
    });

    app.on('browser-window-blur', () => {
        mainWindowFocus = false;
    });

    ipcMain.on('notify', (event, msg, name, img) => {
        download(img, name, function (icon) {
            if (icon) {
                let message = (msg && msg.length) ? msg.replace(/:emoji#common-telegram#.\d+..\d+:/gi, '⚪️') : msg;

                if (!mainWindow.isVisible()) {
                    notifier.notify({
                        appName: 'Talk-Desktop',
                        title: name,
                        message: message,
                        icon: icon,
                        wait: true
                    }, function () {
                        // mainWindow.show();
                    }).on('click', function () {
                        mainWindow.show();
                    });
                }
            }
        });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 700,
        minHeight: 550,
        minWidth: 350,
        // frame: false,
        // titleBarStyle: 'customButtonsOnHover',
        // transparent: true,
        webPreferences: {
            nodeIntegration: true
        }
    });

    mainWindow.removeMenu();

    mainWindow.loadURL(isDev ? "http://localhost:3000" : url.format({
        pathname: path.join(__dirname, '../build/index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // mainWindow.webContents.on('did-get-redirect-request', function (event, oldUrl, newUrl) {
    //     logEverywhere("Take these bullshit" + event + "*************" + oldUrl + "*************" + newUrl);
    // });

    mainWindow.webContents.openDevTools();

    if (process.platform == 'win32') {
        deeplinkingUrl = process.argv.slice(1);
    }
    logEverywhere("createWindow# " + deeplinkingUrl);

    var appIcon = null;
    appIcon = new Tray(__dirname + '/logo192.png');

    appIcon.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    })

    var contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open Talk', click: function () {
                mainWindow.show();
            }
        },
        {
            label: 'Quit', click: function () {
                mainWindow = null;
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);

    appIcon.setToolTip('Talk Desktop');
    appIcon.setContextMenu(contextMenu);

    mainWindow.on("closed", () => (mainWindow = null));

    mainWindow.on('close', function (event) {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }

        return false;
    });

    mainWindow.on('show', function () {
        appIcon.setHighlightMode('always');
    });
}

var download = function (uri, filename, callback) {
    callback(path.join(__dirname, 'talk.png'));
    return;

    // request.head(uri, function (err, res, body) {
    //     if (res.headers["content-disposition"]) {
    //         var fileExtension = res.headers["content-disposition"].split(".").pop().slice(0, -1);
    //         var icon = path.join(__dirname, 'temp', filename + '.' + fileExtension);
    //
    //         request(uri).pipe(fs.createWriteStream(icon)).on('close', () => {
    //             callback(icon);
    //         });
    //     } else {
    //         callback(false);
    //     }
    // });
};

function logEverywhere(s) {
    console.log(s);
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.executeJavaScript(`console.log(${JSON.stringify(s)})`);
    }
}
