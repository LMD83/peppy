import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "design-reference");
const port = 4321;
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".csv": "text/csv",
};

http
  .createServer((req, res) => {
    let rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (rel === "/" || rel.endsWith("/")) rel = "/TARA Website.dc.html";
    const filePath = path.join(root, rel);

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
      });
      res.end(data);
    });
  })
  .listen(port, () => {
    console.log(`TARA design reference: http://localhost:${port}/TARA%20Website.dc.html`);
  });
