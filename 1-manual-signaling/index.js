let localStream = null
let peerConnection = null

// --- prefix -----
navigator.getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia
RTCPeerConnection =
  window.RTCPeerConnection ||
  window.webkitRTCPeerConnection ||
  window.mozRTCPeerConnection
RTCSessionDescription =
  window.RTCSessionDescription ||
  window.webkitRTCSessionDescription ||
  window.mozRTCSessionDescription

// ---------------------- media handling -----------------------
// start local video
function startVideo() {
  getDeviceStream({ video: true, audio: false })
    .then(function(stream) {
      // success
      localStream = stream
      const localVideo = document.getElementById('local_video')
      playVideo(localVideo, stream)
    })
    .catch(function(error) {
      // error
      console.error('getUserMedia error:', error)
      return
    })
}

// stop local video
function stopVideo() {
  const localVideo = document.getElementById('local_video')
  pauseVideo(localVideo)
  stopLocalStream(localStream)
}

function stopLocalStream(stream) {
  let tracks = stream.getTracks()
  if (!tracks) {
    console.warn('NO tracks')
    return
  }

  for (let track of tracks) {
    track.stop()
  }
}

function getDeviceStream(option) {
  if ('getUserMedia' in navigator.mediaDevices) {
    console.log('navigator.mediaDevices.getUserMadia')
    return navigator.mediaDevices.getUserMedia(option)
  } else {
    console.log('wrap navigator.getUserMadia with Promise')
    return new Promise(function(resolve, reject) {
      navigator.getUserMedia(option, resolve, reject)
    })
  }
}

function playVideo(element, stream) {
  console.log(element)
  if ('srcObject' in element) {
    element.srcObject = stream
  } else {
    element.src = window.URL.createObjectURL(stream)
  }
  element.play()
  element.volume = 0
}

function pauseVideo(element) {
  element.pause()
  if ('srcObject' in element) {
    element.srcObject = null
  } else {
    if (element.src && element.src !== '') {
      window.URL.revokeObjectURL(element.src)
    }
    element.src = ''
  }
}

// ----- hand signaling ----
function onSdpText() {
  const textToReceiveSdp = document.getElementById('text_for_receive_sdp')
  let text = textToReceiveSdp.value
  if (peerConnection) {
    console.log('Received answer text...')
    let answer = new RTCSessionDescription({
      type: 'answer',
      sdp: text,
    })
    setAnswer(answer)
  } else {
    console.log('Received offer text...')
    let offer = new RTCSessionDescription({
      type: 'offer',
      sdp: text,
    })
    setOffer(offer)
  }
  textToReceiveSdp.value = ''
}

function sendSdp(sessionDescription) {
  console.log('---sending sdp ---')
  const textForSendSdp = document.getElementById('text_for_send_sdp')
  textForSendSdp.value = sessionDescription.sdp
  textForSendSdp.focus()
  textForSendSdp.select()
}

