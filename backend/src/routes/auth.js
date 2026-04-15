// backend/src/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { signToken } = require('../lib/token');
const { signLibrarianToken } = require('../lib/librarianToken');

const router = express.Router();
const prisma = new PrismaClient();

// --- ͳһ��¼�ӿ� (����ѧ����ͼ���Ա������Ա) ---
router.post('/login', async (req, res) => {
  const { email, password, type } = req.body;

  try {
    if (type === 'student' || !type) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: '�û�������', type: 'student' });
      }
      if (user.role === 'LIBRARIAN' || user.role === 'ADMIN') {
        return res.status(401).json({ error: '��ʹ�ö�Ӧ�Ĺ���Ա��ڵ�¼', type: user.role.toLowerCase() });
      }
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: '�������', type: 'student' });
      }
      const token = signToken({ sub: String(user.id), id: user.id, role: user.role });
      return res.json({
        message: 'ѧ����¼�ɹ�',
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    }

    if (type === 'librarian') {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.role !== 'LIBRARIAN') {
        return res.status(401).json({ error: '馆员不存在', type: 'librarian' });
      }
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: '密码错误', type: 'librarian' });
      }
      const token = signLibrarianToken({ id: user.id, employeeId: user.email, name: user.name });
      return res.json({
        message: '馆员登录成功',
        token,
        librarian: { id: user.id, name: user.name, employeeId: user.email }
      });
    }

    if (type === 'admin') {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: '�û�������', type: 'admin' });
      }
      if (user.role !== 'ADMIN') {
        return res.status(401).json({ error: '�ǹ���Ա�˺�', type: 'admin' });
      }
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: '�������', type: 'admin' });
      }
      const token = signToken({ sub: String(user.id), id: user.id, role: user.role });
      return res.json({
        message: '����Ա��¼�ɹ�',
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    }

    return res.status(400).json({ error: '��Ч�ĵ�¼����' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '��¼�����з�������' });
  }
});

// --- ѧ����¼�ӿ� (ʹ�����ݿ���ʵ����) ---
router.post('/login-student', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: '�û�������' });
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: '�������' });
    }
    const token = signToken({ sub: String(user.id), id: user.id, role: user.role });
    return res.json({
      message: 'ѧ����¼�ɹ�',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '��¼�����з�������' });
  }
});

// --- ͼ�����Աע�� ---
router.post('/register', async (req, res) => {
  const { employeeId, name, password } = req.body;
  if (!employeeId || !name || !password) {
    return res.status(400).json({ error: '���š����������붼�Ǳ����' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '���볤�Ȳ�������6λ' });
  }
  try {
    const existing = await prisma.librarian.findUnique({ where: { employeeId } });
    if (existing) {
      return res.status(409).json({ error: '�����Ѵ���' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const librarian = await prisma.librarian.create({ data: { employeeId, name, password: hashedPassword } });
    return res.status(201).json({
      message: 'ע��ɹ�',
      librarian: { id: librarian.id, employeeId: librarian.employeeId, name: librarian.name }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ע��ʧ��' });
  }
});

// --- ͼ�����Ա��¼�ӿ� ---
router.post('/login-librarian', async (req, res) => {
  const { employeeId, password } = req.body;
  try {
    const librarian = await prisma.librarian.findUnique({ where: { employeeId } });
    if (!librarian) {
      return res.status(401).json({ error: '���Ų�����' });
    }
    const isValid = await bcrypt.compare(password, librarian.password);
    if (!isValid) {
      return res.status(401).json({ error: '�������' });
    }
    const token = signLibrarianToken({ id: librarian.id, employeeId: librarian.employeeId, name: librarian.name });
    return res.json({
      message: 'ͼ�����Ա��¼�ɹ�',
      token,
      librarian: { id: librarian.id, employeeId: librarian.employeeId, name: librarian.name }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '��¼�����з�������' });
  }
});

// --- ����Ա��¼�ӿ� ---
router.post('/login-admin', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: '�û�������' });
    }
    if (user.role !== 'ADMIN') {
      return res.status(401).json({ error: '�ǹ���Ա�˺�' });
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: '�������' });
    }
    const token = signToken({ sub: String(user.id), id: user.id, role: user.role });
    return res.json({
      message: '����Ա��¼�ɹ�',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '��¼�����з�������' });
  }
});

module.exports = router;
