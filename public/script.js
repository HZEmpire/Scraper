// 获取 DOM 元素
const typeSelect = document.getElementById("typeSelect");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const results = document.getElementById("results");
const downloadButton = document.getElementById("downloadButton");

// 保存用户选择的信息
let selectedItems = [];

// 点击搜索按钮事件
searchButton.addEventListener("click", () => {
  const query = searchInput.value.trim();
  const type = typeSelect.value;
  if (query) {
    if (type === "video") {
      searchVideos(query);
    } else if (type === "image") {
      searchImages(query);
    }
  }
});

// 下载按钮事件
downloadButton.addEventListener("click", () => {
  if (selectedItems.length === 0) {
    alert("请选择要下载的内容。");
    return;
  }
  const query = searchInput.value.trim();
  const type = typeSelect.value;
  // 将用户选择发送到后端处理
  fetch("/download", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: query,
      type: type,
      items: selectedItems,
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
        alert(`内容已保存到服务器的 data/${query} 目录中。`);
      } else {
        alert("内容处理失败：" + data.message);
      }
    })
    .catch((error) => {
      console.error("处理失败：", error);
      alert("内容处理失败，请查看控制台以获取更多信息。\n错误信息：" + error.message);
    });
});

// 按下回车键搜索
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    searchButton.click();
  }
});

// 搜索视频函数
async function searchVideos(query) {
  // 清空之前的结果
  results.innerHTML = "";
  selectedItems = [];

  try {
    // 调用服务器端的 /search_videos 接口
    const response = await fetch(`/search_videos?query=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`搜索失败：${response.status} ${response.statusText}`);
    }
    const allVideos = await response.json();

    // 显示前100个结果
    displayVideos(allVideos.slice(0, 100));
  } catch (error) {
    console.error('搜索视频出错：', error);
    alert('搜索视频出错，请查看控制台以获取更多信息。');
  }
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
        selectedItems.push(video);
      } else {
        selectedItems = selectedItems.filter((v) => v.id !== video.id);
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
    results.appendChild(videoItem);
  });
}

// 搜索图片函数
async function searchImages(query) {
  // 清空之前的结果
  results.innerHTML = "";
  selectedItems = [];

  try {
    // 调用服务器端的 /search_images 接口
    const response = await fetch(`/search_images?query=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`搜索失败：${response.status} ${response.statusText}`);
    }
    const allImages = await response.json();

    // 显示前100个结果
    displayImages(allImages.slice(0, 200));
  } catch (error) {
    console.error('搜索图片出错：', error);
    alert('搜索图片出错，请查看控制台以获取更多信息。');
  }
}

// 显示图片结果
function displayImages(images) {
  // 清空之前的结果
  results.innerHTML = "";
  selectedItems = [];

  // 分离不同来源的图片
  const wikimediaImages = images.filter(img => img.source === "Wikimedia Commons");
  const pexelsImages = images.filter(img => img.source === "Pexels");

  // 限制 Wikimedia 图片数量为 150
  const displayedWikimediaImages = wikimediaImages.slice(0, 150);

  // 合并图片数组
  const allImages = [...displayedWikimediaImages, ...pexelsImages];

  allImages.forEach((image) => {
    const imageItem = document.createElement("div");
    imageItem.className = "image-item";

    // 勾选框
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        selectedItems.push(image);
      } else {
        selectedItems = selectedItems.filter((v) => v.id !== image.id);
      }
    });

    // 图片预览
    const imageElement = document.createElement("img");
    imageElement.src = image.url;
    imageElement.style.width = "100%";
    imageElement.addEventListener("click", () => {
      showFullImage(image.originalUrl);
    });

    // 来源信息
    const sourceLabel = document.createElement("p");
    sourceLabel.textContent = `来源：${image.source}`;

    // 添加到页面
    imageItem.appendChild(checkbox);
    imageItem.appendChild(imageElement);
    imageItem.appendChild(sourceLabel); // 添加来源信息
    results.appendChild(imageItem);
  });
}

// 显示原始大小的图片
function showFullImage(url) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  const fullImage = document.createElement("img");
  fullImage.src = url;
  fullImage.className = "full-image";

  overlay.appendChild(fullImage);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", () => {
    document.body.removeChild(overlay);
  });
}
