const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1wbG95ZWVJZCI6ImxpYnJhcmlhbkBsaWJyYXJ5LmNvbSIsIm5hbWUiOiJMaWJyYXJpYW4gVXNlciIsImlhdCI6MTc3NjI2MTAzMywiZXhwIjoxNzc2ODY1ODMzfQ.FOIV9clJbLIU0XGr9rVQOgN-qiXrvN8QerFRX_G8Igk';

fetch('http://localhost:3001/api/loans/users/search?keyword=student', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(d => console.log(JSON.stringify(d, null, 2)));