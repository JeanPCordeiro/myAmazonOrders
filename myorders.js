import puppeteer from 'puppeteer';

const AMAZON_EMAIL = 'ton.email@example.com';
const AMAZON_PASSWORD = 'tonMotDePasse';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium-browser'
})

async function loginAmazon(page) {
  await page.goto('https://www.amazon.fr/ap/signin', { waitUntil: 'networkidle2' });
  await page.type('#ap_email', AMAZON_EMAIL);
  await page.click('#continue');

  await page.waitForSelector('#ap_password', { visible: true });
  await page.type('#ap_password', AMAZON_PASSWORD);
  await page.click('#signInSubmit');

  // Gestion MFA
  try {
    await page.waitForSelector('input[name="otpCode"]', { timeout: 5000 });
    console.log("Amazon demande un code MFA. Vérifie ton appareil et entre le code.");
    await page.waitForTimeout(20000); // 20s pour saisir le code manuellement
  } catch (e) {
    console.log("Pas de MFA détecté ou déjà validé.");
  }

  await page.waitForNavigation({ waitUntil: 'networkidle2' });
}

async function getAllOrders(page) {
  let commandesEnCours = [];
  let hasNextPage = true;

  while (hasNextPage) {
    await page.waitForSelector('.order', { timeout: 10000 });

    const commandes = await page.evaluate(() => {
      const orders = document.querySelectorAll('.order');
      return Array.from(orders)
        .map(order => {
          const title = order.querySelector('.a-link-normal span')?.innerText?.trim();
          const status = order.querySelector('.a-column.a-span3 span')?.innerText?.trim();
          return { title, status };
        })
        .filter(order => order.status && !order.status.toLowerCase().includes('livré'));
    });

    commandesEnCours = commandesEnCours.concat(commandes);

    // Vérifier s'il y a une page suivante
    const nextButton = await page.$('ul.a-pagination li.a-last a');
    if (nextButton) {
      await Promise.all([
        page.click('ul.a-pagination li.a-last a'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
    } else {
      hasNextPage = false;
    }
  }

  return commandesEnCours;
}

async function main() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await loginAmazon(page);
    await page.goto('https://www.amazon.fr/gp/your-account/order-history', { waitUntil: 'networkidle2' });

    const commandesEnCours = await getAllOrders(page);

    console.log("Toutes les commandes en cours :");
    console.table(commandesEnCours);

  } catch (err) {
    console.error("Erreur :", err);
  } finally {
    //browser.close();
  }
}

main();
