const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require('dotenv').config();

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpegPath = ffmpegInstaller.path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.json());

// 配置静态文件中间件
app.use(express.static(path.join(__dirname, "public")));

// 读取 API Keys
const COVER_API_KEY = process.env.COVERR_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

// 检查 API Keys
if (!COVER_API_KEY || !PEXELS_API_KEY) {
    console.error('Error: API keys are not defined. Please set them in your environment variables or .env file.');
    // process.exit(1); // 可根据需要选择是否退出程序
}

// 搜索视频的路由
app.get('/search_videos', async (req, res) => {
    const query = req.query.query;
    if (!query) {
        return res.status(400).json({ error: 'Missing query parameter' });
    }

    try {
        // 调用 Pexels 和 Coverr 的搜索函数
        const [pexelsVideos, coverrVideos] = await Promise.all([
            fetchPexelsVideos(query),
            searchCoverr(query)
        ]);

        // 合并结果
        const allVideos = [...pexelsVideos, ...coverrVideos];

        res.json(allVideos);
    } catch (error) {
        console.error('搜索视频失败：', error.message);
        res.status(500).json({ error: '搜索视频失败' });
    }
});

async function fetchPexelsVideos(query) {
    const apiKey = PEXELS_API_KEY;
    try {
        const response = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=45`, {
            headers: {
                Authorization: apiKey,
            },
        });
        const data = response.data;
        return data.videos.map((video) => ({
            id: video.id,
            url: video.video_files[0].link,
            thumbnail: video.image,
            duration: video.duration,
            source: "Pexels",
        }));
    } catch (error) {
        console.error('Pexels 搜索错误：', error.message);
        return [];
    }
}

async function searchCoverr(query) {
    const COVER_API_KEY = process.env.COVERR_API_KEY;
    try {
        const response = await axios.get(`https://api.coverr.co/videos?urls=true&query=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${COVER_API_KEY}`
            }
        });

        const data = response.data;
        const hits = data.hits;

        if (!Array.isArray(hits)) {
            console.error('Coverr API 返回的数据格式不正确，"hits" 应为数组');
            return [];
        }

        // 格式化视频数据
        const videos = hits.map(video => ({
            id: video.id || video.objectID,
            url: video.urls?.mp4_download || '',
            duration: video.duration || 0,
            thumbnail: video.thumbnail || video.poster || '',
            source: 'Coverr',
            title: video.title || '',
            description: video.description || ''
        }));

        return videos;
    } catch (error) {
        console.error('Coverr 搜索错误：', error.message);
        return [];
    }
}

// 搜索图片的路由
app.get('/search_images', async (req, res) => {
    const query = req.query.query;
    if (!query) {
        return res.status(400).json({ error: 'Missing query parameter' });
    }

    try {
        // 调用 Wikimedia 和 Pexels 的图片搜索函数
        const [wikimediaImages, pexelsImages] = await Promise.all([
            searchWikimediaImages(query),
            fetchPexelsImages(query)
        ]);

        // 合并结果，先 Wikimedia，再 Pexels
        const allImages = [...wikimediaImages, ...pexelsImages];

        res.json(allImages);
    } catch (error) {
        console.error('搜索图片失败：', error.message);
        res.status(500).json({ error: '搜索图片失败' });
    }
});

