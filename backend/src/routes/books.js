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

const BOOK_BASE_REQUIRED_FIELDS = ['title', 'author', 'isbn', 'genre'];

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

function formatCopyLocation(copy) {
  if (!copy) {
    return null;
  }

  const floor = copy.floor ? `${copy.floor}F` : '';
  const area = normalizeText(copy.libraryArea);
  const shelfNo = normalizeText(copy.shelfNo);
  const shelfLevel = copy.shelfLevel ? String(copy.shelfLevel) : '';
  const shelfSegment = [shelfNo, shelfLevel].filter(Boolean).join('-');

  return [floor, area, shelfSegment].filter(Boolean).join(' ') || null;
}

function hydrateBookRecord(book) {
  const copies = Array.isArray(book.copies) ? book.copies : [];
  const computedAvailableCopies = copies.filter((copy) => copy.status === 'AVAILABLE').length;
  const computedTotalCopies = copies.length;

  const totalCopies = Number.isInteger(book.totalCopies)
    ? book.totalCopies
    : computedTotalCopies > 0
      ? computedTotalCopies
      : 1;

  const availableCopies = Number.isInteger(book.availableCopies)
    ? book.availableCopies
    : computedTotalCopies > 0
      ? computedAvailableCopies
      : book.available === false
        ? 0
        : totalCopies;

  return {
    ...book,
    shelfLocation: book.shelfLocation || formatCopyLocation(copies[0]) || null,
    available: typeof book.available === 'boolean' ? book.available : availableCopies > 0,
    totalCopies,
    availableCopies,
  };
}

function stripCopies(book) {
  const { copies, ...bookWithoutCopies } = book;
  return bookWithoutCopies;
}

function buildBookPayload(body) {
  const title = normalizeText(body.title);
  const author = normalizeText(body.author);
  const isbn = normalizeText(body.isbn);
  const genre = normalizeText(body.genre);
  const description = normalizeText(body.description) || null;
  const language = normalizeText(body.language) || 'English';
  const shelfLocation = normalizeText(body.shelfLocation) || null;
  const totalCopiesInput = parseOptionalInteger(body.totalCopies);
  const availableCopiesInput = parseOptionalInteger(body.availableCopies);
  const totalCopies = totalCopiesInput ?? 1;
  const availableCopies = availableCopiesInput ?? totalCopies;

  return {
    title,
    author,
    isbn,
    genre,
    description,
    language,
    shelfLocation,
    totalCopies,
    availableCopies,
  };
}

function validateBookPayload(payload) {
  const missingFields = BOOK_BASE_REQUIRED_FIELDS.filter((field) => !payload[field]);

  if (missingFields.length > 0) {
    return 'title, author, isbn and genre are required';
  }

  if (
    Number.isNaN(payload.totalCopies) ||
    Number.isNaN(payload.availableCopies) ||
    payload.totalCopies < 1 ||
    payload.availableCopies < 0
  ) {
    return 'totalCopies must be at least 1 and availableCopies cannot be negative';
  }

  if (payload.availableCopies > payload.totalCopies) {
    return 'availableCopies cannot be greater than totalCopies';
  }

  return null;
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
          select: {
            status: true,
            floor: true,
            libraryArea: true,
            shelfNo: true,
            shelfLevel: true,
          },
        },
      },
    });

    const booksWithSummary = books.map((book) => stripCopies(hydrateBookRecord(book)));

    res.json({ data: booksWithSummary });
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
          select: {
            status: true,
            floor: true,
            libraryArea: true,
            shelfNo: true,
            shelfLevel: true,
          },
        },
      },
    });

    const booksWithSummary = books.map((book) => stripCopies(hydrateBookRecord(book)));

    res.json({
      success: true,
      data: booksWithSummary,
      count: booksWithSummary.length,
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
          select: {
            id: true,
            barcode: true,
            floor: true,
            libraryArea: true,
            shelfNo: true,
            shelfLevel: true,
            status: true,
          },
        },
      },
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const ratingCount = book.ratings.length;
    const averageRating =
      ratingCount === 0
        ? null
        : Number((book.ratings.reduce((sum, rating) => sum + rating.stars, 0) / ratingCount).toFixed(2));

    const hydratedBook = hydrateBookRecord(book);

    res.json({
      success: true,
      data: {
        ...hydratedBook,
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
  const payload = buildBookPayload(req.body);
  const validationError = validateBookPayload(payload);

  if (validationError) {
    return res.status(400).json({
      error: validationError,
    });
  }

  try {
    const book = await prisma.book.create({
      data: {
        ...payload,
        available: payload.availableCopies > 0,
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

router.put('/:id', requireLibrarianAuth, async (req, res) => {
  const bookId = Number.parseInt(req.params.id, 10);

  if (Number.isNaN(bookId)) {
    return res.status(400).json({ error: 'Invalid book id' });
  }

  const payload = buildBookPayload(req.body);
  const validationError = validateBookPayload(payload);

  if (validationError) {
    return res.status(400).json({
      error: validationError,
    });
  }

  try {
    const existingBook = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        title: true,
        isbn: true,
        loans: {
          select: {
            returnDate: true,
          },
        },
      },
    });

    if (!existingBook) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const activeLoanCount = existingBook.loans.filter((loan) => !loan.returnDate).length;

    if (payload.totalCopies < activeLoanCount) {
      return res.status(400).json({
        error: `totalCopies cannot be less than the ${activeLoanCount} active loan(s) for this book`,
      });
    }

    if (payload.availableCopies + activeLoanCount > payload.totalCopies) {
      return res.status(400).json({
        error: 'availableCopies is too high for the current number of active loans',
      });
    }

    const book = await prisma.book.update({
      where: { id: bookId },
      data: {
        ...payload,
        available: payload.availableCopies > 0,
      },
      select: BOOK_SELECT,
    });

    await writeAuditLog(
      'UPDATE_BOOK',
      book.id,
      `Librarian ${req.librarian.employeeId} updated book "${existingBook.title}" (${existingBook.isbn}).`
    );

    return res.json({
      message: 'Book updated successfully',
      book,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'A book with this ISBN already exists',
      });
    }

    return res.status(500).json({
      error: 'Failed to update book',
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
