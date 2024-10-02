# Video Web Scraper
This is a simple web scraper that scrapes videos from a website and saves them to a file. The websites used in this example are [www.pexels.com](https://www.pexels.com/videos/) and [www.coverr.co](https://coverr.co/). The videos are saved to a file in the current directory.

## Installation
To install the required node modules, run the following command:
```bash
npm install
```
To begin scraping videos, please first apply API keys from [www.pexels.com](https://www.pexels.com/api/) and [www.coverr.co](https://coverr.co/api). Once you have the API keys, create a `.env` file in the root directory and add the following:
```bash
PEXELS_API_KEY=your_pexels_api_key
COVERR_API_KEY=your_coverr_api_key
```
To start scraping videos, run the following command:
```bash
node server.js
```
Then go to [http://localhost:7655](http://localhost:7655) in your browser to start scraping videos.

## File Structure
The downloaded videos are saved to the `data` directory. The `data` directory is created if it does not exist.
All the videos under search keywords "xxx" are saved to the `data/xxx` directory.
