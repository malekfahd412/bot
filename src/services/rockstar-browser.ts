import { chromium } from "playwright";

export interface RockstarProfile {
  displayName: string;
  rid?: string;
  avatar?: string;
  crewName?: string;
  crewTag?: string;
  country?: string;
  profileUrl: string;
}

export async function fetchRockstarProfile(displayName: string): Promise<RockstarProfile | null> {
  const url = `https://socialclub.rockstargames.com/member/${encodeURIComponent(displayName)}`;

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // لو الصفحة فاضية أو مش موجودة
    const notFound = await page.locator("text=not found").count();
    if (notFound > 0) {
      await browser.close();
      return null;
    }

    // 👤 البيانات الأساسية
    const title = await page.title();

    const avatar =
      (await page.locator("img").first().getAttribute("src").catch(() => null)) ||
      undefined;

    const crewName =
      (await page.locator(".crew-name").textContent().catch(() => null)) ||
      undefined;

    const crewTag =
      (await page.locator(".crew-tag").textContent().catch(() => null)) ||
      undefined;

    const profile: RockstarProfile = {
      displayName,
      rid: title || undefined,
      avatar: avatar || undefined,
      crewName: crewName?.trim(),
      crewTag: crewTag?.trim(),
      profileUrl: url,
    };

    await browser.close();
    return profile;
  } catch (err) {
    await browser.close();
    console.error("Playwright error:", err);
    return null;
  }
}
