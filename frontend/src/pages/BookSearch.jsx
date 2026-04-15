import { useEffect, useState } from 'react';

function BookSearch() {
  const [searchTitle, setSearchTitle] = useState('');
  const [searchAuthor, setSearchAuthor] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [books, setBooks] = useState([]);
  const [allBooks, setAllBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allLoading, setAllLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedBookDetail, setSelectedBookDetail] = useState(null);

  const API_BASE = 'http://localhost:3001';

  const token = localStorage.getItem('token');

  const fetchAllBooks = async () => {
    setAllLoading(true);

    try {
      const response = await fetch(`${API_BASE}/books`);
      const result = await response.json();
      setAllBooks(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      console.error('Fetch all books error:', error);
      setAllBooks([]);
    } finally {
      setAllLoading(false);
    }
  };

  useEffect(() => {
    fetchAllBooks();
  }, []);

  const runSearch = async () => {
    setLoading(true);
    setMessage('');

    try {
      const params = new URLSearchParams();
      if (searchTitle) params.append('title', searchTitle);
      if (searchAuthor) params.append('author', searchAuthor);
      if (searchKeyword) params.append('keyword', searchKeyword);

      const response = await fetch(`${API_BASE}/books/search?${params}`);
      const result = await response.json();

      if (result.success) {
        setBooks(result.data);
      } else {
        setBooks([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setSearched(true);
    await runSearch();
  };

  const handleViewDetail = async (bookId) => {
    setDetailLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_BASE}/books/${bookId}`);
      const result = await response.json();

      if (!response.ok || !result?.success || !result?.data) {
        setMessage(result?.error || 'Failed to load book detail');
        return;
      }

      setSelectedBookDetail(result.data);
    } catch (error) {
      setMessage('Failed to load book detail: ' + error.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBorrow = async (bookId) => {
    if (!token) {
      setMessage('Please login first');
      return;
    }

    setMessage('');
    try {
      const response = await fetch(`${API_BASE}/loans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookId })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Borrow success!');
        await fetchAllBooks();
        if (searched) {
          await runSearch();
        }
      } else {
        setMessage(data.message || 'Borrow failed');
      }
    } catch (error) {
      setMessage('Borrow failed: ' + error.message);
    }
  };

  const handleReset = () => {
    setSearchTitle('');
    setSearchAuthor('');
    setSearchKeyword('');
    setBooks([]);
    setSearched(false);
    setMessage('');
    fetchAllBooks();
  };

  const renderBookCard = (book, source) => (
    <div key={`${source}-${book.id}`} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', background: 'white' }}>
      <h3 style={{ marginTop: 0, color: '#007bff' }}>{book.title}</h3>
      <p><strong>Author:</strong> {book.author}</p>
      <p><strong>ISBN:</strong> {book.isbn}</p>
      <p><strong>Genre:</strong> {book.genre}</p>
      <p><strong>Location:</strong> {book.shelfLocation || 'N/A'}</p>
      <p><strong>Status:</strong>{' '}
        <span style={{ color: book.available && book.availableCopies > 0 ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
          {book.available && book.availableCopies > 0 ? 'Available' : 'Borrowed'}
        </span>
      </p>

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button
          onClick={() => handleViewDetail(book.id)}
          disabled={detailLoading}
          style={{ padding: '6px 12px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {detailLoading ? 'Loading...' : 'View Details'}
        </button>

        {book.available && book.availableCopies > 0 && (
          <button onClick={() => handleBorrow(book.id)} style={{ padding: '6px 12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Borrow
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>Book Search</h1>

      {message && (
        <div style={{ padding: '10px', marginBottom: '20px', backgroundColor: message.includes('success') ? '#d4edda' : '#f8d7da', color: message.includes('success') ? '#155724' : '#721c24', borderRadius: '4px' }}>
          {message}
        </div>
      )}

      <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
          <label style={{ width: '80px', fontWeight: 'bold' }}>Title:</label>
          <input type="text" value={searchTitle} onChange={(e) => setSearchTitle(e.target.value)} placeholder="Enter book title" style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
        </div>
        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
          <label style={{ width: '80px', fontWeight: 'bold' }}>Author:</label>
          <input type="text" value={searchAuthor} onChange={(e) => setSearchAuthor(e.target.value)} placeholder="Enter author name" style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
        </div>
        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
          <label style={{ width: '80px', fontWeight: 'bold' }}>Keyword:</label>
          <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder="Enter keyword" style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={handleSearch} disabled={loading} style={{ padding: '10px 24px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button onClick={handleReset} style={{ padding: '10px 24px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Reset</button>
        </div>
      </div>

      <h2>All Books ({allBooks.length})</h2>
      {allLoading ? (
        <p>Loading all books...</p>
      ) : allBooks.length === 0 ? (
        <p>No books available</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          {allBooks.map((book) => renderBookCard(book, 'all'))}
        </div>
      )}

      {searched && (
        <>
          <h2>Results ({books.length})</h2>
          {books.length === 0 ? (
            <p>No books found</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {books.map((book) => renderBookCard(book, 'search'))}
            </div>
          )}
        </>
      )}

      {selectedBookDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 999,
          }}
          onClick={() => setSelectedBookDetail(null)}
        >
          <div
            style={{
              width: 'min(900px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{selectedBookDetail.title}</h2>
              <button
                onClick={() => setSelectedBookDetail(null)}
                style={{ border: 'none', background: '#e5e7eb', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

            <p><strong>Author:</strong> {selectedBookDetail.author}</p>
            <p><strong>ISBN:</strong> {selectedBookDetail.isbn}</p>
            <p><strong>Genre:</strong> {selectedBookDetail.genre}</p>
            <p><strong>Language:</strong> {selectedBookDetail.language}</p>
            {selectedBookDetail.description && <p><strong>Description:</strong> {selectedBookDetail.description}</p>}
            {selectedBookDetail.shelfLocation && <p><strong>Shelf Location:</strong> {selectedBookDetail.shelfLocation}</p>}
            <p><strong>Copies:</strong> {selectedBookDetail.availableCopies} / {selectedBookDetail.totalCopies}</p>
            {selectedBookDetail.stats?.averageRating !== null && selectedBookDetail.stats?.averageRating !== undefined && (
              <p><strong>Average Rating:</strong> {selectedBookDetail.stats.averageRating}</p>
            )}
            {(selectedBookDetail._count?.ratings > 0 || selectedBookDetail._count?.holds > 0 || selectedBookDetail._count?.wishlists > 0) && (
              <p>
                <strong>Related Counts:</strong>{' '}
                {selectedBookDetail._count?.ratings > 0 && <span>ratings {selectedBookDetail._count.ratings} </span>}
                {selectedBookDetail._count?.holds > 0 && <span>holds {selectedBookDetail._count.holds} </span>}
                {selectedBookDetail._count?.wishlists > 0 && <span>wishlists {selectedBookDetail._count.wishlists}</span>}
              </p>
            )}

            {selectedBookDetail.ratings?.length > 0 && (
              <>
                <h3>Rating Records</h3>
                <ul>
                  {selectedBookDetail.ratings.map((rating) => (
                    <li key={rating.id}>
                      {rating.user?.name || rating.user?.email || `User#${rating.userId}`} - stars {rating.stars} - created {new Date(rating.createdAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {selectedBookDetail.holds?.length > 0 && (
              <>
                <h3>Hold Records</h3>
                <ul>
                  {selectedBookDetail.holds.map((hold) => (
                    <li key={hold.id}>
                      {hold.user?.name || hold.user?.email || `User#${hold.userId}`} - status {hold.status} - created {new Date(hold.createdAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {selectedBookDetail.wishlists?.length > 0 && (
              <>
                <h3>Wishlist Records</h3>
                <ul>
                  {selectedBookDetail.wishlists.map((wishlist) => (
                    <li key={wishlist.id}>
                      {wishlist.user?.name || wishlist.user?.email || `User#${wishlist.userId}`} - created {new Date(wishlist.createdAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BookSearch;