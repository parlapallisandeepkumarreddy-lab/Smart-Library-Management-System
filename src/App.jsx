
import React, { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";

import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc
} from "firebase/firestore";

const emptyBook = {
  title: "",
  author: "",
  category: ""
};

const emptyStudent = {
  name: "",
  registerNumber: "",
  department: "",
  gender: "",
  course: ""
};

const today = () => new Date().toISOString().slice(0, 10);

function App() {
  const [page, setPage] = useState("Dashboard");

  const [books, setBooks] = useState([]);
  const [students, setStudents] = useState([]);
  const [issueRecords, setIssueRecords] = useState([]);
  const [paidFines, setPaidFines] = useState([]);

  const [bookForm, setBookForm] = useState(emptyBook);
  const [studentForm, setStudentForm] = useState(emptyStudent);

  const [issueForm, setIssueForm] = useState({
    studentId: "",
    bookId: "",
    dueDate: ""
  });

  const [bookSearch, setBookSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [fineSearch, setFineSearch] = useState("");
  const [message, setMessage] = useState("");

  const finePerDay = 5;

  // Notifications
  function notify(text) {
    setMessage(text);
    setTimeout(() => setMessage(""), 3000);
  }

  // FIRESTORE: Load Books and Students
  useEffect(() => {
    const unsubscribeBooks = onSnapshot(
      collection(db, "books"),
      (snapshot) => {
        setBooks(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data()
          }))
        );
      },
      (error) => {
        console.error("Books error:", error);
        notify("Unable to load books: " + error.message);
      }
    );

    const unsubscribeStudents = onSnapshot(
      collection(db, "students"),
      (snapshot) => {
        setStudents(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data()
          }))
        );
      },
      (error) => {
        console.error("Students error:", error);
        notify("Unable to load students: " + error.message);
      }
    );

    return () => {
      unsubscribeBooks();
      unsubscribeStudents();
    };
  }, []);

  // Dashboard calculations
  const available = books.filter(
    (b) => b.status === "Available"
  ).length;

  const issued = books.filter(
    (b) => b.status === "Issued"
  ).length;

  const overdue = issueRecords.filter(
    (r) => r.status === "Issued" && r.dueDate < today()
  ).length;

  const returnedCount = issueRecords.filter(
    (r) => r.status === "Returned"
  ).length;

  // Fine calculations
  const fineRecords = useMemo(() => {
    return issueRecords.map((record) => {
      const endDate =
        record.status === "Returned" && record.returnDate
          ? record.returnDate
          : today();

      const days = Math.max(
        0,
        Math.floor(
          (
            new Date(endDate + "T00:00:00") -
            new Date(record.dueDate + "T00:00:00")
          ) / 86400000
        )
      );

      return {
        ...record,
        overdueDays: days,
        fine: days * finePerDay,
        paid: paidFines.includes(record.id)
      };
    });
  }, [issueRecords, paidFines]);

  const totalFine = fineRecords.reduce(
    (sum, r) => sum + r.fine, 0
  );

  const pendingFine = fineRecords
    .filter((r) => !r.paid)
    .reduce((sum, r) => sum + r.fine, 0);

  const collectedFine = fineRecords
    .filter((r) => r.paid)
    .reduce((sum, r) => sum + r.fine, 0);

  // Firebase connection test
  async function testFirebase() {
    try {
      const docRef = await addDoc(
        collection(db, "connection_test"),
        {
          message: "Smart Library Firebase Connected",
          createdAt: new Date()
        }
      );

      console.log("Firebase document ID:", docRef.id);
      notify("Firebase connected successfully!");
    } catch (error) {
      console.error(error);
      notify("Firebase error: " + error.message);
    }
  }

  // ADD BOOK
  async function addBook(e) {
    e.preventDefault();

    if (!bookForm.title.trim() || !bookForm.author.trim()) {
      notify("Enter book title and author.");
      return;
    }

    try {
      await addDoc(collection(db, "books"), {
        title: bookForm.title.trim(),
        author: bookForm.author.trim(),
        category: bookForm.category.trim(),
        status: "Available",
        createdAt: new Date()
      });

      setBookForm(emptyBook);
      notify("Book saved to Firestore!");
    } catch (error) {
      console.error(error);
      notify("Unable to save book: " + error.message);
    }
  }

  // DELETE BOOK
  async function deleteBook(id) {
    const book = books.find((b) => b.id === id);

    if (book?.status === "Issued") {
      notify("Return this book before deleting it.");
      return;
    }

    try {
      await deleteDoc(doc(db, "books", id));
      notify("Book deleted successfully.");
    } catch (error) {
      console.error(error);
      notify("Unable to delete book: " + error.message);
    }
  }

  // ADD STUDENT
  async function addStudent(e) {
    e.preventDefault();

    if (
      !studentForm.name.trim() ||
      !studentForm.registerNumber.trim() ||
      !studentForm.department.trim()
    ) {
      notify("Please fill in the required student details.");
      return;
    }

    const duplicate = students.some(
      (s) =>
        s.registerNumber?.toLowerCase() ===
        studentForm.registerNumber.trim().toLowerCase()
    );

    if (duplicate) {
      notify("This register number already exists.");
      return;
    }

    try {
      await addDoc(collection(db, "students"), {
        name: studentForm.name.trim(),
        registerNumber: studentForm.registerNumber.trim(),
        department: studentForm.department.trim(),
        gender: studentForm.gender,
        course: studentForm.course.trim(),
        createdAt: new Date()
      });

      setStudentForm(emptyStudent);
      notify("Student saved to Firestore!");
    } catch (error) {
      console.error(error);
      notify("Unable to save student: " + error.message);
    }
  }

  // DELETE STUDENT
  async function deleteStudent(id) {
    const hasActiveIssue = issueRecords.some(
      (r) => r.studentId === id && r.status === "Issued"
    );

    if (hasActiveIssue) {
      notify("Return the student's books first.");
      return;
    }

    try {
      await deleteDoc(doc(db, "students", id));
      notify("Student deleted successfully.");
    } catch (error) {
      console.error(error);
      notify("Unable to delete student: " + error.message);
    }
  }

  // ISSUE BOOK - TEMPORARY FOR NOW
  function issueBook(e) {
    e.preventDefault();

    const student = students.find(
      (s) => s.id === issueForm.studentId
    );

    const book = books.find(
      (b) => b.id === issueForm.bookId
    );

    if (!student || !book || !issueForm.dueDate) {
      notify("Please select student, book and due date.");
      return;
    }

    if (issueForm.dueDate < today()) {
      notify("Due date cannot be in the past.");
      return;
    }

    if (book.status !== "Available") {
      notify("This book is not available.");
      return;
    }

    const record = {
      id: String(Date.now()),
      studentId: student.id,
      studentName: student.name,
      registerNumber: student.registerNumber,
      bookId: book.id,
      bookTitle: book.title,
      issueDate: today(),
      dueDate: issueForm.dueDate,
      returnDate: "",
      status: "Issued"
    };

    setIssueRecords((prev) => [...prev, record]);

    setBooks((prev) =>
      prev.map((b) =>
        b.id === book.id
          ? { ...b, status: "Issued" }
          : b
      )
    );

    setIssueForm({
      studentId: "",
      bookId: "",
      dueDate: ""
    });

    notify("Book issued successfully (temporary record).");
  }

  // RETURN BOOK - TEMPORARY FOR NOW
  function returnBook(recordId) {
    const record = issueRecords.find(
      (r) => r.id === recordId
    );

    if (!record || record.status !== "Issued") return;

    setIssueRecords((prev) =>
      prev.map((r) =>
        r.id === recordId
          ? {
              ...r,
              status: "Returned",
              returnDate: today()
            }
          : r
      )
    );

    setBooks((prev) =>
      prev.map((b) =>
        b.id === record.bookId
          ? { ...b, status: "Available" }
          : b
      )
    );

    notify("Book returned successfully (temporary record).");
  }

  // MARK FINE PAID - TEMPORARY FOR NOW
  function markFinePaid(recordId) {
    setPaidFines((prev) =>
      prev.includes(recordId)
        ? prev
        : [...prev, recordId]
    );

    notify("Fine marked as paid (temporary record).");
  }

  // EXPORT CSV
  function exportCSV() {
    const headers = [
      "Student Name",
      "Register Number",
      "Book",
      "Issue Date",
      "Due Date",
      "Return Date",
      "Status"
    ];

    const rows = issueRecords.map((r) => [
      r.studentName,
      r.registerNumber,
      r.bookTitle,
      r.issueDate,
      r.dueDate,
      r.returnDate || "",
      r.status
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) =>
          `"${String(value).replace(/"/g, '""')}"`
        ).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "library-report.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    notify("Report exported successfully.");
  }

  // Search filters
  const filteredBooks = books.filter((b) =>
    `${b.title} ${b.author} ${b.category}`
      .toLowerCase()
      .includes(bookSearch.toLowerCase())
  );

  const filteredStudents = students.filter((s) =>
    `${s.name} ${s.registerNumber} ${s.department}`
      .toLowerCase()
      .includes(studentSearch.toLowerCase())
  );

  const filteredFines = fineRecords.filter((r) =>
    `${r.studentName} ${r.bookTitle} ${r.registerNumber}`
      .toLowerCase()
      .includes(fineSearch.toLowerCase())
  );

  const navItems = [
    "Dashboard",
    "Books",
    "Students",
    "Issue Books",
    "Returns",
    "Fines",
    "Reports",
    "Settings"
  ];

  // CSS
  const styles = `
    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f4f6fb;
      color: #172033;
    }

    button, input, select { font: inherit; }

    .app { display: flex; min-height: 100vh; }

    .sidebar {
      width: 235px;
      background: #172554;
      color: white;
      padding: 25px 15px;
      flex-shrink: 0;
    }

    .brand {
      font-size: 21px;
      font-weight: bold;
      margin: 5px 10px 35px;
    }

    .nav {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .nav button {
      border: 0;
      background: transparent;
      color: #dbeafe;
      text-align: left;
      padding: 13px;
      border-radius: 8px;
      cursor: pointer;
    }

    .nav button.active,
    .nav button:hover {
      background: #2563eb;
      color: white;
    }

    .main {
      flex: 1;
      min-width: 0;
      padding: 28px;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 15px;
      margin-bottom: 25px;
      flex-wrap: wrap;
    }

    h1 { margin: 0 0 7px; font-size: 26px; }

    .muted { color: #64748b; font-size: 14px; }

    .cards {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 22px;
    }

    .card, .panel {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 2px 10px #1725540c;
    }

    .card strong {
      display: block;
      font-size: 28px;
      margin-top: 12px;
    }

    .panel { margin-bottom: 20px; }

    .panel h2 {
      font-size: 18px;
      margin: 0 0 17px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    input, select {
      width: 100%;
      padding: 11px;
      border: 1px solid #dbe1ec;
      border-radius: 7px;
      background: white;
    }

    .btn {
      background: #2563eb;
      color: white;
      border: 0;
      border-radius: 7px;
      padding: 11px 16px;
      cursor: pointer;
    }

    .btn:hover { background: #1d4ed8; }
    .btn.danger { background: #dc2626; }
    .btn.success { background: #15803d; }
    .btn.gray { background: #475569; }

    .table-wrap { overflow-x: auto; }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 650px;
    }

    th, td {
      padding: 13px 10px;
      text-align: left;
      border-bottom: 1px solid #edf0f5;
      font-size: 14px;
    }

    th {
      color: #64748b;
      background: #f8fafc;
    }

    .status {
      display: inline-block;
      padding: 5px 9px;
      border-radius: 20px;
      font-size: 12px;
      background: #dcfce7;
      color: #166534;
    }

    .status.issued {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .status.overdue {
      background: #fee2e2;
      color: #b91c1c;
    }

    .status.paid {
      background: #dcfce7;
      color: #166534;
    }

    .status.pending {
      background: #fef3c7;
      color: #92400e;
    }

    .search {
      max-width: 320px;
      margin-bottom: 15px;
    }

    .bar {
      height: 10px;
      background: #e2e8f0;
      border-radius: 20px;
      overflow: hidden;
      margin: 8px 0 17px;
    }

    .bar span {
      display: block;
      height: 100%;
      background: #2563eb;
    }

    .toast {
      position: fixed;
      right: 22px;
      bottom: 22px;
      background: #172554;
      color: white;
      padding: 14px 20px;
      border-radius: 8px;
      z-index: 10;
      max-width: 90%;
    }

    .empty {
      text-align: center;
      color: #64748b;
      padding: 25px;
    }

    .setting-row {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      padding: 14px 0;
      border-bottom: 1px solid #edf0f5;
    }

    @media (max-width: 950px) {
      .cards { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 650px) {
      .app { display: block; }
      .sidebar { width: 100%; padding: 15px; }
      .brand { margin: 5px 5px 15px; }
      .nav { flex-direction: row; overflow-x: auto; }
      .nav button { white-space: nowrap; }
      .main { padding: 18px; }
      .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .form-grid { grid-template-columns: 1fr; }
    }
  `;

  function metric(label, value, description) {
    return (
      <div className="card" key={label}>
        <div className="muted">{label}</div>
        <strong>{value}</strong>
        <div className="muted">{description}</div>
      </div>
    );
  }

  // DASHBOARD
  function renderDashboard() {
    return (
      <>
        <div className="cards">
          {metric("Total Books", books.length, "Books in library")}
          {metric("Available Books", available, "Ready to issue")}
          {metric("Issued Books", issued, "Currently borrowed")}
          {metric("Total Students", students.length, "Registered students")}
        </div>

        <div className="cards">
          {metric("Overdue Books", overdue, "Past their due date")}
          {metric("Returned Books", returnedCount, "Completed returns")}
          {metric("Pending Fines", `₹${pendingFine}`, "Unpaid fines")}
          {metric("Fine Collected", `₹${collectedFine}`, "Marked as paid")}
        </div>

        <div className="panel">
          <h2>Recent Issue Activity</h2>

          {issueRecords.length === 0 ? (
            <div className="empty">No book issue records yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Book</th>
                    <th>Issue Date</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...issueRecords].reverse().slice(0, 5).map((r) => (
                    <tr key={r.id}>
                      <td>{r.studentName}</td>
                      <td>{r.bookTitle}</td>
                      <td>{r.issueDate}</td>
                      <td>{r.dueDate}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  // BOOKS
  function renderBooks() {
    return (
      <>
        <div className="panel">
          <h2>Add New Book</h2>

          <form onSubmit={addBook} className="form-grid">
            <input
              placeholder="Book title"
              value={bookForm.title}
              onChange={(e) =>
                setBookForm({ ...bookForm, title: e.target.value })
              }
              required
            />

            <input
              placeholder="Author"
              value={bookForm.author}
              onChange={(e) =>
                setBookForm({ ...bookForm, author: e.target.value })
              }
              required
            />

            <input
              placeholder="Category"
              value={bookForm.category}
              onChange={(e) =>
                setBookForm({ ...bookForm, category: e.target.value })
              }
            />

            <button className="btn">Add Book</button>
          </form>
        </div>

        <div className="panel">
          <h2>Book Collection</h2>

          <input
            className="search"
            placeholder="Search books..."
            value={bookSearch}
            onChange={(e) => setBookSearch(e.target.value)}
          />

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Author</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredBooks.map((b) => (
                  <tr key={b.id}>
                    <td>{b.title}</td>
                    <td>{b.author}</td>
                    <td>{b.category}</td>
                    <td>{b.status}</td>
                    <td>
                      <button
                        className="btn danger"
                        onClick={() => deleteBook(b.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredBooks.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty">
                      No books found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  // STUDENTS
  function renderStudents() {
    return (
      <>
        <div className="panel">
          <h2>Register Student</h2>

          <form onSubmit={addStudent} className="form-grid">
            <input
              placeholder="Student name"
              value={studentForm.name}
              onChange={(e) =>
                setStudentForm({ ...studentForm, name: e.target.value })
              }
              required
            />

            <input
              placeholder="Register number"
              value={studentForm.registerNumber}
              onChange={(e) =>
                setStudentForm({
                  ...studentForm,
                  registerNumber: e.target.value
                })
              }
              required
            />

            <input
              placeholder="Department"
              value={studentForm.department}
              onChange={(e) =>
                setStudentForm({
                  ...studentForm,
                  department: e.target.value
                })
              }
              required
            />

            <select
              value={studentForm.gender}
              onChange={(e) =>
                setStudentForm({ ...studentForm, gender: e.target.value })
              }
            >
              <option value="">Select gender</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>

            <input
              placeholder="Course"
              value={studentForm.course}
              onChange={(e) =>
                setStudentForm({ ...studentForm, course: e.target.value })
              }
            />

            <button className="btn">Register Student</button>
          </form>
        </div>

        <div className="panel">
          <h2>Student Records</h2>

          <input
            className="search"
            placeholder="Search students..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
          />

          {filteredStudents.length === 0 ? (
            <div className="empty">No students registered yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Register No.</th>
                    <th>Department</th>
                    <th>Gender</th>
                    <th>Course</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.registerNumber}</td>
                      <td>{s.department}</td>
                      <td>{s.gender || "—"}</td>
                      <td>{s.course || "—"}</td>
                      <td>
                        <button
                          className="btn danger"
                          onClick={() => deleteStudent(s.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  // ISSUE BOOKS
  function renderIssueBooks() {
    const activeIssues = issueRecords.filter(
      (r) => r.status === "Issued"
    );

    return (
      <>
        <div className="panel">
          <h2>Issue a Book</h2>

          <form onSubmit={issueBook} className="form-grid">
            <select
              value={issueForm.studentId}
              onChange={(e) =>
                setIssueForm({
                  ...issueForm,
                  studentId: e.target.value
                })
              }
              required
            >
              <option value="">Select student</option>

              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.registerNumber})
                </option>
              ))}
            </select>

            <select
              value={issueForm.bookId}
              onChange={(e) =>
                setIssueForm({
                  ...issueForm,
                  bookId: e.target.value
                })
              }
              required
            >
              <option value="">Select available book</option>

              {books
                .filter((b) => b.status === "Available")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
            </select>

            <input
              type="date"
              min={today()}
              value={issueForm.dueDate}
              onChange={(e) =>
                setIssueForm({
                  ...issueForm,
                  dueDate: e.target.value
                })
              }
              required
            />

            <button
              className="btn"
              disabled={
                students.length === 0 ||
                !books.some((b) => b.status === "Available")
              }
            >
              Issue Book
            </button>
          </form>

          {students.length === 0 && (
            <p className="muted">
              Register a student before issuing a book.
            </p>
          )}
        </div>

        <div className="panel">
          <h2>Active Issues</h2>

          {activeIssues.length === 0 ? (
            <div className="empty">No active book issues.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Register No.</th>
                    <th>Book</th>
                    <th>Issue Date</th>
                    <th>Due Date</th>
                  </tr>
                </thead>

                <tbody>
                  {activeIssues.map((r) => (
                    <tr key={r.id}>
                      <td>{r.studentName}</td>
                      <td>{r.registerNumber}</td>
                      <td>{r.bookTitle}</td>
                      <td>{r.issueDate}</td>
                      <td>{r.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  // RETURNS
  function renderReturns() {
    const activeIssues = issueRecords.filter(
      (r) => r.status === "Issued"
    );

    const returnedIssues = issueRecords.filter(
      (r) => r.status === "Returned"
    );

    return (
      <div className="panel">
        <h2>Book Returns</h2>

        {activeIssues.length === 0 ? (
          <div className="empty">No books waiting to be returned.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Book</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {activeIssues.map((r) => (
                  <tr key={r.id}>
                    <td>{r.studentName}</td>
                    <td>{r.bookTitle}</td>
                    <td>{r.issueDate}</td>
                    <td>{r.dueDate}</td>
                    <td>
                      <button
                        className="btn success"
                        onClick={() => returnBook(r.id)}
                      >
                        Return Book
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 style={{ marginTop: 25 }}>Return History</h2>

        {returnedIssues.length === 0 ? (
          <div className="empty">No returned books yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Book</th>
                  <th>Return Date</th>
                </tr>
              </thead>

              <tbody>
                {returnedIssues.map((r) => (
                  <tr key={r.id}>
                    <td>{r.studentName}</td>
                    <td>{r.bookTitle}</td>
                    <td>{r.returnDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // FINES
  function renderFines() {
    return (
      <>
        <div className="cards">
          {metric("Total Fine", `₹${totalFine}`, "Calculated fines")}
          {metric("Pending Fine", `₹${pendingFine}`, "Awaiting payment")}
          {metric("Collected Fine", `₹${collectedFine}`, "Marked as paid")}
          {metric("Fine Per Day", `₹${finePerDay}`, "Project fine rate")}
        </div>

        <div className="panel">
          <h2>Fine Management</h2>

          <input
            className="search"
            placeholder="Search student or book..."
            value={fineSearch}
            onChange={(e) => setFineSearch(e.target.value)}
          />

          {filteredFines.length === 0 ? (
            <div className="empty">No fine records found.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Book</th>
                    <th>Due Date</th>
                    <th>Overdue Days</th>
                    <th>Fine</th>
                    <th>Payment</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredFines.map((r) => (
                    <tr key={r.id}>
                      <td>{r.studentName}</td>
                      <td>{r.bookTitle}</td>
                      <td>{r.dueDate}</td>
                      <td>{r.overdueDays}</td>
                      <td>₹{r.fine}</td>
                      <td>
                        <span className={`status ${r.paid ? "paid" : "pending"}`}>
                          {r.paid ? "Paid" : "Pending"}
                        </span>
                      </td>
                      <td>
                        {r.fine > 0 && !r.paid ? (
                          <button
                            className="btn success"
                            onClick={() => markFinePaid(r.id)}
                          >
                            Mark Paid
                          </button>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="muted">
            Fine calculation: ₹{finePerDay} per overdue day.
            Payment status is temporary, not an online payment.
          </p>
        </div>
      </>
    );
  }

  // REPORTS
  function renderReports() {
    const bookPercentage = (value) =>
      books.length
        ? Math.round((value / books.length) * 100)
        : 0;

    return (
      <>
        <div className="cards">
          {metric("Total Books", books.length, "Current collection")}
          {metric("Total Students", students.length, "Registered students")}
          {metric("Total Issues", issueRecords.length, "Issue transactions")}
          {metric("Overdue Books", overdue, "Active overdue issues")}
        </div>

        <div className="panel">
          <div className="topbar">
            <div>
              <h2>Book Inventory Overview</h2>
              <p className="muted">Current book availability</p>
            </div>

            <button className="btn" onClick={exportCSV}>
              Export CSV Report
            </button>
          </div>

          <p>
            Available Books — {available} ({bookPercentage(available)}%)
          </p>
          <div className="bar">
            <span style={{ width: `${bookPercentage(available)}%` }} />
          </div>

          <p>
            Issued Books — {issued} ({bookPercentage(issued)}%)
          </p>
          <div className="bar">
            <span style={{ width: `${bookPercentage(issued)}%` }} />
          </div>

          <p className="muted">
            Returned transactions: {returnedCount}.
          </p>
        </div>

        <div className="panel">
          <h2>Issue History Report</h2>

          {issueRecords.length === 0 ? (
            <div className="empty">No issue history available.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Register No.</th>
                    <th>Book</th>
                    <th>Issue Date</th>
                    <th>Due Date</th>
                    <th>Return Date</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {issueRecords.map((r) => (
                    <tr key={r.id}>
                      <td>{r.studentName}</td>
                      <td>{r.registerNumber}</td>
                      <td>{r.bookTitle}</td>
                      <td>{r.issueDate}</td>
                      <td>{r.dueDate}</td>
                      <td>{r.returnDate || "—"}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Fine Summary</h2>
          <p>Total calculated fine: <strong>₹{totalFine}</strong></p>
          <p>Fine collected: <strong>₹{collectedFine}</strong></p>
          <p>Pending fine: <strong>₹{pendingFine}</strong></p>
        </div>
      </>
    );
  }

  // SETTINGS
  function renderSettings() {
    return (
      <div className="panel">
        <h2>Library Settings</h2>

        <div className="setting-row">
          <span>Application Name</span>
          <strong>Smart Library Management System</strong>
        </div>

        <div className="setting-row">
          <span>Fine Per Day</span>
          <strong>₹{finePerDay}</strong>
        </div>

        <div className="setting-row">
          <span>Storage</span>
          <strong>Firebase Firestore</strong>
        </div>

        <div className="setting-row">
          <span>Books and Students</span>
          <strong>Firestore Connected</strong>
        </div>

        <div className="setting-row">
          <span>Issue Records and Fines</span>
          <strong>Temporary browser memory</strong>
        </div>

        <div className="setting-row">
          <span>Backup</span>
          <strong>CSV export available</strong>
        </div>

        <p className="muted">
          Books and students are saved in Firestore.
          Issue records and fine payments will be connected next.
        </p>

        <button className="btn" onClick={testFirebase}>
          Test Firebase Connection
        </button>
      </div>
    );
  }

  const pageContent = {
    Dashboard: renderDashboard,
    Books: renderBooks,
    Students: renderStudents,
    "Issue Books": renderIssueBooks,
    Returns: renderReturns,
    Fines: renderFines,
    Reports: renderReports,
    Settings: renderSettings
  };

  return (
    <>
      <style>{styles}</style>

      <div className="app">
        <aside className="sidebar">
          <div className="brand">📚 Smart Library</div>

          <nav className="nav">
            {navItems.map((item) => (
              <button
                key={item}
                className={page === item ? "active" : ""}
                onClick={() => setPage(item)}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <main className="main">
          <div className="topbar">
            <div>
              <h1>{page}</h1>
              <div className="muted">
                Smart Library Management System
              </div>
            </div>

            <div className="muted">Administrator</div>
          </div>

          {pageContent[page]()}
        </main>
      </div>

      {message && <div className="toast">{message}</div>}
    </>
  );
}

export default App;
