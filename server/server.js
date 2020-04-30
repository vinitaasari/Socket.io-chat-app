const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const { generateMessage } = require('./utils/message');
const { isRealString } = require('./utils/validation');
const { Users } = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const users = new Users();
const bodyParser = require('body-parser');
const cors = require('cors');

const mongoose = require('mongoose'); 
mongoose.connect('mongodb://localhost:27017/players'); 
var db=mongoose.connection; 
db.on('error', console.log.bind(console, "connection error")); 
db.once('open', function(callback){ 
    console.log("connection succeeded"); 
}) 

const publicPath = path.join(__dirname, '../public');
const port = process.env.PORT || 3000;

app.use(express.static(publicPath));
app.use(cors());

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/signUp', (req, res) => {
  var name = req.body.username; 
  var pass = req.body.password; 


  var data = { 
      "name": name, 
      "password":pass,  
  } 
db.collection('details').insertOne(data,function(err, collection){ 
      if (err) throw err; 
      console.log("Record inserted Successfully"); 
            
  }); 
        
  return res.redirect('signIn.html'); 
});
app.post('/signIn', (req, res) => {
  var name = req.body.username; 
  var pass = req.body.password; 

  db.collection('details').findOne({ name: name }, function (err, user) {

    if (err) {
        throw err;
    }
    if(user){
      if(user.password === pass){
        return res.redirect('joinChat.html'); 
      }
      console.log("password is wrong");
    }
});
});

var players = 0;
var number = 1;

io.on('connection', (socket) => {
  console.log('New user connected');
  socket.on('join', (params, callback) => {
    if (!isRealString(params.username)) {
      return callback('Username required');
    }
    
    players = players + 1;
    if(players === 3){
      players=0;
      number = number + 1;
      console.log("new room created")
    }
    var roomName = 'playersRoom '+number;
    socket.join(roomName);
    
    users.removeUser(socket.id);
    users.addUser(socket.id, params.username, roomName);

    io.to(roomName).emit('updateUserList', users.getUserList(roomName));
    socket.emit('newMessage', generateMessage('Admin', 'Welcome to the chat room ' + roomName));
    socket.broadcast.to(roomName).emit('newMessage', generateMessage('Admin', `${params.username} has joined.`));

    callback();
  });

  socket.on('createMessage', (message, callback) => {
    const user = users.getUser(socket.id);

    if (user && isRealString(message.text)) {
      io.to(user.room).emit('newMessage', generateMessage(user.username, message.text));
    }

    callback('');
  });

  socket.on('disconnect', () => {
    const user = users.removeUser(socket.id);

    if (user) {
      io.to(user.room).emit('updateUserList', users.getUserList(user.room));
      io.to(user.room).emit('newMessage', generateMessage('Admin', `${user.username} has left`));
    }
  });
});

server.listen(port, () => {
  console.log(`Server is up and running on port ${port}`);
});
