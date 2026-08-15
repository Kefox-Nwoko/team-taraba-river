import "dotenv/config";

async function parseYouTubeRss(xmlText: string) {
  const entries: Array<{ videoId: string; title: string; published: string; link: string; thumbnail: string }> = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xmlText)) !== null) {
    const block = match[1];
    const idMatch = block.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
    const titleMatch = block.match(/<title>(.*?)<\/title>/);
    const pubMatch = block.match(/<published>(.*?)<\/published>/);
    const linkMatch = block.match(/<link rel="alternate" href="(.*?)"/);
    const thumbMatch = block.match(/<media:thumbnail url="(.*?)"/);

    if (idMatch && titleMatch) {
      const videoId = idMatch[1].trim();
      entries.push({
        videoId,
        title: titleMatch[1].trim().replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
        published: pubMatch ? pubMatch[1].trim().split('T')[0] : new Date().toISOString().split('T')[0],
        link: linkMatch ? linkMatch[1] : `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: thumbMatch ? thumbMatch[1] : `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      });
    }
  }
  return entries;
}

async function run() {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw`;
  const res = await fetch(rssUrl);
  const xml = await res.text();
  const parsed = await parseYouTubeRss(xml);
  console.log(`Parsed ${parsed.length} YouTube videos from feed:`);
  console.log(JSON.stringify(parsed.slice(0, 3), null, 2));
}

run();
