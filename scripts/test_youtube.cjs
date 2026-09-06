require('dotenv').config();

const clientId = process.env.VITE_YOUTUBE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.VITE_YOUTUBE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.VITE_YOUTUBE_REFRESH_TOKEN || process.env.YOUTUBE_REFRESH_TOKEN;

console.log('=== YouTube Configuration Check ===');
console.log('Client ID configured:', !!clientId, clientId ? clientId.substring(0, 15) + '...' : 'MISSING');
console.log('Client Secret configured:', !!clientSecret);
console.log('Refresh Token configured:', !!refreshToken, refreshToken ? refreshToken.substring(0, 15) + '...' : 'MISSING');

async function testYouTube() {
  if (!clientId || !clientSecret || !refreshToken) {
    console.log('Missing credentials.');
    return;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await res.json();
  if (data.access_token) {
    console.log('Access token acquired successfully (valid for ' + data.expires_in + 's)');

    const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true', {
      headers: { Authorization: 'Bearer ' + data.access_token },
    });
    const channelData = await channelRes.json();

    if (channelData.items && channelData.items.length > 0) {
      const channel = channelData.items[0];
      console.log('Connected YouTube Channel:', channel.snippet.title);
      console.log('Channel ID:', channel.id);
      console.log('Total Videos on Channel:', channel.statistics.videoCount);
      console.log('Custom URL:', channel.snippet.customUrl || 'N/A');

      // Let's also fetch the latest 5 videos uploaded to this channel
      const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;
      console.log('Uploads Playlist ID:', uploadsPlaylistId);

      const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10`, {
        headers: { Authorization: 'Bearer ' + data.access_token },
      });
      const playlistData = await playlistRes.json();
      console.log('\n=== Recent Videos Uploaded to YouTube Channel ===');
      if (playlistData.items && playlistData.items.length > 0) {
        playlistData.items.forEach((item, idx) => {
          const snip = item.snippet;
          console.log(`${idx + 1}. [${snip.resourceId.videoId}] "${snip.title}" (Uploaded: ${snip.publishedAt})`);
          console.log(`   URL: https://www.youtube.com/watch?v=${snip.resourceId.videoId}`);
        });
      } else {
        console.log('No videos found in uploads playlist yet.');
      }
    } else {
      console.log('Channel API response:', channelData);
    }
  } else {
    console.error('Failed to get access token:', data);
  }
}

testYouTube().catch(console.error);
