import express from "express";
import puppeteer from "puppeteer";
import cors from "cors";

const app = express();
app.use(cors({
  origin: ["http://127.0.0.1:8000", "http://localhost:8000"],
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));
app.use(express.json());

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.post("/scrape-maps", async (req, res) => {
  console.log("POST /scrape-maps reçu");
  console.log("Body :", req.body);

  const { cities, niche } = req.body;

  if (!cities || !niche) {
    console.error("Validation failed : cities ou niche manquant");
    return res.status(400).json({ success: false, message: "cities et niche requis" });
  }

  try {
    const browser = await puppeteer.launch({ headless: true, defaultViewport: null });
    const page = await browser.newPage();
    const allCitiesResults = [];

    for (const cityName of cities) {
      const query = `${niche} à ${cityName}`;
      console.log("Recherche :", query);

      await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, { waitUntil: "networkidle2" }).catch(err => console.error("Erreur goto:", err));
      await page.waitForSelector('[role="feed"]').catch(err => console.error("Selector feed non trouvé:", err));
      await new Promise(r => setTimeout(r, 3000));

      /**const feed = await page.$('[role="feed"]');
      let previousCount = 0;
      let sameCountRetries = 0;

      while (true) {
        await page.evaluate(el => el.scrollTop += 3000, feed);

        await new Promise(r => setTimeout(r, 3000));
        
        const currentCount = await page.$$eval('[role="article"]', els => els.length);
        console.log(`Articles chargés : ${currentCount}`);
        
        const endReached = await page.evaluate(() => {
          const feed = document.querySelector('[role="feed"]');
          return feed ? feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 10 : false;
        });

        if (currentCount === previousCount) {
          sameCountRetries++;
          if (sameCountRetries >= 10) break; // 5 tentatives sans nouveau résultat = vraiment fini
        } else {
          sameCountRetries = 0;
        }

        if (endReached && currentCount === previousCount) break;
        
        previousCount = currentCount;
      }

      console.log(`Total articles trouvés : ${previousCount}`);**/
      
      const resultElements = await page.$$('[role="article"]').catch(err => { console.error("Erreur $$:", err); return []; });
      const cityResults = [];

      for (let i = 0; i < Math.min(2, resultElements.length); i++) { // Math.min(20, resultElements.length) //resultElements.length
        try {
          const resultElement = resultElements[i];
          console.log(`[${cityName}] ${i + 1}/${resultElements.length} — scraping...`);
          await resultElement.click().catch(err => console.error("Erreur click:", err));

          await page.waitForSelector('h1.DUwDvf.lfPIob, .fontHeadlineLarge', { timeout: 2000 });
          //await page.waitForSelector('span[role="img"][aria-label*="reviews"]', { timeout: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 2000));

          const companyData = await page.evaluate(() => {
            const nameEl = document.querySelector('h1.DUwDvf.lfPIob') || document.querySelector('.fontHeadlineLarge');
            const name = nameEl ? nameEl.innerText.trim() : "Nom non trouvé";

            const ratingEl = document.querySelector('.F7nice span span[aria-hidden="true"]');
            const rating = ratingEl ? ratingEl.innerText.trim() : null;

            const websiteEl = document.querySelector('a.CsEnBe[aria-label*="Website"]') 
            || document.querySelector('a.CsEnBe[aria-label*="Site"]');
            const website = websiteEl ? websiteEl.getAttribute('aria-label').replace(/^(Website|Site Web)\s*:\s*/i, '').trim() : null;

            return { name, rating, website };
          });

          cityResults.push(companyData);
          console.log(`[${cityName}] ✅ ${i + 1}/${resultElements.length} — ${companyData.name}`);
        } catch (err) {
          console.error("Erreur sur un résultat :", err);
        }
      }

      allCitiesResults.push({ city: cityName, results: cityResults });
    }

    await browser.close();
    res.json({ success: true, data: allCitiesResults });

  } catch (err) {
    console.log(`[${cityName}] ❌ ${i + 1}/${resultElements.length} — erreur : ${err.message}`);
    res.status(500).json({ success: false, message: "Erreur serveur", error: err.toString() });
  }
});

app.listen(3001, () => console.log("Scraper Maps lancé sur port 3001"));