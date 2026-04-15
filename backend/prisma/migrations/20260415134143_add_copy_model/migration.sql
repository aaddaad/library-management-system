/*
  Warnings:

  - You are about to drop the column `available` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `availableCopies` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `floor` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `libraryArea` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `shelfLevel` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `shelfLocation` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `shelfNo` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `totalCopies` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `bookId` on the `Loan` table. All the data in the column will be lost.
  - Added the required column `copyId` to the `Loan` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Copy" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "barcode" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "libraryArea" TEXT NOT NULL,
    "shelfNo" TEXT NOT NULL,
    "shelfLevel" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Copy_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "publishDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AnnouncementPublisher" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "announcementId" INTEGER NOT NULL,
    CONSTRAINT "AnnouncementPublisher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnnouncementPublisher_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "isbn" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT NOT NULL DEFAULT 'English',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Book" ("author", "createdAt", "description", "genre", "id", "isbn", "language", "title") SELECT "author", "createdAt", "description", "genre", "id", "isbn", "language", "title" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE UNIQUE INDEX "Book_isbn_key" ON "Book"("isbn");
CREATE TABLE "new_Loan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "copyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "checkoutDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME NOT NULL,
    "returnDate" DATETIME,
    "fineAmount" REAL DEFAULT 0,
    "finePaid" BOOLEAN DEFAULT false,
    "fineForgiven" BOOLEAN DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Loan_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "Copy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Loan" ("checkoutDate", "createdAt", "dueDate", "fineAmount", "fineForgiven", "finePaid", "id", "returnDate", "userId") SELECT "checkoutDate", "createdAt", "dueDate", "fineAmount", "fineForgiven", "finePaid", "id", "returnDate", "userId" FROM "Loan";
DROP TABLE "Loan";
ALTER TABLE "new_Loan" RENAME TO "Loan";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Copy_barcode_key" ON "Copy"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementPublisher_userId_announcementId_key" ON "AnnouncementPublisher"("userId", "announcementId");
