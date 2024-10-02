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

// 下载视频的路由
app.post("/download", async (req, res) => {
    const { query, videos } = req.body;

    if (!videos || videos.length === 0) {
        return res.status(400).send("No videos selected.");
    }

    const folderName = query;
    const dataFolder = path.join(__dirname, "data");
    const folderPath = path.join(dataFolder, folderName);

    // 创建 data 文件夹
    if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder);
    }

    // 创建保存视频的文件夹（如果不存在）
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }

    try {
        for (const video of videos) {
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
    } catch (error) {
        console.error("处理失败：", error.message);
        res.status(500).send(`处理失败：${error.message}`);
    }
});

app.listen(7655, () => {
    console.log("Server is running on port 7655.");
});