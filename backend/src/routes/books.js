const express = require('express');

const prisma = require('../lib/prisma');
const { requireLibrarianAuth } = require('../middleware/librarianAuth');

const router = express.Router();

const BOOK_SELECT = {
  id: true,
  title: true,
  author: true,
  isbn: true,
  genre: true,
  description: true,
  language: true,
  shelfLocation: true,
  available: true,
  totalCopies: true,
  availableCopies: true,
  createdAt: true,
};

const BOOK_DETAIL_INCLUDE = {
  loans: {
    orderBy: { checkoutDate: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          studentId: true,
        },
      },
    },
  },
  ratings: {
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          studentId: true,
        },
      },
    },
  },
  holds: {
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          studentId: true,
        },
      },
    },
  },
  wishlists: {
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          studentId: true,
        },
      },
    },
  },
  _count: {
    select: {
      loans: true,
      ratings: true,
      holds: true,
      wishlists: true,
    },
  },
};

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isNaN(parsedValue) ? Number.NaN : parsedValue;
}

async function writeAuditLog(action, entityId, detail) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity: 'Book',
        entityId,
        detail,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

// 获取所有图书
router.get('/', async (req, res) => {
  try {
    const books = await prisma.book.findMany({
      orderBy: { id: 'asc' },
      select: BOOK_SELECT,
    });

    res.json({ data: books });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch books',
      detail: error.message,
    });
  }
});

// 图书搜索功能 - 按书名、作者、关键词查找
router.get('/search', async (req, res) => {
  try {
    const { title, author, keyword } = req.query;
    
    // 构建搜索条件
    const whereCondition = {};
    
    if (title || author || keyword) {
      whereCondition.OR = [];
      
      if (title) {
        whereCondition.OR.push({ title: { contains: title } });
      }
      
      if (author) {
        whereCondition.OR.push({ author: { contains: author } });
      }
      
      if (keyword) {
        whereCondition.OR.push(
          { title: { contains: keyword } },
          { author: { contains: keyword } }
        );
      }
    }
    
    const books = await prisma.book.findMany({
      where: whereCondition,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        title: true,
        author: true,
        isbn: true,
        genre: true,
        description: true,
        language: true,
        shelfLocation: true,
        available: true,
        availableCopies: true,
      },
    });
    
    res.json({ 
      success: true, 
      data: books,
      count: books.length 
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to search books',
      detail: error.message,
    });
  }
});

// 获取单本图书详情
router.get('/:id', async (req, res) => {
  const bookId = Number.parseInt(req.params.id, 10);

  if (Number.isNaN(bookId)) {
    return res.status(400).json({ error: 'Invalid book id' });
  }

  try {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: BOOK_DETAIL_INCLUDE,
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const ratingCount = book.ratings.length;
    const averageRating =
      ratingCount === 0
        ? null
        : Number((book.ratings.reduce((sum, rating) => sum + rating.stars, 0) / ratingCount).toFixed(2));

    res.json({
      success: true,
      data: {
        ...book,
        stats: {
          averageRating,
          activeLoans: book.loans.filter((loan) => !loan.returnDate).length,
          returnedLoans: book.loans.filter((loan) => Boolean(loan.returnDate)).length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch book detail',
      detail: error.message,
    });
  }
});

router.post('/', requireLibrarianAuth, async (req, res) => {
  const title = normalizeText(req.body.title);
  const author = normalizeText(req.body.author);
  const isbn = normalizeText(req.body.isbn);
  const genre = normalizeText(req.body.genre);
  const description = normalizeText(req.body.description) || null;
  const language = normalizeText(req.body.language) || 'English';
  const shelfLocation = normalizeText(req.body.shelfLocation) || null;
  const totalCopiesInput = parseOptionalInteger(req.body.totalCopies);
  const availableCopiesInput = parseOptionalInteger(req.body.availableCopies);
  const totalCopies = totalCopiesInput ?? 1;
  const availableCopies = availableCopiesInput ?? totalCopies;

  if (!title || !author || !isbn || !genre) {
    return res.status(400).json({
      error: 'title, author, isbn and genre are required',
    });
  }

  if (
    Number.isNaN(totalCopies) ||
    Number.isNaN(availableCopies) ||
    totalCopies < 1 ||
    availableCopies < 0
  ) {
    return res.status(400).json({
      error: 'totalCopies must be at least 1 and availableCopies cannot be negative',
    });
  }

  if (availableCopies > totalCopies) {
    return res.status(400).json({
      error: 'availableCopies cannot be greater than totalCopies',
    });
  }

  try {
    const book = await prisma.book.create({
      data: {
        title,
        author,
        isbn,
        genre,
        description,
        language,
        shelfLocation,
        totalCopies,
        availableCopies,
        available: availableCopies > 0,
      },
      select: BOOK_SELECT,
    });

    await writeAuditLog(
      'CREATE_BOOK',
      book.id,
      `Librarian ${req.librarian.employeeId} created book "${book.title}" (${book.isbn}).`
    );

    return res.status(201).json({
      message: 'Book created successfully',
      book,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'A book with this ISBN already exists',
      });
    }

    return res.status(500).json({
      error: 'Failed to create book',
      detail: error.message,
    });
  }
});

router.delete('/:id', requireLibrarianAuth, async (req, res) => {
  const bookId = Number.parseInt(req.params.id, 10);

  if (Number.isNaN(bookId)) {
    return res.status(400).json({ error: 'Invalid book id' });
  }

  try {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        title: true,
        isbn: true,
        _count: {
          select: {
            loans: true,
            ratings: true,
            holds: true,
            wishlists: true,
          },
        },
      },
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const relatedRecordCount =
      book._count.loans +
      book._count.ratings +
      book._count.holds +
      book._count.wishlists;

    if (relatedRecordCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete a book that already has related borrowing or interaction records',
      });
    }

    await prisma.book.delete({
      where: { id: bookId },
    });

    await writeAuditLog(
      'DELETE_BOOK',
      book.id,
      `Librarian ${req.librarian.employeeId} deleted book "${book.title}" (${book.isbn}).`
    );

    return res.json({
      message: 'Book deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to delete book',
      detail: error.message,
    });
  }
});

module.exports = router;
