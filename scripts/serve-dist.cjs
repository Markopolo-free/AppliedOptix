const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 8000;
const root = path.join(process.cwd(), 'dist');

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(root, urlPath);

    // Prevent directory traversal
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // SPA fallback: if request looks like a client-side route (no extension)
        // or the client accepts HTML, serve index.html
        const ext = path.extname(urlPath).toLowerCase();
        const accepts = (req.headers['accept'] || '').toString();
        const wantsHtml = accepts.includes('text/html');
        if (!ext || wantsHtml) {
          const indexPath = path.join(root, 'index.html');
          fs.readFile(indexPath, (readErr, data) => {
            if (readErr) {
              res.writeHead(500);
              res.end('Server error');
              return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
          });
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (e) {
    res.writeHead(500);
    res.end('Server error');
  }
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});
