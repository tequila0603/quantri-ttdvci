document.addEventListener('DOMContentLoaded', () => {
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const statusMsg = document.getElementById('statusMsg');

  // Đọc cấu hình hiện có (thử local trước, rồi sync)
  const storage = chrome.storage.local || chrome.storage.sync;
  storage.get(['apiUrl', 'apiKey'], (items) => {
    if (items && items.apiUrl) {
      apiUrlInput.value = items.apiUrl;
    }
    if (items && items.apiKey) {
      apiKeyInput.value = items.apiKey;
    }
  });

  saveBtn.addEventListener('click', () => {
    const apiUrl = (apiUrlInput.value || '').trim() || 'http://localhost:3000/api/v1';
    const apiKey = (apiKeyInput.value || '').trim();
    if (!apiKey) {
      statusMsg.className = 'status-msg error';
      statusMsg.innerText = 'Hãy nhập khóa API do quản trị hệ thống cấp.';
      statusMsg.style.display = 'block';
      return;
    }

    const data = { apiUrl, apiKey };

    // Lưu vào cả local và sync để đảm bảo luôn tồn tại
    if (chrome.storage.local) {
      chrome.storage.local.set(data);
    }
    if (chrome.storage.sync) {
      chrome.storage.sync.set(data);
    }

    statusMsg.className = 'status-msg success';
    statusMsg.innerText = '✓ Đã lưu cấu hình kết nối thành công!';
    statusMsg.style.display = 'block';

    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 2500);
  });
});
