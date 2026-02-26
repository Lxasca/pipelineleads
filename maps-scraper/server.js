import express from "express";
import puppeteer from "puppeteer";

const app = express();
app.use(express.json());

app.post("/scrape-maps", async (req, res) => {
  const { cities, niche } = req.body;

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50
  });

  const page = await browser.newPage();
  const results = [];

  for (const city of cities.slice(0, 2)) {
    const query = `${niche} à ${city}`;

    await page.goto(
      `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
      { waitUntil: "networkidle2" }
    );

    await page.waitForSelector('[role="feed"]');
    await page.waitForTimeout(2000);

    const data = await page.evaluate(() => {
      return [...document.querySelectorAll('[role="article"]')]
        .slice(0, 5)
        .map(el => ({
          name: el.querySelector('.fontHeadlineSmall')?.innerText || null
        }));
    });

    results.push({ city, results: data });
  }

  await browser.close();

  res.json({
    success: true,
    data: results
  });
});

app.listen(3001, () => {
  console.log("Scraper Maps lancé sur port 3001");
});