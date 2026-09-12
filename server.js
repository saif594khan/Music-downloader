const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const youtubeDl = require("youtube-dl-exec");

const app = express();
app.use(express.json());

// Handle public static folder or root directory serve
const publicPath = path.join(__dirname, "public");
const staticDir = fs.existsSync(publicPath) ? publicPath : __dirname;
app.use(express.static(staticDir));

const PORT = 8080;

// Resolve binary path using youtube-dl-exec or local node_modules fallback
const ytDlpPath = youtubeDl.getYtDlpPath
  ? youtubeDl.getYtDlpPath()
  : process.platform === "win32"
  ? path.join(__dirname, "node_modules", "youtube-dl-exec", "bin", "yt-dlp.exe")
  : path.join(__dirname, "node_modules", "youtube-dl-exec", "bin", "yt-dlp");

function sanitizeFilename(filename) {
  return filename.replace(/[\\/:*?"<>|]/g, "").trim();
}

// Extract Title and Thumbnail with DRM fallback headers
async function getTrackMetadata(targetUrl) {
  return new Promise((resolve) => {
    const process = spawn(ytDlpPath, [
      targetUrl,
      "--get-title",
      "--get-thumbnail",
      "--no-playlist",
      "--no-check-certificates",
      "--check-formats",
      "--extractor-args", "youtube:player_client=android,web",
      "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ]);

    let output = "";

    process.stdout.on("data", (data) => {
      output += data.toString();
    });

    process.on("close", () => {
      const lines = output.trim().split("\n").filter(Boolean);
      const title = sanitizeFilename(lines[0] || `music_${Date.now()}`);
      const thumbnail = lines[1] || "";
      resolve({ title, thumbnail });
    });
  });
}

app.get("/", (req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

app.post("/download", async (req, res) => {
  const { url } = req.body;
  const uniqueId = Date.now();

  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
    return res.status(400).json({
      error: "Validation failed",
      details: "Invalid URL structure. Please provide a link starting with http:// or https://"
    });
  }

  try {
    console.log(`📥 Incoming link acquisition: ${url}`);

    const metadata = await getTrackMetadata(url);
    const { title: originalTitle, thumbnail } = metadata;
    console.log(`🎵 Metadata resolved: "${originalTitle}"`);

    let ffmpegPath;
    try {
      ffmpegPath = require("ffmpeg-static");
    } catch (e) {
      ffmpegPath = "ffmpeg";
    }

    const outputFilename = `${uniqueId}_audio.mp3`;
    const outputPath = path.join(__dirname, outputFilename);

    const args = [
  url,
  "-f", "bestaudio/best",
  "-x",
  "--audio-format", "mp3",
  "--add-metadata",
  "--embed-thumbnail",          // <-- Embeds cover art into the MP3
  "--convert-thumbnails", "jpg", // <-- Ensures image format is compatible with MP3
  "--no-check-certificates",
  "--check-formats",
  "--extractor-args", "youtube:player_client=android,web",
  "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "-o", outputPath,
  "--no-playlist"
];

    if (ffmpegPath) {
      args.push("--ffmpeg-location", ffmpegPath);
    }

    console.log("⚡ Executing extraction pipeline...");
    const downloader = spawn(ytDlpPath, args);

    downloader.stderr.on("data", (data) => {
      console.error(`[yt-dlp log]: ${data.toString()}`);
    });

    downloader.on("close", (code) => {
      if (code !== 0 || !fs.existsSync(outputPath)) {
        return res.status(500).json({
          error: "Conversion error",
          details: `Extraction process failed with exit code ${code}`
        });
      }

      console.log(`✅ Extraction finished. Sending file...`);

      const safeDownloadName = encodeURIComponent(`${originalTitle}.mp3`);
      
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${safeDownloadName}`);
      if (thumbnail) {
        res.setHeader("x-thumbnail-url", encodeURIComponent(thumbnail));
      }

      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);

      fileStream.on("end", () => {
        fs.unlink(outputPath, (err) => {
          if (err) console.error("Temporary file cleanup error:", err);
        });
      });
    });

  } catch (err) {
    console.error("Pipeline Exception:", err);
    res.status(500).json({
      error: "Internal Server Failure",
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Music Downloader Server operational on http://localhost:${PORT}`);
});