async function fetchPexelsImages(query) {
    const apiKey = PEXELS_API_KEY;
    if (!apiKey) {
        console.error('Pexels API key is missing.');
        return [];
    }
    try {
        const response = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=50`, {
            headers: {
                Authorization: apiKey,
            },
        });
        const data = response.data;
        return data.photos.map((photo) => ({
            id: `pexels_${photo.id}`,
            url: photo.src.medium,
            originalUrl: photo.src.original,
            source: "Pexels",
        }));
    } catch (error) {
        console.error('Pexels 图片搜索错误：', error.message);
        return [];
    }
}

async function searchWikimediaImages(query) {
    try {
        const response = await axios.get('https://commons.wikimedia.org/w/api.php', {
            params: {
                action: 'query',
                format: 'json',
                prop: 'imageinfo',
                generator: 'search',
                gsrnamespace: 6, // 限制搜索到文件命名空间
                gsrlimit: 150, // 将结果限制为 150 张图片
                gsrsearch: query,
                iiprop: 'url|thumbnail', // 添加 'thumbnail' 属性
                iiurlwidth: 300, // 指定缩略图宽度
                origin: '*',
            }
        });

        const pages = response.data.query && response.data.query.pages;
        if (!pages) {
            return [];
        }

        const images = Object.values(pages)
            .map(page => {
                const imageinfo = page.imageinfo && page.imageinfo[0];
                if (!imageinfo) {
                    return null;
                }
                return {
                    id: `wikimedia_${page.pageid}`,
                    url: imageinfo.thumburl || imageinfo.url,
                    originalUrl: imageinfo.url,
                    source: "Wikimedia Commons",
                };
            })
            .filter(image => image !== null);

        return images;
    } catch (error) {
        console.error('Wikimedia Commons 图片搜索错误：', error.message);
        return [];
    }
}

// 下载内容的路由
app.post("/download", async (req, res) => {
    const { query, type, items } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).send("No items selected.");
    }

    const folderName = query;
    const dataFolder = path.join(__dirname, "data");
    const folderPath = path.join(dataFolder, folderName);

    // 创建 data 文件夹
    if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder);
    }

    // 创建保存内容的文件夹（如果不存在）
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }

    try {
        if (type === 'video') {
            for (const video of items) {
                const videoUrl = video.url;
                const videoId = video.id;
                const startTime = video.start || 0;
                const endTime = video.end || video.duration;

                // 使用 videoId 作为文件名，覆盖已有文件
                const videoFileName = `${videoId}.mp4`;
                const videoFilePath = path.join(folderPath, videoFileName);

                // 下载视频
                const response = await axios({
                    method: "GET",
                    url: videoUrl,
                    responseType: "stream",
                    headers: video.source === 'Coverr' && COVER_API_KEY ? {
                        'Authorization': `Bearer ${COVER_API_KEY}`
                    } : {}
                });

                const tempVideoPath = path.join(folderPath, `${videoId}_temp.mp4`);

                const writer = fs.createWriteStream(tempVideoPath);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on("finish", resolve);
                    writer.on("error", reject);
                });

                // 裁剪视频
                await new Promise((resolve, reject) => {
                    ffmpeg(tempVideoPath)
                        .setStartTime(startTime)
                        .setDuration(endTime - startTime)
                        .output(videoFilePath)
                        .on("end", () => {
                            // 删除临时文件
                            fs.unlinkSync(tempVideoPath);
                            resolve();
                        })
                        .on("error", (err) => {
                            console.error("裁剪错误：", err.message);
                            reject(err);
                        })
                        .run();
                });

                // 如果是来自 Coverr 的视频，发送下载统计请求
                if (video.source === 'Coverr' && COVER_API_KEY) {
                    try {
                        // 使用新的 API 端点
                        await axios.post(`https://api.coverr.co/videos/${video.id}/metrics/download`, null, {
                            headers: {
                                'Authorization': `Bearer ${COVER_API_KEY}`
                            }
                        });
                    } catch (error) {
                        console.error(`Failed to send download stats for video ${video.id}:`, error.response?.data || error.message);
                        // 不阻止后续操作
                    }
                }
            }

            // 处理完成，返回成功响应
            res.json({ success: true, message: "视频处理完成并保存到指定目录。" });
        } else if (type === 'image') {
            for (const image of items) {
                const imageUrl = image.originalUrl || image.url;
                const imageId = image.id;

                // 获取图片扩展名
                const extension = path.extname(imageUrl).split('?')[0]; // 移除查询参数
                const imageFileName = `${imageId}${extension}`;
                const imageFilePath = path.join(folderPath, imageFileName);

                // 下载图片
                const response = await axios({
                    method: "GET",
                    url: imageUrl,
                    responseType: "stream",
                    headers: image.source === 'Coverr' && COVER_API_KEY ? {
                        'Authorization': `Bearer ${COVER_API_KEY}`
                    } : {}
                });

                const writer = fs.createWriteStream(imageFilePath);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on("finish", resolve);
                    writer.on("error", reject);
                });
            }

            // 处理完成，返回成功响应
            res.json({ success: true, message: "图片已保存到指定目录。" });
        } else {
            res.status(400).send("Invalid type.");
        }
    } catch (error) {
        console.error("处理失败：", error.message);
        res.status(500).send(`处理失败：${error.message}`);
    }
});

app.listen(7655, () => {
    console.log("Server is running on port 7655.");
});
