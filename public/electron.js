const {app, Menu, Tray, BrowserWindow, ipcMain} = require('electron');
const path = require("path");
const isDev = require("electron-is-dev");
const notifier = require('node-notifier');
const fs = require('fs');
const request = require('request');

let mainWindow;
let mainWindowFocus = false;

function createWindow() {

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 700,
        minHeight: 550,
        minWidth: 350,
        frame: false,
        titleBarStyle: 'customButtonsOnHover',
        transparent: true,
        webPreferences: {
            nodeIntegration: true
        }
    });

    mainWindow.removeMenu();

    mainWindow.loadURL(isDev ? "http://localhost:3000" : `file://${path.join(__dirname, "../build/index.html")}`);

    mainWindow.webContents.openDevTools();

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

app.setAppUserModelId("Talk.Desktop");

app.on("ready", createWindow);

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
        let message = (msg && msg.length) ? msg.replace(/:emoji#common-telegram#.\d+..\d+:/gi, '⚪️') : msg;
        if(!mainWindow.isVisible()) {
            notifier.notify({
                appName: 'Talk.Desktop',
                title: name,
                message: message,
                icon: icon,
                wait: true
            }, function () {
                // mainWindow.show();
            }).on('click', function() {
                mainWindow.show();
            });;
        }
    });
});

var download = function (uri, filename, callback) {
    request.head(uri, function (err, res, body) {
        var fileExtension = res.headers["content-disposition"].split(".").pop().slice(0, -1);
        var icon = path.join(__dirname, 'temp', filename + '.' + fileExtension);
        request(uri).pipe(fs.createWriteStream(icon)).on('close', () => {
            callback(icon)
        });
    });
};

