import helper from "./helper.js";
import config from "./config.js";

let downloadCount = 0;
let url = process.argv[2];
let allData = [];
let canStop = false;

for (let i = 0; i < config.thread; i++) {
	download();
}

let isNextPage = false;
let page = 1;
do {
	console.log(`get ${url} page ${page} ...`);
	let data;
	[data, isNextPage] = await helper.getPage(url, page);
	allData = [...allData, ...data];
	page++;
} while (isNextPage);
canStop = true;

function download() {
	if (allData.length === 0) {
		if (canStop) return;

		setTimeout(download, 3000);
		return;
	}

	let info = allData[allData.length - 1];
	allData.length = allData.length - 1;
	downloadCount++;
	console.log(`download [${downloadCount}/${allData.length}] ${info.id} ${info.title}`);

	helper.downloadItem(info).then(() => {
		download();
	});
}
