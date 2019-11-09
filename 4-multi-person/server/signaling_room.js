'use strict'

const srv = require('http').Server()
const io = require('socket.io')(srv)
const port = 3002

srv.listen(port)
console.log('signaling server started on port:' + port)

io.on('connection', (socket) => {
  socket.on('enter', (roomName) => {
    socket.join(roomName)
    console.log(`id=${socket.id} enter room=${roomName}`)
    setRoomName(roomName)
  })

  function setRoomName(roomName) {
    socket.roomName = roomName
  }

  function getRoomName() {
    return socket.roomName
  }

  function emitMessage(type, message) {
    const roomName = getRoomName()

    if (roomName) {
      console.log('message broadcast to room ' + roomName)
      socket.broadcast.to(roomName).emit(type, message)
    } else {
      console.log('message broadcast all')
      socket.broadcast.emit(type, message)
    }
  }

  socket.on('message', (message) => {
    message.from = socket.id

    const target = message.sendto
    if (target) {
      socket.to(target).emit('message', message)
      return
    }

    emitMessage('message', message)
  })

  socket.on('disconnect', () => {
    emitMessage('user disconnected', { id: socket.id })

    const roomName = getRoomName()
    if (roomName) {
      socket.leave(roomName)
    }
  })
})
