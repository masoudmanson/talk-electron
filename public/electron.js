const electron = require("electron");
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const path = require("path");
const isDev = require("electron-is-dev");

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 700,
        minHeight: 300,
        minWidth: 300,
        frame: false,
        titleBarStyle: 'customButtonsOnHover',
        transparent: true,
        webPreferences: {
            nodeIntegration: true
        }
    });

    mainWindow.removeMenu();

    mainWindow.loadURL(isDev ? "http://localhost:3000" : `file://${path.join(__dirname, "../build/index.html")}`);

    mainWindow.on("closed", () => (mainWindow = null));

    mainWindow.webContents.openDevTools();
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});
