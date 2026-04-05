import express from "express";
import puppeteer from "puppeteer";
import cors from "cors";

const app = express();
app.use(cors({
  origin: ["http://127.0.0.1:8000", "http://localhost:8000"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));
app.use(express.json());

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.get("/scrape-maps", async (req, res) => {
  const { cities, niche } = req.query;

  if (!cities || !niche) {
    return res.status(400).json({ success: false, message: "cities et niche requis" });
  }

  const citiesList = JSON.parse(cities);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const browser = await puppeteer.launch({ headless: true, defaultViewport: null });
    const page = await browser.newPage();
    const allCitiesResults = [];

    for (const cityName of citiesList) {
      try {
        send('city', { city: cityName });
        console.log("Recherche :", `${niche} à ${cityName}`);

        await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(`${niche} à ${cityName}`)}`, { waitUntil: "networkidle2" }).catch(err => console.error("Erreur goto:", err));

        const feedFound = await page.waitForSelector('[role="feed"]', { timeout: 15000 }).catch(() => null);

        if (!feedFound) {
          console.log(`[${cityName}] ⚠️ Feed non trouvé — ville ignorée`);
          allCitiesResults.push({ city: cityName, results: [] });
          continue;
        }

        await new Promise(r => setTimeout(r, 5000));

        const feed = await page.$('[role="feed"]');
        let previousCount = 0;
        let sameCountRetries = 0;

        while (true) {
          if (!feed) break;
          await page.evaluate(el => el.scrollTop += 3000, feed).catch(() => {});
          await new Promise(r => setTimeout(r, 3000));
          const currentCount = await page.$$eval('[role="article"]', els => els.length).catch(() => 0);
          const endReached = await page.evaluate(() => {
            const feed = document.querySelector('[role="feed"]');
            return feed ? feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 10 : true;
          }).catch(() => true);

          if (currentCount === previousCount) {
            sameCountRetries++;
            if (sameCountRetries >= 10) break;
          } else {
            sameCountRetries = 0;
          }
          if (endReached && currentCount === previousCount) break;
          previousCount = currentCount;
        }

        const resultElements = await page.$$('[role="article"]').catch(() => []);
        const cityResults = [];

        for (let i = 0; i < resultElements.length; i++) {
          try {
            const resultElement = resultElements[i];
            await resultElement.click().catch(() => {});
            await page.waitForSelector('h1.DUwDvf.lfPIob, .fontHeadlineLarge', { timeout: 2000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 2000));

            const companyData = await page.evaluate(() => {
              const nameEl = document.querySelector('h1.DUwDvf.lfPIob') || document.querySelector('.fontHeadlineLarge');
              const name = nameEl ? nameEl.innerText.trim() : "Nom non trouvé";
              const ratingEl = document.querySelector('.F7nice span span[aria-hidden="true"]');
              const rating = ratingEl ? ratingEl.innerText.trim() : null;
              const websiteEl = document.querySelector('a.CsEnBe[aria-label*="Website"]')
                || document.querySelector('a.CsEnBe[aria-label*="Site"]');
              const website = websiteEl ? websiteEl.getAttribute('aria-label').replace(/^(Website|Site Web)\s*:\s*/i, '').trim() : null;
              return { name, rating, website, emails: null };
            });

            if (companyData.website) {
              companyData.website = nettoyerUrl(companyData.website);
            }

            if (companyData.rating && parseFloat(companyData.rating) < 3.5) continue;
            if (!companyData.rating) continue;
            

            send('company', { company: companyData.name, index: i + 1, total: resultElements.length });

            const reseauxSociaux = ['facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'youtube', 'pinterest'];
            if (companyData.website && reseauxSociaux.some(r => companyData.website.toLowerCase().includes(r))) {
              companyData.website = null;
            }

            const isDuplicate = 
              cityResults.some(r => r.name === companyData.name || (r.website && companyData.website && r.website === companyData.website)) ||
              allCitiesResults.some(cityObj => cityObj.results.some(r => r.name === companyData.name || (r.website && companyData.website && r.website === companyData.website)));

            if (!isDuplicate && companyData.website) {
              cityResults.push(companyData);

              if (companyData.website) {
                const emails = await findEmailsOnWebsite(page, companyData.website);
                companyData.emails = emails;
              }

              cityResults.sort((a, b) => {
                if (a.website && !b.website) return -1;
                if (!a.website && b.website) return 1;
                return 0;
              });
            }

          } catch (err) {
            console.error(`[${cityName}] Erreur résultat ${i + 1} :`, err.message);
            continue;
          }
        }

        allCitiesResults.push({ city: cityName, results: cityResults });

      } catch (err) {
        console.error(`[${cityName}] ❌ Erreur ville :`, err.message);
        allCitiesResults.push({ city: cityName, results: [] });
        continue;
      }
    }

    await browser.close();
    send('done', { data: allCitiesResults });
    res.end();

  } catch (err) {
    send('error', { message: err.toString() });
    res.end();
  }
});

app.listen(3001, () => console.log("Scraper Maps lancé sur port 3001"));

async function findEmailsOnWebsite(page, url) {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const pagesToCheck = [
    url, url + '/contact', url + '/nous-contacter',
    url + '/contact.html', url + '/mentions-legales',
    url + '/mentions-légales', url + '/a-propos',
  ];
  const allEmails = new Set();
  for (const pageUrl of pagesToCheck) {
    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 8000 });
      const content = await page.evaluate(() => document.body.innerText + ' ' + document.body.innerHTML);
      const matches = content.match(emailRegex) || [];
      matches.filter(isMailValide).forEach(e => allEmails.add(e.toLowerCase()));
      if (allEmails.size > 0) break;
    } catch(e) {
      continue;
    }
  }
  return allEmails.size > 0 ? [...allEmails].join(', ') : null;
}

function isMailValide(email) {
  if (!email || typeof email !== 'string') return false;
  try { email = decodeURIComponent(email).replace(/\s+/g, ''); } catch(e) {}
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,6}$/i.test(email)) return false;
  if (/\.(png|jpg|jpeg|gif|webp|svg|pdf|doc|docx|zip|css|js|php)$/i.test(email)) return false;
  const blacklistedDomains = [
    'exemple.fr', 'exemple.com', 'example.com', 'example.fr',
    'domaine.com', 'domaine.fr', 'votre-domaine.fr', 'webador.fr',
    'solocal.com', 'pagesjaunes.fr', 'wixpress.com', 'sentry.io',
    'sentry-next.wixpress.com', 'local.fr', 'monsite.fr', 'votresite.fr',
  ];
  const domain = email.split('@')[1].toLowerCase();
  if (blacklistedDomains.includes(domain)) return false;
  const prefixesInvalides = [
    /^vous@/i, /^utilisateur@/i, /^user@/i, /^test@/i,
    /^noreply@/i, /^no-reply@/i, /^donotreply@/i,
    /^postmaster@/i, /^mailer-daemon@/i, /^admin@/i,
    /^webmaster@/i, /^support@webador/i,
  ];
  if (prefixesInvalides.some(p => p.test(email))) return false;
  if (/%[0-9a-f]{2}/i.test(email)) return false;
  if (/\s/.test(email)) return false;
  return true;
}

function nettoyerUrl(url) {
  if (!url) return url;
  url = url.replace(/\/contact.*/i, '');
  url = url.replace(/\/nous-contacter.*/i, '');
  url = url.replace(/\/?\?.*/i, '');
  url = url.replace(/\/$/, '');
  return url;
}