// Tiny result collector: appends every request's query string to a file.
const http = require('http')
const fs = require('fs')
const out = process.argv[2]
http
  .createServer((req, res) => {
    const q = decodeURIComponent((req.url || '').replace(/^\/\?/, ''))
    fs.appendFileSync(out, q + '\n')
    res.end('ok')
  })
  .listen(8499, '0.0.0.0')
