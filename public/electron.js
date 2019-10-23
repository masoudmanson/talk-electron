const {app, Menu, Tray, nativeImage, BrowserWindow, ipcMain, protocol, remote, shell} = require('electron');
const path = require("path");
const isDev = require("electron-is-dev");
const notifier = require('node-notifier');
const url = require('url');
const Store = require('./store.js');
const PKCE = require('./pkce.js');
const { autoUpdater } = require('electron-updater');
//
// autoUpdater.setFeedURL({
//     provider: 'github',
//     repo: 'talk-electron',
//     owner: 'masoudmanson',
//     token: '',
//     private: false
// });

const store = new Store({
    configName: 'user-preferences',
    defaults: {
        windowBounds: {width: 1200, height: 700},
        codeVerifier: '',
        refreshToken: '',
        nightMode: false
    }
});

const Auth = new PKCE({
    clientId: "88413l69cd4051a039cf115ee4e073",
    scope: "social:write",
    redirectUri: "talk://login",
    timeRemainingTimeout: 300,
    onNewToken: token => {
        mainWindow.webContents.send('authToken', {token: token});
    }
});

var appIcon = null;
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
        });
    });

    app.on("ready", function () {
        protocol.registerHttpProtocol('talk', (request) => {
            try {
                let finalUrl = url.parse(request.url);
                if (finalUrl.path.match(/\?code/)) {
                    Auth.setCode(finalUrl.query.substring(5));
                }
            } catch (e) {
                logEverywhere(e);
            }
        });

        createWindow();

        const iconPath = path.join(__dirname, '/assets/tray.png');
        appIcon = new Tray(nativeImage.createFromPath(iconPath));

        appIcon.on('click', () => {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        })

        var contextMenu = Menu.buildFromTemplate([
            {
                label: 'مشاهده تاک', click: function () {
                    mainWindow.show();
                }
            },
            {
                label: 'بستن', click: function () {
                    mainWindow = null;
                    app.isQuiting = true;
                    app.quit();
                }
            }
        ]);

        appIcon.setToolTip('Talk Desktop');
        appIcon.setContextMenu(contextMenu);

        console.log('Checking for new Updates through auto updater *****');
        autoUpdater.checkForUpdatesAndNotify();
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
        console.log('noToken IPC Message');
        Auth.auth();
    });

    ipcMain.on('noToken2', () => {
        console.log('noToken2 IPC Message Called At', new Date());
        // Auth.auth();
    });

    ipcMain.on('quit-app', () => {
        mainWindow = null;
        app.isQuiting = true;
        app.quit();
    });

    ipcMain.on('openTalk', () => {
        mainWindow.show();
    });

    ipcMain.on('signout-app', () => {
        // mainWindow.webContents.send('authToken', {token: null});
        // Auth.signOut();
    });

    ipcMain.on('nightMode', (event, nightMode) => {
        store.set('nightMode', nightMode.toString());
    });

    ipcMain.on('notify', (event, msg, name, img) => {
        download(img, name, function (icon) {
            if (icon) {
                let message = (msg && msg.length) ? msg.replace(/:emoji#common-telegram#.\d+..\d+:/gi, '⚪️') : msg;

                if (!mainWindow.isVisible()) {
                    notifier.notify({
                        appName: 'talk.pod.land',
                        title: name,
                        message: message,
                        icon: icon
                    }, function () {
                        // Do something after notification has been send
                    });

                    notifier.on('click', function () {
                        mainWindowFocus = true;
                        mainWindow.show();
                        mainWindow.focus();
                    });
                }
            }
        });
    });

    ipcMain.on('app-version', (event) => {
        mainWindow.webContents.send('app-version', { version: app.getVersion() });
    });

    autoUpdater.on('update-available', () => {
        console.log('update-available with auto updater ', new Date());
        mainWindow.webContents.send('update-available');
    });

    autoUpdater.on('update-downloaded', () => {
        console.log('update-downloaded with auto updater ', new Date());
        mainWindow.webContents.send('update-downloaded');
    });

    ipcMain.on('restart-app', () => {
        autoUpdater.quitAndInstall();
    });
}

function createWindow() {
    let {width, height} = store.get('windowBounds');

    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        minHeight: 550,
        minWidth: 350,
        frame: false,
        show: false,
        hasShadow: true,
        titleBarStyle: 'customButtonsOnHover',
        webPreferences: {
            nodeIntegration: true
        }
    });

    mainWindow.removeMenu();
    // mainWindow.webContents.openDevTools();

    mainWindow.loadURL(isDev ? "http://localhost:3000" : url.format({
        pathname: path.join(__dirname, '../build/index.html'),
        protocol: 'file:',
        slashes: true
    }));

    mainWindow.on('ready-to-show', function () {
        setTimeout(() => {
            mainWindow.show();
            mainWindow.webContents.send('nightMode', store.get('nightMode'));
        }, 50);
    });

    mainWindow.webContents.on('new-window', function (event, url) {
        event.preventDefault();
        shell.openItem(url);
    });

    if (process.platform == 'win32') {
        deeplinkingUrl = process.argv.slice(1);
    }

    mainWindow.on("closed", () => (mainWindow = null));

    mainWindow.on('close', function (event) {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }

        return false;
    });

    mainWindow.on('resize', () => {
        let {width, height} = mainWindow.getBounds();
        store.set('windowBounds', {width, height});
    });
}

var download = function (uri, filename, callback) {
    callback(path.join(__dirname, '/assets/apple-touch.png'));
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
