const { app, BrowserWindow } = require("electron");

const DESKTOP_ENTRY_URL = "https://daycare.korshakov.org";
const DESKTOP_TITLEBAR_HEIGHT = 36;

function desktopWindowCreate() {
  const isMac = process.platform === "darwin";

  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    titleBarOverlay: isMac
      ? false
      : {
          color: "#00000000",
          symbolColor: "#111827",
          height: DESKTOP_TITLEBAR_HEIGHT
        }
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  window.loadURL(DESKTOP_ENTRY_URL);
}

app.whenReady().then(() => {
  desktopWindowCreate();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      desktopWindowCreate();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
