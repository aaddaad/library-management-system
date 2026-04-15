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
      include: {
        copies: {
          select: { status: true }
        }
      }
    });

    const booksWithCount = books.map(book => {
      const availableCopies = book.copies.filter(c => c.status === 'AVAILABLE').length;
      return {
        ...book,
        availableCopies: availableCopies,
        totalCopies: book.copies.length
      };
    });

    res.json({ data: booksWithCount });
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
      include: {
        copies: {
          select: { status: true }
        }
      }
    });
    
    const booksWithCount = books.map(book => {
      const availableCopies = book.copies.filter(c => c.status === 'AVAILABLE').length;
      return {
        id: book.id,
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        genre: book.genre,
        description: book.description,
        language: book.language,
        createdAt: book.createdAt,
        availableCopies: availableCopies,
        totalCopies: book.copies.length
      };
    });
    
    res.json({ 
      success: true, 
      data: booksWithCount,
      count: booksWithCount.length 
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
      include: {
        ...BOOK_DETAIL_INCLUDE,
        copies: {
          select: { id: true, barcode: true, floor: true, libraryArea: true, shelfNo: true, shelfLevel: true, status: true }
        }
      }
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const ratingCount = book.ratings.length;
    const averageRating =
      ratingCount === 0
        ? null
        : Number((book.ratings.reduce((sum, rating) => sum + rating.stars, 0) / ratingCount).toFixed(2));

    const availableCopies = book.copies.filter(c => c.status === 'AVAILABLE').length;

    res.json({
      success: true,
      data: {
        ...book,
        availableCopies: availableCopies,
        totalCopies: book.copies.length,
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

  if (!title || !author || !isbn || !genre) {
    return res.status(400).json({
      error: 'title, author, isbn and genre are required',
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