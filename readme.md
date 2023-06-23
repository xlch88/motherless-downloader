# motherless-downloader
Automatically and batch download pictures and videos from motherless.com

# HOW TO USE ?
You need to install on your computer:
 - nodejs
 - aria2c in `%PATH%`

and run :
```
npm i
```

create and edit `config.js` :
```javascript
export default {
	# Proxy setting, Set to false if you don't need
	proxy: {
		protocol: "http",
		host: "127.0.0.1",
		port: 1080,
	},

	# aria2c proxy setting
	aria2proxy: "http://127.0.0.1:1080",

	# Where to save the downloaded files
	savePath: "Z:/h_assets/assets/video/Motherless", 

	# Number of parallel downloads
	thread: 10,
};
```

use command:
```
node download.js "https://motherless.com/u/xxxxxxxxxxx"
node download.js "https://motherless.com/f/xxxxxxxxxxx/videos"
```
This will automatically download all videos/pictures on this page.

And if there are multiple pages, it will also automatically turn the pages.
