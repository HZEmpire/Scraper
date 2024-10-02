// 获取 DOM 元素
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const videoResults = document.getElementById("videoResults");
const downloadButton = document.getElementById("downloadButton");

// 保存用户选择的信息
let selectedVideos = [];

// 点击搜索按钮事件
searchButton.addEventListener("click", () => {
  const query = searchInput.value.trim();
  if (query) {
    searchVideos(query);
  }
});

// 下载按钮事件
downloadButton.addEventListener("click", () => {
  if (selectedVideos.length === 0) {
    alert("请选择要下载的视频。");
    return;
  }
  const query = searchInput.value.trim();
  // 将用户选择发送到后端处理
  fetch("/download", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: query,
      videos: selectedVideos,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        return response.text().then((text) => { throw new Error(text); });
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        alert(`视频已保存到服务器的 data/${query} 目录中。`);
      } else {
        alert("视频处理失败：" + data.message);
      }
    })
    .catch((error) => {
      console.error("处理失败：", error);
      alert("视频处理失败，请查看控制台以获取更多信息。\n错误信息：" + error.message);
    });
});

// 搜索视频函数
async function searchVideos(query) {
  // 清空之前的结果
  videoResults.innerHTML = "";
  selectedVideos = [];

  // 调用 Pexels API
  const pexelsVideos = await fetchPexelsVideos(query);

  // 调用 Coverr API
  const coverrVideos = await searchCoverr(query);

  // 合并结果
  const allVideos = [...pexelsVideos, ...coverrVideos];

  // 显示前30个结果
  displayVideos(allVideos.slice(0, 30));
}

// 调用 Coverr API 搜索视频
async function searchCoverr(query) {
  const COVER_API_KEY = "xxx";
  try {
    const response = await fetch(`https://api.coverr.co/videos?urls=true&query=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${COVER_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Coverr API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Coverr API Response:', data);

    // 获取视频列表
    const hits = data.hits;

    if (!Array.isArray(hits)) {
      console.error('Coverr API 返回的数据格式不正确，"hits" 应为数组');
      return [];
    }

    // 格式化视频数据
    const videos = hits.map(video => ({
      id: video.id || video.objectID,
      url: video.urls?.mp4_download || '',  // 使用 mp4_download 字段获取下载链接
      duration: video.duration || 0,
      thumbnail: video.thumbnail || video.poster || '',
      source: 'Coverr',
      title: video.title || '',
      description: video.description || ''
    }));

    // 打印格式化后的视频数组
    console.log('Formatted videos:', videos);

    return videos;
  } catch (error) {
    console.error('Coverr search error:', error);
    return [];
  }
}
  

// 调用 Pexels API 获取视频
async function fetchPexelsVideos(query) {
  const apiKey = "xxx"; // 请替换为您的 Pexels API 密钥
  const response = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=15`,
    {
      headers: {
        Authorization: apiKey,
      },
    }
  );
  const data = await response.json();
  return data.videos.map((video) => ({
    id: video.id,
    url: video.video_files[0].link,
    thumbnail: video.image,
    duration: video.duration,
    source: "pexels",
  }));
}

// 显示视频结果
function displayVideos(videos) {
  videos.forEach((video) => {
    const videoItem = document.createElement("div");
    videoItem.className = "video-item";

    // 勾选框
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        selectedVideos.push(video);
      } else {
        selectedVideos = selectedVideos.filter((v) => v.id !== video.id);
      }
    });

    // 视频预览
    const videoElement = document.createElement("video");
    videoElement.src = video.url;
    videoElement.controls = false;
    videoElement.addEventListener("click", () => {
      videoElement.play();
    });

    // 来源信息
    const sourceLabel = document.createElement("p");
    sourceLabel.textContent = `来源：${video.source}`;

    // 时间范围选择
    const startInput = document.createElement("input");
    startInput.type = "number";
    startInput.min = 0;
    startInput.max = video.duration;
    startInput.value = 0;
    startInput.style.width = "45%";
    startInput.placeholder = "开始时间";

    const endInput = document.createElement("input");
    endInput.type = "number";
    endInput.min = 0;
    endInput.max = video.duration;
    endInput.value = video.duration;
    endInput.style.width = "45%";
    endInput.placeholder = "结束时间";

    // 保存用户选择的时间范围
    startInput.addEventListener("change", () => {
      video.start = parseFloat(startInput.value) || 0;
    });
    endInput.addEventListener("change", () => {
      video.end = parseFloat(endInput.value) || video.duration;
    });

    // 默认时间
    video.start = 0;
    video.end = video.duration;

    // 添加到页面
    videoItem.appendChild(checkbox);
    videoItem.appendChild(videoElement);
    videoItem.appendChild(sourceLabel); // 添加来源信息
    videoItem.appendChild(document.createTextNode("开始时间："));
    videoItem.appendChild(startInput);
    // 换行
    videoItem.appendChild(document.createElement("br"));
    videoItem.appendChild(document.createTextNode("结束时间："));
    videoItem.appendChild(endInput);
    videoResults.appendChild(videoItem);
  });
}