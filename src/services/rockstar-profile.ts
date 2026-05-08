import axios from "axios";
import * as cheerio from "cheerio";

export type RockstarProfile = {
  username: string;
  avatar?: string;
  crewName?: string;
  crewTag?: string;
  country?: string;
  profileUrl: string;
};

export async function fetchRockstarProfile(username: string): Promise<RockstarProfile | null> {
  try {
    const url = `https://socialclub.rockstargames.com/member/${encodeURIComponent(username)}`;

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const $ = cheerio.load(res.data);

    // OG meta tags (Rockstar بيعتمد عليها كتير)
    const avatar =
      $('meta[property="og:image"]').attr("content") || undefined;

    const title =
      $('meta[property="og:title"]').attr("content") || username;

    const description =
      $('meta[property="og:description"]').attr("content") || "";

    // محاولات بسيطة لاستخراج crew (مش مضمون 100%)
    let crewName: string | undefined;

    $("body").text().includes("Crew") && (crewName = undefined);

    return {
      username: title,
      avatar,
      crewName,
      profileUrl: url,
    };
  } catch (err) {
    console.error("Rockstar fetch error:", err);
    return null;
  }
}
