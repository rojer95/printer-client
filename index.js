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

app.whenReady().then(() => {
  const trayIcon = path.join(__dirname, "tray.png");
  tray = new Tray(trayIcon);
  refreshMenu();
  initws();
});

const refreshMenu = () => {
  const printers = printer.getPrinters();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "打印机",
      submenu: [...printers].map((i) => {
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
    },
    {
      label: "刷新打印机",
      click: () => {
        refreshMenu();
      },
    },
    {
      label: "测试打印",
      click: () => {
        print(
          [
            {
              type: "text",
              data: "${text}",
              props: {
                size: 2,
              },
            },
            {
              type: "line",
              data: "*",
            },
            {
              type: "img",
              data: "https://gw.alicdn.com/imgextra/i3/O1CN01uRz3de23mzWofmPYX_!!6000000007299-2-tps-143-59.png",
              props: {
                width: 150,
              },
            },
            {
              type: "qrcode",
              data: "https://gw.alicdn.com/imgextra/i3/O1CN01uRz3de23mzWofmPYX_!!6000000007299-2-tps-143-59.png",
              props: {
                width: 150,
              },
            },
            {
              type: "table",
              data: [
                {
                  label: "测试标题",
                  value: "测试内容",
                },
              ],
              props: {
                hideHeader: true,
                header: [
                  {
                    dataIndex: "label",
                    cols: 8,
                    align: "left",
                  },
                  {
                    dataIndex: "value",
                    cols: 24,
                    align: "right",
                  },
                ],
              },
            },
            {
              type: "line",
              data: "*",
            },
            {
              type: "text",
              data: "测试结束",
            },
            {
              type: "line",
              data: "=",
            },
          ],
          {
            text: "打印测试",
          },
          {
            width: 32,
            style: {
              align: "center",
            },
          }
        );
      },
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

const initws = () => {
  const wss = new WebSocketServer({ port: 14529 });
  wss.on("connection", (client) => {
    console.log("client...connection", client.id);
    client.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        print(data.template, data.data, data.options);
      } catch (error) {
        //...
      }
    });

    client.on("close", () => {
      console.log("client...close", client.id);
    });
  });
  wss.on("error", (err) => {
    alert(err.message);
  });
};

const print = async (template, data, options) => {
  const apiurl = store.get("api") || "https://print.freesailing.cn/parse";
  if (!apiurl)
    return dialog.showMessageBox({
      message: "没有配置打印接口服务器",
    });
  try {
    const response = await axios({
      url: apiurl,
      method: "POST",
      data: {
        template,
        data,
        options,
      },
    });

    const { data: resdata } = response;
    if (resdata.data && resdata.type) {
      let arraybuffer = base64.decode(resdata.data);
      if (resdata.type === "gzip") {
        arraybuffer = pako.ungzip(arraybuffer);
      }
      printer.printDirect({
        printer: defaultPrinter,
        data: arraybuffer,
        type: "RAW",
        success: function (jobID) {
          console.log("sent to printer with ID: " + jobID);
        },
        error: function (err) {
          console.log(err);
        },
      });
    }
  } catch (error) {
    console.log(error.response);
  }
};
