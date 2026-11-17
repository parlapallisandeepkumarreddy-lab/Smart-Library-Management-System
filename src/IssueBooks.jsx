
import React, { useState } from 'react'

function IssueBooks({
  students = [],
  books = [],
  issueRecords = [],
  onIssue,
  onReturn
}) {
  const [studentId, setStudentId] = useState('')
  const [bookId, setBookId] = useState('')
  const [dueDate, setDueDate] = useState('')

  const today = new Date().toISOString().split('T')[0]

  function handleIssue(e) {
    e.preventDefault()

    const student = students.find(
      s => String(s.id) === studentId
    )

    const book = books.find(
      b => String(b.id) === bookId
    )

    if (!student || !book || !dueDate) {
      alert('Please fill all details.')
      return
    }

    if (dueDate < today) {
      alert('Due date cannot be in the past.')
      return
    }

    if (book.status !== 'Available') {
      alert('This book is not available.')
      return
    }

    onIssue(student, book, dueDate)

    setStudentId('')
    setBookId('')
    setDueDate('')
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">

      <h2 className="text-xl font-bold mb-2">
        Book Issue & Return Management
      </h2>

      <p className="text-slate-500 mb-6">
        Issue books to registered students and manage returns.
      </p>

      <form
        onSubmit={handleIssue}
        className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
      >

        <select
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
          required
          className="border p-3 rounded-xl bg-white"
        >
          <option value="">Select Student</option>

          {students.map(student => (
            <option key={student.id} value={student.id}>
              {student.name} ({student.studentId})
            </option>
          ))}
        </select>

        <select
          value={bookId}
          onChange={e => setBookId(e.target.value)}
          required
          className="border p-3 rounded-xl bg-white"
        >
          <option value="">Select Available Book</option>

          {books
            .filter(book => book.status === 'Available')
            .map(book => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
        </select>

        <input
          type="date"
          value={dueDate}
          min={today}
          onChange={e => setDueDate(e.target.value)}
          required
          className="border p-3 rounded-xl"
        />

        <button
          type="submit"
          disabled={!students.length || !books.some(b => b.status === 'Available')}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-3 disabled:opacity-50"
        >
          Issue Book
        </button>

      </form>

      <h3 className="font-bold text-lg mb-4">
        Issue Records
      </h3>

      <div className="overflow-x-auto">

        <table className="w-full text-left min-w-[700px]">

          <thead>
            <tr className="border-b text-slate-500 text-sm">
              <th className="p-3">Student</th>
              <th className="p-3">Book</th>
              <th className="p-3">Issue Date</th>
              <th className="p-3">Due Date</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>

          <tbody>

            {issueRecords.map(record => {

              const isOverdue =
                record.status === 'Issued' &&
                record.dueDate < today

              return (
                <tr key={record.id} className="border-b hover:bg-slate-50">

                  <td className="p-3 font-medium">
                    {record.studentName}
                  </td>

                  <td className="p-3">
                    {record.bookTitle}
                  </td>

                  <td className="p-3">
                    {record.issueDate}
                  </td>

                  <td className="p-3">
                    {record.dueDate}
                  </td>

                  <td className="p-3">
                    <span className={`px-3 py-1 rounded-full text-xs ${
                      isOverdue
                        ? 'bg-red-100 text-red-700'
                        : record.status === 'Returned'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {isOverdue ? 'Overdue' : record.status}
                    </span>
                  </td>

                  <td className="p-3">
                    {record.status === 'Issued' && (
                      <button
                        onClick={() => onReturn(record.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg"
                      >
                        Return Book
                      </button>
                    )}
                  </td>

                </tr>
              )
            })}

            {issueRecords.length === 0 && (
              <tr>
                <td colSpan="6" className="p-5 text-center text-slate-500">
                  No issue records found.
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>
    </div>
  )
}

export default IssueBooks
