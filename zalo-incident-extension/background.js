// Khởi tạo menu chuột phải khi cài đặt hoặc cập nhật tiện ích
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'push_to_incident_system',
    title: '⚡ Tạo sự cố hệ thống từ nội dung này',
    contexts: ['selection'],
  })
})

// Xử lý khi người dùng click vào menu chuột phải trên Zalo Web
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'push_to_incident_system' && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'OPEN_INCIDENT_MODAL',
      selectedText: info.selectionText || '',
    })
  }
})

// Nhận yêu cầu gửi API từ content script (để background fetch không bị ảnh hưởng bởi CORS trang web)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SUBMIT_INCIDENT_API') {
    const { apiUrl, apiKey, payload } = message

    fetch(`${apiUrl}/maintenance/field-reports/quick-ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          sendResponse({
            success: false,
            message: data.error?.message || data.message || `Lỗi máy chủ (${res.status})`,
          })
        } else {
          sendResponse({
            success: true,
            data: data.data,
            message: data.message || 'Đã tạo sự cố thành công',
          })
        }
      })
      .catch((err) => {
        sendResponse({
          success: false,
          message: 'Không thể kết nối tới máy chủ API: ' + (err.message || 'Lỗi mạng'),
        })
      })

    return true // Giữ channel mở cho asynchronous response
  }
})
