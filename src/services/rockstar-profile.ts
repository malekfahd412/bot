import axios from "axios";
import * as cheerio from "cheerio";

export type RockstarProfile = {
  username: string;
  avatar?: string;
  profileUrl: string;
  rawHtml?: string;
};

export async function fetchRockstarProfile(username: string): Promise<RockstarProfile | null> {
  try {
    const url = `https://socialclub.rockstargames.com/member/${encodeURIComponent(username)}`;

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const html = res.data;
    const $ = cheerio.load(html);

    // 🖼️ الصورة (أفضل مصدر)
    const avatar =
      $('meta[property="og:image"]').attr("content") ||
      $('img').first().attr("src");

    // 🏷️ الاسم الحقيقي من الصفحة
    const ogTitle =
      $('meta[property="og:title"]').attr("content");

    const cleanUsername =
      ogTitle?.split(" | ")[0] || username;

    return {
      username: cleanUsername,
      avatar,
      profileUrl: url,
      rawHtml: html,
    };

  } catch (err) {
    console.error("Rockstar scrape error:", err);
    return null;
  }
}
