const { app, Menu, Tray, dialog } = require("electron");
const printer = require("@thiagoelg/node-printer");
const axios = require("axios");
const pako = require("pako");
const base64 = require("base64-arraybuffer");
const WebSocketServer = require("ws").Server;
const Store = require("electron-store");
const path = require("path");

const schema = {
  api: {
    type: "string",
  },
};

const store = new Store({ schema });

let tray = null;
let defaultPrinter;
let printers = printer.getPrinters();
let status = "等待打印任务...";

app.whenReady().then(() => {
  const trayIcon = path.join(__dirname, "tray.png");
  tray = new Tray(trayIcon);
  refreshMenu();
  initws();
});

const refreshMenu = () => {
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  // console.log("load openAtLogin", openAtLogin);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "打印机",
      submenu: [
        ...[...printers].map((i) => {
          let checked = false;
          if (defaultPrinter && defaultPrinter === i.name) {
            checked = true;
          }

          if (!defaultPrinter && i.isDefault) {
            checked = true;
          }

          return {
            label: i.name,
            type: "radio",
            checked,
            click: () => {
              defaultPrinter = i.name;
              refreshMenu();
            },
          };
        }),
        {
          type: "separator",
        },
        {
          label: "刷新打印机",
          click: () => {
            printers = printer.getPrinters();
            refreshMenu();
          },
        },
      ],
    },

    {
      label: "开启自动启动",
      type: "checkbox",
      checked: openAtLogin,
      click: (menuItem) => {
        if (app.isPackaged) {
          app.setLoginItemSettings({
            openAtLogin: menuItem.checked,
          });
          refreshMenu();
        }
      },
    },
    {
      type: "separator",
    },
    {
      label: "退出程序",
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
};

const testPrint = () => {};

const initws = () => {
  const wss = new WebSocketServer({ port: 14529 });
  wss.on("connection", (client) => {
    // console.log("client...connection", client.id);
    client.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        // console.log("client...message", data);
        print(data);
      } catch (error) {
        // console.log("client...message error", error);
      }
    });

    client.on("close", () => {
      // console.log("client...close", client.id);
    });
  });
  wss.on("error", (err) => {
    dialog.showErrorBox(
      "启动服务器错误",
      "请检查是否已经开启了程序，或者端口14529是否被占用！"
    );
    app.quit();
  });
};

const print = async (resdata) => {
  try {
    let arraybuffer = base64.decode(resdata.data);
    if (resdata.type === "gzip") {
      arraybuffer = pako.ungzip(arraybuffer);
    }
    printer.printDirect({
      printer: defaultPrinter,
      data: arraybuffer,
      type: "RAW",
      success: function (jobID) {
        status = `打印任务[${jobID}]中`;
        refreshMenu();
      },
      error: function (err) {
        status = `打印失败...`;
        refreshMenu();
      },
    });
  } catch (error) {
    console.log(error.response);
    return dialog.showMessageBox({
      message: error.response,
    });
  }
};
