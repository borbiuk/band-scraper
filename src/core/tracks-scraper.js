const {getAllAccounts, insertAlbum, insertAlbumToAccount, insertTrack, insertTrackToAccount} = require("../data/db");
const puppeteer = require("puppeteer");
const utils = require("../common/utils");
const {log} = require("../common/log");
const {isAlbum, isTrack, originalUrl, chunkArray, createChunks, delay} = require("../common/utils");
const db = require("../data/db");
const {scrollPageToBottom} = require('puppeteer-autoscroll-down')

const loadAllTracks = async (page) => {
	// Click the '.show-more' button until it no longer exists
	let showMoreButton = await page.$('.show-more');
	let retry = 0;
	while (retry < 3) {
		await utils.delay(250);

		showMoreButton = await page.$('.show-more');
		if (!showMoreButton) {
			retry++;
			log(`"Load more..." button not exists [${retry}]: ${page.url()}`);
			continue;
		}

		try {
			await showMoreButton.click();
			log(`"Load more..." button clicked [${retry}]: ${page.url()}`);
			break;
		} catch (e) {
			log(`"Load more..." button error [${retry}]: ${page.url()}`);
			retry++;
			log(e);
		}
	}

	await utils.delay(150);

	let isLoadingAvailable = true // Your condition-to-stop

	let container = await page.$('.fan-container');
	let height = (await container.boundingBox()).height;
	let r = 0;

	while (isLoadingAvailable && r < 3) {
		try {
			await scrollPageToBottom(page, {size: 5_000});
			log(`Scrolled [${retry}]: ${page.url()}`);

			await page.waitForResponse(
				response => response.url().includes('collection_items') && response.status() === 200,
				{
					timeout: 500
				}
			)

			let currentHeight = (await container.boundingBox()).height;
			isLoadingAvailable = currentHeight !== height; // Update your condition-to-stop value
			height = currentHeight;
			if (!isLoadingAvailable) {
				log(`Scrolled to end [${retry}]: ${page.url()}`);
			}
		} catch (e) {
			r++;
			log(e);
			log(`Scroll error [${retry}]: ${page.url()}`);
		}
	}
};

const openPage = async (url) => {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.goto(url);
	return {page, browser};
};

const readHrefs = async (page, selector) => {
	const hrefs = await page.$$eval(selector, (elements) =>
		elements.map((element) => element.href)
	);

	const elements = await page.$$eval(selector, (elements) =>
		elements
	);
	return hrefs;
};

const tracksScraper = async () => {
	console.time('tracksScraper');

	const allAccounts = await getAllAccounts();
	let chunks = createChunks(
		allAccounts
			.filter(({Id, Url}) => Id !== null && Id !== undefined && Url !== null && Url !== undefined),
		60
	);

	chunks = chunks.filter((x, i) => i > chunks.length / 2);

	const scrapePromises = chunks.map(async (accounts, chunkIndex) => {
		console.time(`tracksScraper-[${chunkIndex}]`);

		const browser = await puppeteer.launch({
			// headless: false
		});

		for (let i = 0; i < accounts.length; i++) {
			const page = await browser.newPage();
			// await page.setViewport({
			// 	width: 1200,
			// 	height: 800
			// });

			const {Id, Url} = accounts[i];

			await page.goto(Url);

			let r = 0;
			while (r < 3) {
				try {
					await loadAllTracks(page);
					break;
				} catch (e) {
					r++;
					log(e);
				}
			}

			await utils.delay(150);
			let hrefs = await readHrefs(page, '.item-link');
			hrefs = hrefs.filter(x => x !== null && x !== undefined && x !== '');

			log(`Tracks founded [${chunkIndex}, ${i}]: ${hrefs.length}`);
			for (const href of hrefs) {
				const url = originalUrl(href);
				if (isAlbum(url)) {
					insertAlbum(url);
					await delay(500);
					const albumId = await db.getAlbumId(url);
					await insertAlbumToAccount(albumId, Id);
					await delay(500);
					
				} else if (isTrack(url)) {
					insertTrack(url);
					await delay(500);
					
					const trackId = await db.getTrackId(url);
					await insertTrackToAccount(trackId, Id);
					await delay(500);
					
				}
			}

			await page.close();
		}

		await browser.close();

		console.timeEnd(`tracksScraper-[${chunkIndex}]`);
	});

	await Promise.all(scrapePromises);

	console.timeEnd('tracksScraper');
}

module.exports = {
	tracksScraper,
}
