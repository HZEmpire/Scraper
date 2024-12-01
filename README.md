# Image/Video Web Scraper
This is a simple web scraper that scrapes images or videos from a website and saves them to a file. The websites used in this example are [www.pexels.com](https://www.pexels.com/videos/), [www.coverr.co](https://coverr.co/), and [commons.wikimedia.org](https://commons.wikimedia.org/wiki/Main_Page). The images/videos are saved to a file in the current [data](data) directory.

The User Interface is given as follows:
![User Interface](demo.png)

## Installation
To install the required node modules, run the following command:
```bash
npm install
```
To begin scraping images/videos, please first apply API keys from [www.pexels.com](https://www.pexels.com/api/) and [www.coverr.co](https://coverr.co/api). Once you have the API keys, create a `.env` file in the root directory and add the following:
```bash
PEXELS_API_KEY=your_pexels_api_key
COVERR_API_KEY=your_coverr_api_key
```
To start scraping images/videos, run the following command:
```bash
node server.js
```
Then go to [http://localhost:7655](http://localhost:7655) in your browser to start scraping images/videos.

## File Structure
The downloaded videos are saved to the `data` directory. The `data` directory is created if it does not exist.
All the images/videos under search keywords "xxx" are saved to the `data/xxx` directory.
