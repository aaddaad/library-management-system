import { useEffect, useState } from 'react'

const API_URL = 'http://localhost:3001/api'

export default function LibrarianBorrow() {
  const [studentKeyword, setStudentKeyword] = useState('')
  const [bookKeyword, setBookKeyword] = useState('')
  const [students, setStudents] = useState([])
  const [books, setBooks] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)
  const [loanRecords, setLoanRecords] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const token = localStorage.getItem('librarianToken')

  const buildHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  })

  const searchStudents = async () => {
    setError('')
    setMessage('')
    if (!studentKeyword.trim()) {
      setError('请输入学生学号或邮箱后再搜索。')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/loans/users/search?keyword=${encodeURIComponent(studentKeyword)}`, {
        headers: buildHeaders(),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '学生搜索失败')
      }

      setStudents(data.users || [])
      setSelectedStudent(null)
      if ((data.users || []).length === 0) {
        setMessage('未找到匹配的学生。')
      }
    } catch (err) {
      setError(err.message || '学生搜索失败')
    } finally {
      setLoading(false)
    }
  }

  const searchBooks = async () => {
    setError('')
    setMessage('')
    if (!bookKeyword.trim()) {
      setError('请输入图书名称或 ISBN 后再搜索。')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/loans/books/search?keyword=${encodeURIComponent(bookKeyword)}`, {
        headers: buildHeaders(),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '图书搜索失败')
      }

      setBooks(data.books || [])
      setSelectedBook(null)
      if ((data.books || []).length === 0) {
        setMessage('未找到匹配的图书。')
      }
    } catch (err) {
      setError(err.message || '图书搜索失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchLoanRecords = async () => {
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/loans/records`, {
        headers: buildHeaders(),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || '获取借阅记录失败')
      }
      setLoanRecords(data.loans || [])
    } catch (err) {
      setError(err.message || '获取借阅记录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleReturn = async (loanId) => {
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/loans/return`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ loanId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || '还书失败')
      }
      setMessage(`还书成功，归还日期：${new Date(data.returnDate).toLocaleDateString()}`)
      await fetchLoanRecords()
    } catch (err) {
      setError(err.message || '还书失败')
    } finally {
      setLoading(false)
    }
  }

  const handleLend = async () => {
    setError('')
    setMessage('')

    if (!selectedStudent || !selectedBook) {
      setError('请先选择学生和图书。')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/loans/lend`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ userId: selectedStudent.id, bookId: selectedBook.id }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '借书失败')
      }

      setMessage(`借书成功，归还日期：${new Date(data.loan.dueDate).toLocaleDateString()}`)
      setSelectedStudent(null)
      setSelectedBook(null)
      setStudents([])
      setBooks([])
      setStudentKeyword('')
      setBookKeyword('')
      fetchLoanRecords()
    } catch (err) {
      setError(err.message || '借书失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLoanRecords()
  }, [])

  const renderLoanRecords = () => (
    <section className="bg-white rounded-lg shadow-lg p-6 mt-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">借阅记录管理</h2>
          <p className="text-sm text-gray-500">查看当前借阅记录并处理还书。</p>
        </div>
        <button
          type="button"
          onClick={fetchLoanRecords}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          disabled={loading}
        >
          刷新记录
        </button>
      </div>

      {loanRecords.length === 0 && (
        <div className="text-sm text-gray-500">当前没有在借记录。</div>
      )}

      {loanRecords.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left">学生</th>
                <th className="border border-gray-200 px-3 py-2 text-left">图书</th>
                <th className="border border-gray-200 px-3 py-2 text-left">借出日期</th>
                <th className="border border-gray-200 px-3 py-2 text-left">应还日期</th>
                <th className="border border-gray-200 px-3 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {loanRecords.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2">
                    {loan.user?.name || '未知'} ({loan.user?.studentId || '无'})
                  </td>
                  <td className="border border-gray-200 px-3 py-2">
                    {loan.copy?.book?.title || '未知'}
                  </td>
                  <td className="border border-gray-200 px-3 py-2">{new Date(loan.checkoutDate).toLocaleDateString()}</td>
                  <td className="border border-gray-200 px-3 py-2">{new Date(loan.dueDate).toLocaleDateString()}</td>
                  <td className="border border-gray-200 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleReturn(loan.id)}
                      className="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700"
                      disabled={loading}
                    >
                      还书
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )

  return (
    <section className="bg-white rounded-lg shadow-lg p-6 mt-8">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">借出图书给学生</h2>
          <p className="text-sm text-gray-500">搜索学生和图书，然后为学生创建借阅记录，并自动记录应还日期。</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">学生搜索</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={studentKeyword}
                onChange={(e) => setStudentKeyword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="按学号或邮箱搜索"
              />
              <button
                type="button"
                onClick={searchStudents}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                disabled={loading}
              >
                搜索
              </button>
            </div>
            {students.length > 0 && (
              <div className="grid gap-2">
                {students.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedStudent(student)}
                    className={`text-left p-3 border rounded-lg transition ${selectedStudent?.id === student.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-400'}`}
                  >
                    <div className="font-semibold">{student.name} ({student.studentId})</div>
                    <div className="text-sm text-gray-500">{student.email}</div>
                    <div className="text-xs text-gray-400">当前借阅：{student.currentBorrowCount} 本，逾期：{student.hasOverdue ? '是' : '否'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">图书搜索</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={bookKeyword}
                onChange={(e) => setBookKeyword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="按书名或 ISBN 搜索"
              />
              <button
                type="button"
                onClick={searchBooks}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                disabled={loading}
              >
                搜索
              </button>
            </div>
            {books.length > 0 && (
              <div className="grid gap-2">
                {books.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => setSelectedBook(book)}
                    className={`text-left p-3 border rounded-lg transition ${selectedBook?.id === book.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-400'}`}
                  >
                    <div className="font-semibold">{book.title}</div>
                    <div className="text-sm text-gray-500">{book.author} / {book.isbn}</div>
                    <div className="text-xs text-gray-400">可借副本：{book.availableCopies} / {book.totalCopies}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-blue-50">
          <div className="text-sm text-gray-700">已选学生：{selectedStudent ? `${selectedStudent.name} (${selectedStudent.studentId})` : '未选择'}</div>
          <div className="text-sm text-gray-700">已选图书：{selectedBook ? selectedBook.title : '未选择'}</div>
        </div>

        {error && <div className="text-red-600">{error}</div>}
        {message && <div className="text-green-600">{message}</div>}

        <button
          type="button"
          onClick={handleLend}
          disabled={loading}
          className="self-start bg-green-600 text-white px-5 py-3 rounded-lg hover:bg-green-700 disabled:opacity-60"
        >
          {loading ? '处理中…' : '借书给学生'}
        </button>
      </div>

      {renderLoanRecords()}
    </section>
  )
}
