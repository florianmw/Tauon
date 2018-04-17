'use strict'

import { ipcMain, app, BrowserWindow } from 'electron'
// import 'dgram'
let dgram = require('dgram')
let fs = require('fs')
let path = require('path')

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`

var configFile = path.join(app.getPath('userData'), 'tauon.json')

function createWindow () {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    height: 563,
    useContentSize: true,
    width: 1000
  })

  mainWindow.setMenu(null)
  mainWindow.loadURL(winURL)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

/**
 * Listen on requested UDP port
 */

var listenSock

ipcMain.on('listen', (evt, port) => {
  listenSock = dgram.createSocket('udp6')

  // emits when any error occurs
  listenSock.on('error', (error) => {
    evt.sender.send('error', error.toString())
    listenSock.close()
  })

  // emits on new datagram msg
  listenSock.on('message', (msg, info) => {
    evt.sender.send('message', msg, info)
  })

  // emits when socket is ready and listening for datagram msgs
  listenSock.on('listening', () => {
    var address = listenSock.address()
    evt.sender.send('listening', address)
  })

  // emits after the socket is closed using socket.close();
  listenSock.on('close', () => {
    evt.sender.send('close')
  })

  listenSock.bind(port)
})

ipcMain.on('close', () => {
  listenSock.close()
})

ipcMain.on('readConfig', (evt) => {
  fs.readFile(configFile, 'utf-8', (err, data) => {
    if (err === null) {
      evt.sender.send('config', JSON.parse(data))
    }
  })
})

ipcMain.on('writeConfig', (evt, cfg) => {
  var configStr = JSON.stringify(cfg, null, 2)
  fs.writeFile(configFile, configStr, (err) => {
    if (err === null) {
      evt.sender.send('config', cfg)
    }
  })
})

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */
