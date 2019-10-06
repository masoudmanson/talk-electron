const {app, Menu, Tray, BrowserWindow, ipcMain, protocol} = require('electron');
const path = require("path");
const isDev = require("electron-is-dev");
const notifier = require('node-notifier');
const fs = require('fs');
const request = require('request');
const url = require('url');
const passport = require('passport-oauth2');
// const Auth = require('podauth');

let mainWindow;
let mainWindowFocus = false;
let deeplinkingUrl;
const gotTheLock = app.requestSingleInstanceLock();

logEverywhere('ElectronJS main - Aval man load shodam ' + new Date());

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
            if (mainWindow.isMinimized() || !mainWindow.isVisible()) {
                mainWindow.restore();
            }

            mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    app.setAppUserModelId("talk.pod.land");
    app.setAsDefaultProtocolClient('talk');
    protocol.registerSchemesAsPrivileged([{
        scheme: 'talk',
        privileges: {standard: true, secure: true, supportFetchAPI: true}
    }]);

    app.on('will-finish-launching', function () {
        app.on('open-url', function (event, url) {
            event.preventDefault();
            deeplinkingUrl = url;
            logEverywhere("open-url# " + deeplinkingUrl);
        });
    });

    app.on("ready", function () {
        logEverywhere('App ready shod!');
        protocol.registerHttpProtocol('talk', (request) => {
            logEverywhere('Ye Req az samte talk:// umad');
            logEverywhere(request);
            // logEverywhere('Quit the mother fuciking app');
            //
            // mainWindow = null;
            // app.isQuiting = true;
            // app.quit();

            try {
                let finalUrl = url.parse(request.url);
                logEverywhere("finalUrl" + JSON.stringify(finalUrl));
                mainWindow.webContents.send('authCode', {code: finalUrl.query.substring(5)});
                if (finalUrl.path.match(/\?code/)) {
                    logEverywhere('Fuckee contains Code');
                    mainWindow.webContents.send('authCode', {code: finalUrl.query.substring(5)});
                }
            } catch (e) {
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

    ipcMain.on('noToken', () => {
        logEverywhere('Get a fuckin token');
        // mainWindow.webContents.send('authToken', {token: '6aab4fbf9d09445e8c1be54592b45047'});
        // Auth.auth({
        //     codeVerifierStr: '23fvxct43twegs34',
        //     clientId: "88413l69cd4051a039cf115ee4e073",
        //     scope: "social:write",
        //     redirectUri: "talk://login",
        //     timeRemainingTimeout: 800,
        //     onNewToken: token => {
        //         mainWindow.webContents.send('authToken', {token: token});
        //     }
        // });

        passport.use(new passport.OAuth2Strategy({
                authorizationURL: 'https://accounts.pod.land/oauth2',
                tokenURL: 'https://accounts.pod.land/oauth2/token',
                clientID: "88413l69cd4051a039cf115ee4e073",
                clientSecret: "371d2407",
                callbackURL: "talk://login"
            },
            function(accessToken, refreshToken, profile, cb) {
                console.log(accessToken, refreshToken, profile, cb);
            }
        ));
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
        frame: false,
        show: false,
        titleBarStyle: 'customButtonsOnHover',
        transparent: true,
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

    mainWindow.on('ready-to-show', function(){
        mainWindow.show();
    });

    // mainWindow.webContents.on('did-get-redirect-request', function (event, oldUrl, newUrl) {
    //     logEverywhere("Take these bullshit" + event + "*************" + oldUrl + "*************" + newUrl);
    // });

    mainWindow.webContents.openDevTools();

    if (process.platform == 'win32') {
        deeplinkingUrl = process.argv.slice(1);
    }
    logEverywhere("createWindow# " + deeplinkingUrl);
    //
    // var appIcon = null;
    // appIcon = new Tray(__dirname + '/logo192.png');
    //
    // appIcon.on('click', () => {
    //     mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    // })
    //
    // var contextMenu = Menu.buildFromTemplate([
    //     {
    //         label: 'Open Talk', click: function () {
    //             mainWindow.show();
    //         }
    //     },
    //     {
    //         label: 'Quit', click: function () {
    //             mainWindow = null;
    //             app.isQuiting = true;
    //             app.quit();
    //         }
    //     }
    // ]);
    //
    // appIcon.setToolTip('Talk Desktop');
    // appIcon.setContextMenu(contextMenu);

    mainWindow.on("closed", () => (mainWindow = null));

    mainWindow.on('close', function (event) {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }

        return false;
    });

    // mainWindow.on('show', function () {
    //     appIcon.setHighlightMode('always');
    // });
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
