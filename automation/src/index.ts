import puppeteer from 'puppeteer';
import fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';
import csvParser from "csv-parser";
import path from "path";

// const URL = 'https://www.mtggoldfish.com/deck/5667309#paper';
const DECKS = [
//  { name: "Riders of Rohan", url: "https://www.mtggoldfish.com/deck/5667309#paper"},
  { name: "Elven Council", url: "https://www.mtggoldfish.com/deck/5667314#paper" }
]

const RETRY = 3

const TRACKABLE = [
  "+1/+1", "+0/+1", "+1/-1", "-0/-1", "-1/+1", "-1/-0", "+1/+0", "-1/-1", "+2/+2", 
  "trample", "haste", "flying", "first strike", "double strike", "deathtouch", "lifelink", 
  "menance", "hex proof", "reach", "vigilance", "indestructable", "poison", "shield", "coin"
] as const;

type TrackableKeys = typeof TRACKABLE[number];
type Trackable = { [K in TrackableKeys]?: number }

function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

async function scrapeDeck(dirPath: string, url: string) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  console.log('Page loaded');

  // Take a screenshot
  // await page.screenshot({ path: 'screenshot.png' });
  // console.log('Screenshot taken');

  await page.evaluate(() => new Promise(res => setTimeout(res, 5000)));

  const cards = await page.evaluate(() => {
    const rows = document.querySelectorAll('.deck-view-deck-table tr:not(.deck-category-header)');
    const data: { name: string; link: string }[] = [];

    console.log("getting rows ...")
    console.log(rows)

    rows.forEach(row => {
      const nameElement = row.querySelector('.card_id.card_name a');
      if (nameElement) {
        const name = nameElement.textContent?.trim() || '';
        const link = nameElement.getAttribute('href') || '';
        if (name && link) {
          data.push({ name, link: `https://www.mtggoldfish.com${link}` });
        }
      }
    });

    return data;
  });

  console.log("getting cards ...")
  console.log(cards)

  await browser.close();

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Directory created: ${dirPath}`);
  } else {
    console.log(`Directory already exists: ${dirPath}`);
  }

  // Write to CSV
  const csvWriter = createObjectCsvWriter({
    path: `${dirPath}/cards.csv`,
    header: [
      { id: 'name', title: 'Card Name' },
      { id: 'link', title: 'Link' },
    ],
  });

  await csvWriter.writeRecords(cards);
  console.log(`✅ Data saved to ${dirPath}/cards.csv`);
  return  `${dirPath}/cards.csv`
}

async function scrapeCards(dirPath: string, location: string): Promise<string> {
  const links: string[] = [];
  const names: string[] = [];

  return new Promise((resolve, reject) => {

    fs.createReadStream(location)
    .pipe(csvParser())
    .on("data", (row: any) => {
      const url = row["Link"];
      const name = row["Card Name"]
      if (url) { links.push(url); names.push(name || ""); }
    })
    .on("end", async () => {
      console.log(`Loaded ${links.length} links from CSV.`);

      // Launch Puppeteer
      let browser = await puppeteer.launch({ headless: false });
      let page = await browser.newPage();

      // Set reasonable timeouts
      page.setDefaultNavigationTimeout(60000);
      page.setDefaultTimeout(30000);

      const results: { url: string; name: string; effect: string; data: Trackable }[] = [];

      let i = 0
      let retry = 0
      while (i < links.length) {
        const name = names[i]
        const url = links[i]
        try {
          console.log(`${(i+1).toString().padStart(2, ' ')} Scraping: ${url}`);
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

          await page.evaluate((delay) => {
            return new Promise(resolve => setTimeout(resolve, delay));
          }, 5000 + retry * 5000);

          const effectText: string = (await page.$eval(".gatherer-oracle", (el) => (el as any).innerText.trim()) as string).split('\n').join(' ').replace(/\t/g, ' ').replace(/\s+/g, ' ')
          console.log(`   Extracted effect: ${effectText}`);

          let data: Trackable = {}
          for (let counter of TRACKABLE) {
            if (effectText.toLowerCase().includes(counter)) { data[counter] = 1 }
          }

          results.push({name, effect: effectText, url, data});
          i=i+1
        } catch (error) {
          console.error(`Failed to scrape "${name}" ${url}:`, error);
          console.error(`Retry: ${retry+1} for "${name}"`)

          if (`${error}`.includes("ProtocolError") || `${error}`.includes("TimeoutError")) {
            console.error("This is a likely a browser error, restarting browser ...")
            if (browser) { 
              await browser.close().catch(e => console.error('Error closing browser:', e));
              browser = await puppeteer.launch({ headless: false }); 
              page = await browser.newPage();
            }
            retry = retry + 1;
            continue;
          }

          // Ensure directory exists
          const failedPagesDir = 'failed-pages';
          if (!fs.existsSync(failedPagesDir)) {
            fs.mkdirSync(failedPagesDir, { recursive: true });
          }

          // Then write your file
          const safeFilename = name.replace(/[\/\\?%*:|"<>]/g, '-'); // Sanitize filename
          const filePath = path.join(failedPagesDir, `failed-${safeFilename}.html`);

          // Save failed page HTML
          const htmlContent = await page.content();
          fs.writeFileSync(filePath, htmlContent);
          console.log(`Saved failed page HTML: ${filePath}`);

          // Take a screenshot
          const screenshotPath = path.join("failed-pages", `failed-${name}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`Saved screenshot: ${screenshotPath}`);
          

          try {
            const isThrottled = await page.evaluate(() => {
              const pre = document.querySelector('pre');
              return pre && pre.textContent!.includes('Throttled');
            })

            if ( retry < RETRY && isThrottled ) { retry = retry+1 }
            else if (isThrottled)  { retry=0; i=i+1; results.push({ url, name, effect: "THROTTLED ERROR x3", data: {} }); }
          } catch {
            results.push({ url, name, effect: "ERROR", data: {} });
            i=i+1;
          }

          if (browser) { 
            browser.close(); 
            browser = await puppeteer.launch({ headless: false }); 
            page = await browser.newPage();
          }
        }
      }

      await browser.close();

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Directory created: ${dirPath}`);
      } else {
        console.log(`Directory already exists: ${dirPath}`);
      }

      // Save results to a new CSV
      const outputCSV = `${dirPath}/card_effects.csv`;
      const csvContent = "name,effect,url," + 
        TRACKABLE.map((r) => `"${r}"`)+"\n" +
        results.map((r) => {
          let s = `"${r.name}","${r.effect}","${r.url}"`
          for (let c of TRACKABLE) {
            if (r.data[c]) { s=s+`,${r.data[c]}` } else { s=s+`,0` }
          }
          return s
        }).join("\n");
      fs.writeFileSync(outputCSV, csvContent);
      console.log(`Results saved to ${outputCSV}`);
      resolve( outputCSV )
    });
  })
}

async function calculateTokenDistribution(location: string, tokens: number) {
  const csv: { url: string; name: string; effect: string; data: Trackable }[] = [];
  const result: Trackable = {}

  fs.createReadStream(location)
    .pipe(csvParser())
    .on("data", (row: any) => {
      const data: Trackable = pick(row, TRACKABLE)
      csv.push({
        url: row["url"],
        name: row["name"],
        effect: row["effect"],
        data
      })
    })
    .on("end", async () => {
      console.log(`loaded "${location}".`);
      let total = 0
      let longest = 0

      // console.log(csv)
      for (let c of csv) {
        for (let key of TRACKABLE) {
          const value = Number(c.data[key]||0)
          if (!result[key as TrackableKeys]) result[key as TrackableKeys] = value
          else { 
            if (value) {
              result[key as TrackableKeys] = result[key as TrackableKeys]! + value
            }
          }
        }
      }
      

      for (const [key, value] of Object.entries(result)) {
        if (longest < key.length) longest = key.length
        total = total + Number(value)
      }

      console.log(`total: ${total}, longest: ${longest}`)
      console.log(result)

      const output: Trackable = {}
      let newEstTotal = 0
      console.log(`\n**${"*".repeat(longest)}**********`)
      // fs.appendFile(`\n**${"*".repeat(longest)}**********`)

      for (const [key, value] of Object.entries(result)) {
        output[key as TrackableKeys] = Math.round((value / total) * tokens)
        
        if (output[key as TrackableKeys]) { 
          newEstTotal = newEstTotal + output[key as TrackableKeys]!
          console.log(`* ${" ".repeat(longest-key.length)}${key}  =  ${output[key as TrackableKeys]}   *`)
        }
      }
      console.log(`**${"*".repeat(longest)}**********`)
      console.log(`**  Total: ${newEstTotal}`)
    });
}

async function main() {
  for (let cd of DECKS) {
    console.log(`⌛ "${cd.name}" ... `)
    // let location = await scrapeDeck(cd.name, cd.url).catch(console.error)
    // if (location) location = await scrapeCards(cd.name, location).catch(console.error)

    let location = `${cd.name}/card_effects.csv`

    if (location) {   
      console.log(`✅ "${cd.name}" completed!`)
      calculateTokenDistribution(location, 21)
    }
  }
}

main()
