const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.static('public'));

// In-memory state
let users = new Map();
let waitingQueue = [];

io.on('connection', (socket) => {
    console.log(`🟢 User connected: ${socket.id}`);

    users.set(socket.id, {
        id: socket.id,
        username: `Cosmic${Math.floor(Math.random() * 9999)}`,
        status: 'online'
    });

    io.emit('onlineCount', users.size);

    socket.on('findMatch', (prefs) => {
        console.log(`🔍 ${socket.id} is looking for a match`);
        
        if (waitingQueue.length > 0) {
            const partnerId = waitingQueue.shift();
            const partnerSocket = io.sockets.sockets.get(partnerId);
            
            if (partnerSocket) {
                // Match found
                socket.emit('matchFound', { 
                    peerId: partnerId, 
                    peerInfo: users.get(partnerId) 
                });
                partnerSocket.emit('matchFound', { 
                    peerId: socket.id, 
                    peerInfo: users.get(socket.id) 
                });
            } else {
                waitingQueue.push(socket.id);
            }
        } else {
            waitingQueue.push(socket.id);
            socket.emit('searching');
        }
    });

    // WebRTC signaling
    socket.on('offer', (data) => io.to(data.target).emit('offer', data));
    socket.on('answer', (data) => io.to(data.target).emit('answer', data));
    socket.on('ice-candidate', (data) => io.to(data.target).emit('ice-candidate', data));

    socket.on('chatMessage', (data) => {
        io.to(data.target).emit('chatMessage', {
            message: data.message,
            from: socket.id
        });
    });

    socket.on('nextMatch', () => {
        socket.emit('matchEnded');
    });

    socket.on('disconnect', () => {
        console.log(`🔴 User disconnected: ${socket.id}`);
        users.delete(socket.id);
        
        const index = waitingQueue.indexOf(socket.id);
        if (index !== -1) waitingQueue.splice(index, 1);
        
        io.emit('onlineCount', users.size);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Eleven Sky server running on http://localhost:${PORT}`);
    console.log(`🌌 Ready for cosmic connections...`);
});
