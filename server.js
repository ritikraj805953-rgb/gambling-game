const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB (Railway/Render auto-connects)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gambling', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// User Model
const UserSchema = new mongoose.Schema({
  username: String,
  balance: { type: Number, default: 10000 },
  gamesPlayed: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

// Serve HTML Frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.post('/api/spin', async (req, res) => {
  const { bet = 100 } = req.body;
  const user = await User.findOne({ username: 'demo' }) || new User({ username: 'demo' });
  
  if (user.balance < bet) return res.json({ win: false, message: 'Low Balance!' });
  
  user.balance -= bet;
  const result = Math.floor(Math.random() * 37); // 0-36
  const multipliers = [35, 17, 8, 4, 2, 1.5, 1, 1.5, 2, 4, 8, 17, 35];
  const multiplier = multipliers[result] || 1;
  
  user.balance += bet * multiplier;
  user.gamesPlayed += 1;
  await user.save();
  
  res.json({ 
    win: multiplier > 1, 
    result, 
    multiplier: multiplier.toFixed(2) + 'x',
    balance: user.balance,
    profit: (multiplier - 1) * bet
  });
});

app.post('/api/mine', async (req, res) => {
  const user = await User.findOne({ username: 'demo' });
  const reward = Math.floor(Math.random() * 500) + 100;
  user.balance += reward;
  await user.save();
  res.json({ reward, balance: user.balance });
});

app.get('/api/balance', async (req, res) => {
  const user = await User.findOne({ username: 'demo' });
  res.json({ balance: user ? user.balance : 10000 });
});

// Socket for Live Updates
io.on('connection', (socket) => {
  socket.on('mining-update', (power) => {
    socket.broadcast.emit('mining-global', power);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Gambling Game running on port ${PORT}`);
});
