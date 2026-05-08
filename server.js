const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const HOST = "127.0.0.1";
const PORT = 7124;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
};

function getContentType(filePath) {
    return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function sendFile(res, filePath, contentType) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("404 Not Found");
            return;
        }

        res.writeHead(200, { "Content-Type": contentType || getContentType(filePath) });
        res.end(data);
    });
}

function normalizeUrlPath(urlPath) {
    const cleanPath = decodeURIComponent((urlPath || "/").split("?")[0]);
    return cleanPath.replace(/\\/g, "/");
}

const server = http.createServer((req, res) => {
    const urlPath = normalizeUrlPath(req.url);

    if (urlPath === "/" || urlPath === "/index.html") {
        return sendFile(res, path.join(ROOT, "baza", "k1.html"), "text/html; charset=utf-8");
    }

    if (/^\/baza\/[^/]+$/.test(urlPath)) {
        return sendFile(res, path.join(ROOT, "baza", "k1.html"), "text/html; charset=utf-8");
    }

    const safeRelative = path.normalize(urlPath.replace(/^\/+/, ""));
    const targetPath = path.join(ROOT, safeRelative);

    if (!targetPath.startsWith(ROOT)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("403 Forbidden");
        return;
    }

    fs.stat(targetPath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("404 Not Found");
            return;
        }

        const contentType = path.basename(targetPath) === "k1"
            ? "text/html; charset=utf-8"
            : getContentType(targetPath);

        sendFile(res, targetPath, contentType);
    });
});

server.listen(PORT, HOST, () => {
    console.log(`HEARTFARM server running at http://${HOST}:${PORT}`);
});
