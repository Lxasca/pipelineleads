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
    const browser = await puppeteer.launch({ headless: false, slowMo: 50, defaultViewport: null });
    const page = await browser.newPage();
    const allCitiesResults = [];

    for (const cityName of cities) {
      const query = `${niche} à ${cityName}`;
      console.log("Recherche :", query);

      await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, { waitUntil: "networkidle2" }).catch(err => console.error("Erreur goto:", err));
      await page.waitForSelector('[role="feed"]').catch(err => console.error("Selector feed non trouvé:", err));
      await new Promise(r => setTimeout(r, 3000));

      const resultElements = await page.$$('[role="article"]').catch(err => { console.error("Erreur $$:", err); return []; });
      const cityResults = [];

      for (let i = 0; i < Math.min(20, resultElements.length); i++) {
        try {
          const resultElement = resultElements[i];
          await resultElement.click().catch(err => console.error("Erreur click:", err));

          await page.waitForSelector('h1.DUwDvf.lfPIob, .fontHeadlineLarge', { timeout: 8000 });
          await new Promise(r => setTimeout(r, 1500));

          page.on('console', msg => console.log('PAGE LOG:', msg.text()));

          const companyData = await page.evaluate(() => {
            const nameEl = document.querySelector('h1.DUwDvf.lfPIob') || document.querySelector('.fontHeadlineLarge');
            const name = nameEl ? nameEl.innerText.trim() : "Nom non trouvé";

            const ratingEl = document.querySelector('.F7nice span span[aria-hidden="true"]');
            const rating = ratingEl ? ratingEl.innerText.trim() : null;

            const websiteEl = [...document.querySelectorAll('a')].find(a => a.textContent.includes("Site Web"));
            const website = websiteEl ? websiteEl.href : null;

            const addressEl = document.querySelector('.Io6YTe.fontBodyMedium.kR99db.fdkmkc');
            let city = null;
            let postalPrefix = null;
            if(addressEl){
              const addrText = addressEl.innerText.trim();
              const match = addrText.match(/(\d{5})\s+([A-Za-zÀ-ÖØ-öø-ÿ\- ]+)/);
              if(match){
                postalPrefix = match[1].slice(0,2);
                city = match[2].trim();
              } else {
                const parts = addrText.split(',');
                if(parts.length>=2){
                  city = parts[parts.length-2].trim();
                  postalPrefix = parts[parts.length-2].trim().slice(0,2);
                }
              }
            }

            const reviewsEl = document.querySelector('.jANrlb span[aria-label*="avis"]') 
            || document.querySelector('.F7nice span[aria-label*="avis"]');
            const reviews = reviewsEl ? parseInt(reviewsEl.getAttribute('aria-label').match(/(\d+)\s*avis/i)?.[1]) : null;

            const phoneEl = [...document.querySelectorAll('div.Io6YTe')].find(el => el.innerText.match(/^(\+33|0)[0-9\s\.]{8,}/));
            const phone = phoneEl ? phoneEl.innerText.replace(/\s/g,'') : null;

            return { name, rating, website, reviews, city, postalPrefix, phone };
          });

          cityResults.push(companyData);
        } catch (err) {
          console.error("Erreur sur un résultat :", err);
        }
      }

      allCitiesResults.push({ city: cityName, results: cityResults });
    }

    await browser.close();
    res.json({ success: true, data: allCitiesResults });

  } catch (err) {
    console.error("Erreur générale scraping :", err);
    res.status(500).json({ success: false, message: "Erreur serveur", error: err.toString() });
  }
});

app.listen(3001, () => console.log("Scraper Maps lancé sur port 3001"));