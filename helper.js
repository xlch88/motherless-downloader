import fs from "fs";
import child_process from "child_process";

import config from "./config.js";

import axios from "axios";
import { JSDOM } from "jsdom";
import jquery from "jquery";
import { utimes } from "utimes";
import path from "path";

let downloadedIds = false;

export default {
	isDownloaded(id) {
		if (!downloadedIds) {
			downloadedIds = this.scanDir(config.savePath)
				.map((v) => {
					let match;
					if ((match = /^(.*?) - ([a-f0-9]+).(mp4|jpg)$/i.exec(v))) {
						return match[2];
					}

					return false;
				})
				.filter(Boolean);
		}

		return downloadedIds.includes(id);
	},
	scanDir(dir) {
		let files;
		let rt = [];

		files = fs.readdirSync(dir);

		for (let item of files) {
			let file = path.resolve(dir, item);
			if (fs.statSync(file).isDirectory()) {
				rt.push(...this.scanDir(file));
			} else {
				rt.push(file);
			}
		}

		return rt;
	},
	async getPage(url, page = 1) {
		let data = await this.get(`${url}${url.indexOf("?") !== -1 ? "&" : "?"}page=${page}`);
		let jsdom = new JSDOM(data);
		let $ = jquery(jsdom.window);

		let rt = [];
		$("#content .content-wrapper .content-inner .thumb-container").each((i, dom) => {
			let id = $("a", dom).attr("href").replace("https://motherless.com/", "");
			let type =
				$(dom).attr("class").indexOf("video") !== -1
					? "video"
					: $(dom).attr("class").indexOf("image") !== -1
					? "image"
					: "other";
			let title = $(".captions a", dom).html().trim();
			let author = $(".uploader", dom).html().trim();

			rt.push({ id, type, title, author });
		});

		return [rt, $(".pagination_link .fa-angle-right").length > 0];
	},
	async get(url) {
		let res;

		try {
			res = await axios.get(url, {
				proxy: config.proxy,
			});
			return res.data;
		} catch (e) {
			console.error("axios", e.stack);
			return "";
		}
	},
	async downloadItem(info) {
		if (this.isDownloaded(info.id)) return true;

		let _data = await this.get(`https://motherless.com/${info.id}`);
		let _match;
		if (!(_match = /__fileurl = '(.*?)';/.exec(_data))) {
			return false;
		}
		let _jsdom = new JSDOM(_data);
		let _$ = jquery(_jsdom.window);

		let _time = _$(_$(".media-meta-stats .count").get(2)).html();
		let _match_t;
		let time;
		if ((_match_t = /([0-9]+)d ago/.exec(_time))) {
			time = new Date(new Date().getTime() - 1000 * 86400 * _match_t[1]);
		} else if ((_match_t = /([0-9]+)h ago/.exec(_time))) {
			time = new Date(new Date().getTime() - 1000 * 3600 * _match_t[1]);
		} else if ((_match_t = /([0-9]+)m ago/.exec(_time))) {
			time = new Date(new Date().getTime() - 1000 * 60 * _match_t[1]);
		} else if (!isNaN(new Date(_time))) {
			time = new Date(_time);
		} else {
			time = new Date();
		}

		let downloadPath = `${config.savePath}/${info.author}/${info.type}/${this.formatTime(time, "yyyy-MM")}/`;
		let downloadFile = `${info.title} - ${info.id}.${info.type === "video" ? "mp4" : "jpg"}`.replace(
			/([\\\/:*?"<>|]+)/g,
			"_"
		);
		let tmpFile = `./tmp/${downloadFile}.tmp`;
		let url = _match[1];

		if (fs.existsSync(`${downloadPath}/${downloadFile}`)) {
			await utimes(`${downloadPath}/${downloadFile}`, time.getTime());
			return true;
		}
		// let url =
		// 	info.type === "video"
		// 		? `https://cdn5-videos.motherlessmedia.com/videos/${info.id}-720p.mp4`
		// 		: `https://cdn5-images.motherlessmedia.com/images/${info.id}.jpg`;

		if (!fs.existsSync(downloadPath)) {
			fs.mkdirSync(downloadPath, { recursive: true });
		}
		if (!fs.existsSync("./tmp/")) {
			fs.mkdirSync("./tmp/", { recursive: true });
		}

		if (fs.existsSync(tmpFile)) {
			fs.unlinkSync(tmpFile);
		}

		try {
			await this.downloadFileAria2(url, tmpFile);
		} catch (e) {
			console.error(e.stack);
			return false;
		}

		fs.renameSync(tmpFile, `${downloadPath}/${downloadFile}`);
		await utimes(`${downloadPath}/${downloadFile}`, time.getTime());
		return true;
	},
	async downloadFileAria2(fileUrl, outputLocationPath) {
		return new Promise(function (resolve, reject) {
			let exec = child_process.exec(
				`aria2c -c -x 10 -s 10 --all-proxy=${config.aria2proxy} -o "${outputLocationPath}" "${fileUrl}"`,
				{},
				function (err, stdout, stderr) {
					if (err) {
						reject(err);
					}

					resolve(stdout, stderr);
				}
			);
			exec.stdout.pipe(process.stdout, { end: false });
			exec.stderr.pipe(process.stderr, { end: false });
			exec.stdin.pipe(process.stdin, { end: false });
		});
	},
	async downloadFile(fileUrl, outputLocationPath) {
		const writer = fs.createWriteStream(outputLocationPath);

		return axios({
			method: "get",
			url: fileUrl,
			responseType: "stream",
			proxy: config.proxy,
		}).then((response) => {
			return new Promise((resolve, reject) => {
				response.data.pipe(writer);
				let error = null;
				writer.on("error", (err) => {
					console.log("download error:", err.stack);
					error = err;
					writer.close();
					reject(err);
				});
				writer.on("close", () => {
					if (!error) {
						resolve(true);
					}
				});
			});
		});
	},
	formatTime(time_, fmt = "yyyy-MM-dd hh:mm:ss") {
		let time = new Date(time_);
		let o = {
			"M+": time.getMonth() + 1, //月份
			"d+": time.getDate(), //日
			"h+": time.getHours(), //小时
			"m+": time.getMinutes(), //分
			"s+": time.getSeconds(), //秒
			"q+": Math.floor((time.getMonth() + 3) / 3), //季度
			S: time.getMilliseconds(), //毫秒
		};
		if (/(y+)/.test(fmt)) {
			fmt = fmt.replace(RegExp.$1, (time.getFullYear() + "").substr(4 - RegExp.$1.length));
		}
		for (const k in o) {
			if (new RegExp("(" + k + ")").test(fmt)) {
				fmt = fmt.replace(RegExp.$1, RegExp.$1.length === 1 ? o[k] : ("00" + o[k]).substr(("" + o[k]).length));
			}
		}
		return fmt;
	},
};
