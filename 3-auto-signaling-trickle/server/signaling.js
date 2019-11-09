'use strict'

const WebSocketServer = require('ws').Server
const port = 3001
const wsServer = new WebSocketServer({ port })

wsServer.on('connection', ws => {
  ws.on('message', message => {
    wsServer.clients.forEach(client => {
      if (ws === client) {
        console.log('skip render')
      } else {
        client.send(message)
      }
    })
  })
})
