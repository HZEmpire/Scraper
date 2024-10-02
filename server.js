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

// 读取 Coverr API Key
const COVER_API_KEY = process.env.COVERR_API_KEY;

// 调试输出（完成后请移除）
console.log('Coverr API Key:', COVER_API_KEY);

if (!COVER_API_KEY) {
    console.error('Error: COVER_API_KEY is not defined. Please set it in your environment variables or .env file.');
    // 根据需要，您可以选择在此退出程序
    // process.exit(1);
}

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