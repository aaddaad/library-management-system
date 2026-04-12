require('dotenv').config();

const prisma = require('./lib/prisma');
const express = require('express');
const cors = require('cors');

// 只加载你有的图书路由（不加载登录路由，避免报错）
const booksRouter = require('./routes/books');
const logsRouter = require('./routes/logs');

const app = express();
const port = Number(process.env.PORT) || 3001;

// 必须的中间件
app.use(cors());
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: "ok", message: "Library API is running" });
});

// 挂载你的图书功能（保证能跑）
app.use('/books', booksRouter);
app.use('/logs', logsRouter);

// 队友的优雅关闭代码（保留）
async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});