// ---------------------- connection handling -----------------------
function prepareNewConnection() {
  let pc_config = { iceServers: [] }
  let peer = new RTCPeerConnection(pc_config)

  // --- on get remote stream ---
  if ('ontrack' in peer) {
    peer.ontrack = function(event) {
      console.log('-- peer.ontrack()')
      const remoteVideo = document.getElementById('remote_video')
      let stream = event.streams[0]
      playVideo(remoteVideo, stream)
    }
  } else {
    peer.onaddstream = function(event) {
      console.log('-- peer.onaddstream()')
      const remoteVideo = document.getElementById('remote_video')
      let stream = event.stream
      playVideo(remoteVideo, stream)
    }
  }

  // --- on get local ICE candidate
  peer.onicecandidate = function(evt) {
    if (evt.candidate) {
      console.log(evt.candidate)

      // Trickle ICE の場合は、ICE candidateを相手に送る
      // Vanilla ICE の場合には、何もしない
    } else {
      console.log('empty ice event')

      // Trickle ICE の場合は、何もしない
      // Vanilla ICE の場合には、ICE candidateを含んだSDPを相手に送る
      sendSdp(peer.localDescription)
    }
  }

  // --- when need to exchange SDP ---
  peer.onnegotiationneeded = function(evt) {
    console.log('-- onnegotiationneeded() ---')
  }

  // --- other events ----
  peer.onicecandidateerror = function(evt) {
    console.error('ICE candidate ERROR:', evt)
  }

  peer.onsignalingstatechange = function() {
    console.log('== signaling status=' + peer.signalingState)
  }

  peer.oniceconnectionstatechange = function() {
    console.log('== ice connection status=' + peer.iceConnectionState)
    if (peer.iceConnectionState === 'disconnected') {
      console.log('-- disconnected --')
      hangUp()
    }
  }

  peer.onicegatheringstatechange = function() {
    console.log('==***== ice gathering state=' + peer.iceGatheringState)
  }

  peer.onconnectionstatechange = function() {
    console.log('==***== connection state=' + peer.connectionState)
  }

  peer.onremovestream = function(event) {
    console.log('-- peer.onremovestream()')
    const remoteVideo = document.getElementById('remote_video')
    pauseVideo(remoteVideo)
  }

  // -- add local stream --
  if (localStream) {
    console.log('Adding local stream...')
    peer.addStream(localStream)
  } else {
    console.warn('no local stream, but continue.')
  }

  return peer
}

function makeOffer() {
  peerConnection = prepareNewConnection()
  peerConnection
    .createOffer()
    .then(function(sessionDescription) {
      console.log('createOffer() succsess in promise')
      return peerConnection.setLocalDescription(sessionDescription)
    })
    .then(function() {
      console.log('setLocalDescription() succsess in promise')

      // -- Trickle ICE の場合は、初期SDPを相手に送る --
      // -- Vanilla ICE の場合には、まだSDPは送らない --
      //sendSdp(peerConnection.localDescription);
    })
    .catch(function(err) {
      console.error(err)
    })
}

function setOffer(sessionDescription) {
  if (peerConnection) {
    console.error('peerConnection alreay exist!')
  }
  peerConnection = prepareNewConnection()
  peerConnection
    .setRemoteDescription(sessionDescription)
    .then(function() {
      console.log('setRemoteDescription(offer) succsess in promise')
      makeAnswer()
    })
    .catch(function(err) {
      console.error('setRemoteDescription(offer) ERROR: ', err)
    })
}

function makeAnswer() {
  console.log('sending Answer. Creating remote session description...')
  if (!peerConnection) {
    console.error('peerConnection NOT exist!')
    return
  }

  peerConnection
    .createAnswer()
    .then(function(sessionDescription) {
      console.log('createAnswer() succsess in promise')
      return peerConnection.setLocalDescription(sessionDescription)
    })
    .then(function() {
      console.log('setLocalDescription() succsess in promise')

      // -- Trickle ICE の場合は、初期SDPを相手に送る --
      // -- Vanilla ICE の場合には、まだSDPは送らない --
      //sendSdp(peerConnection.localDescription);
    })
    .catch(function(err) {
      console.error(err)
    })
}

function setAnswer(sessionDescription) {
  if (!peerConnection) {
    console.error('peerConnection NOT exist!')
    return
  }

  peerConnection
    .setRemoteDescription(sessionDescription)
    .then(function() {
      console.log('setRemoteDescription(answer) succsess in promise')
    })
    .catch(function(err) {
      console.error('setRemoteDescription(answer) ERROR: ', err)
    })
}

// start PeerConnection
function connect() {
  if (!peerConnection) {
    console.log('make Offer')
    makeOffer()
  } else {
    console.warn('peer already exist.')
  }
}

// close PeerConnection
function hangUp() {
  if (peerConnection) {
    console.log('Hang up.')
    peerConnection.close()
    peerConnection = null
    const remoteVideo = document.getElementById('remote_video')
    pauseVideo(remoteVideo)
  } else {
    console.warn('peer NOT exist.')
  }
}
