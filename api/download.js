const YTDLP = require('yt-dlp-exec');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract video URL from request body or query parameters
    const url = req.method === 'POST' ? req.body?.url : req.query?.url;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Extract video metadata (title and direct stream URL)
    const info = await YTDLP(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });

    return res.status(200).json({
      success: true,
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      downloadUrl: info.url || info.requested_downloads?.[0]?.url,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to process video' });
  }
};