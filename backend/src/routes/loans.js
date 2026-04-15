const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// 配置：学生最大借阅数量（可以从 Config 表读取）
const MAX_BORROW_STUDENT = 3;
const LOAN_DURATION_DAYS = 30;

// ================== 辅助函数 ==================

// 检查用户是否有逾期未还图书
async function hasOverdueLoans(userId) {
  const overdueLoans = await prisma.loan.findMany({
    where: {
      userId,
      returnDate: null,
      dueDate: { lt: new Date() }
    }
  });
  return overdueLoans.length > 0;
}

// 获取用户当前借阅数量（未归还的）
async function getCurrentBorrowCount(userId) {
  return await prisma.loan.count({
    where: {
      userId,
      returnDate: null
    }
  });
}

// 计算逾期罚款（示例：每天0.5元，从 Config 表读取）
async function calculateFine(dueDate, returnDate) {
  if (!returnDate || returnDate <= dueDate) return 0;
  const diffDays = Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24));
  // 从 Config 表获取费率
  const fineRateConfig = await prisma.config.findUnique({
    where: { key: 'FINE_RATE_PER_DAY' }
  });
  const rate = fineRateConfig ? parseFloat(fineRateConfig.value) : 0.5;
  return diffDays * rate;
}

// ================== 借阅 API ==================

// 1. 学生/馆员 借书
router.post('/borrow/:bookId', requireAuth, async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // 1. 检查书籍是否存在且可借
    const book = await prisma.book.findUnique({
      where: { id: Number(bookId) }
    });
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    if (book.availableCopies <= 0) {
      return res.status(400).json({ message: 'No available copies of this book' });
    }

    // 2. 检查是否已经借了同一本书且未归还
    const existingLoan = await prisma.loan.findFirst({
      where: {
        userId,
        bookId: Number(bookId),
        returnDate: null
      }
    });
    if (existingLoan) {
      return res.status(400).json({ message: 'You have already borrowed this book and not returned it' });
    }

    // 3. 权限检查（学生和馆员/管理员分开）
    if (userRole === 'STUDENT') {
      // 逾期检查
      const overdue = await hasOverdueLoans(userId);
      if (overdue) {
        return res.status(403).json({ message: 'You have overdue books. Please return them before borrowing new ones.' });
      }
      // 数量限制
      const currentCount = await getCurrentBorrowCount(userId);
      if (currentCount >= MAX_BORROW_STUDENT) {
        return res.status(403).json({ message: `You can only borrow up to ${MAX_BORROW_STUDENT} books at a time.` });
      }
    }

    // 4. 创建借阅记录
    const checkoutDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + LOAN_DURATION_DAYS);

    const loan = await prisma.loan.create({
      data: {
        bookId: Number(bookId),
        userId,
        checkoutDate,
        dueDate,
        fineAmount: 0,
        finePaid: false,
        fineForgiven: false
      }
    });

    // 5. 减少可借副本数
    await prisma.book.update({
      where: { id: Number(bookId) },
      data: { availableCopies: { decrement: 1 } }
    });

    // 6. 记录审计日志（可选）
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'BORROW',
        entity: 'Loan',
        entityId: loan.id,
        detail: `User ${userId} borrowed book ${bookId}`
      }
    });

    res.status(201).json({
      message: 'Book borrowed successfully',
      loan: {
        id: loan.id,
        bookTitle: book.title,
        checkoutDate,
        dueDate
      }
    });
  } catch (error) {
    next(error);
  }
});

// 2. 归还图书
router.post('/return/:loanId', requireAuth, async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const loan = await prisma.loan.findUnique({
      where: { id: Number(loanId) },
      include: { book: true }
    });
    if (!loan) {
      return res.status(404).json({ message: 'Loan record not found' });
    }

    // 权限：只有本人或管理员/馆员可以归还
    if (loan.userId !== userId && userRole === 'STUDENT') {
      return res.status(403).json({ message: 'You can only return your own borrowed books' });
    }

    if (loan.returnDate !== null) {
      return res.status(400).json({ message: 'Book already returned' });
    }

    const returnDate = new Date();
    let fine = 0;
    if (returnDate > loan.dueDate) {
      fine = await calculateFine(loan.dueDate, returnDate);
    }

    // 更新借阅记录
    const updatedLoan = await prisma.loan.update({
      where: { id: Number(loanId) },
      data: {
        returnDate,
        fineAmount: fine,
        finePaid: false   // 待支付
      }
    });

    // 增加可借副本数
    await prisma.book.update({
      where: { id: loan.bookId },
      data: { availableCopies: { increment: 1 } }
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'RETURN',
        entity: 'Loan',
        entityId: loan.id,
        detail: `User ${userId} returned book ${loan.bookId}, fine: ${fine}`
      }
    });

    res.json({
      message: fine > 0 ? `Book returned late. Fine: ${fine}元` : 'Book returned successfully',
      fine
    });
  } catch (error) {
    next(error);
  }
});

// 3. 获取当前用户的借阅列表（未归还 + 历史）
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loans = await prisma.loan.findMany({
      where: { userId },
      include: { book: true },
      orderBy: { checkoutDate: 'desc' }
    });
    res.json({ loans });
  } catch (error) {
    next(error);
  }
});

// 4. 管理员/馆员查看所有借阅记录
router.get('/admin/all', requireAuth, async (req, res, next) => {
  if (req.user.role === 'STUDENT') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const loans = await prisma.loan.findMany({
      include: { user: true, book: true },
      orderBy: { checkoutDate: 'desc' }
    });
    res.json({ loans });
  } catch (error) {
    next(error);
  }
});

// 5. 管理员强制借书（跳过数量、逾期检查，但仍需检查库存）
router.post('/admin/force-borrow/:bookId/:userId', requireAuth, async (req, res, next) => {
  if (req.user.role === 'STUDENT') {
    return res.status(403).json({ message: 'Admin or librarian only' });
  }
  try {
    const { bookId, userId } = req.params;
    const targetUserId = Number(userId);
    const targetBookId = Number(bookId);

    const book = await prisma.book.findUnique({ where: { id: targetBookId } });
    if (!book || book.availableCopies <= 0) {
      return res.status(400).json({ message: 'Book not available' });
    }

    // 检查是否已经借了同一本未还
    const existing = await prisma.loan.findFirst({
      where: {
        userId: targetUserId,
        bookId: targetBookId,
        returnDate: null
      }
    });
    if (existing) {
      return res.status(400).json({ message: 'User already borrowed this book' });
    }

    const checkoutDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + LOAN_DURATION_DAYS);

    const loan = await prisma.loan.create({
      data: {
        bookId: targetBookId,
        userId: targetUserId,
        checkoutDate,
        dueDate
      }
    });

    await prisma.book.update({
      where: { id: targetBookId },
      data: { availableCopies: { decrement: 1 } }
    });

    res.status(201).json({ message: 'Force borrow successful', loan });
  } catch (error) {
    next(error);
  }
});

module.exports = router;