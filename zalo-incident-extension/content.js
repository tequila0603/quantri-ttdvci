// Lắng nghe tín hiệu mở Modal từ background script (khi dùng phím tắt hoặc Shift + Click chuột phải)
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'OPEN_INCIDENT_MODAL') {
    showIncidentModal(request.selectedText || '')
  }
})

// Tự động nhận diện KCN từ nội dung chat
function detectPark(text) {
  const lower = (text || '').toLowerCase()
  if (lower.includes('an phú') || lower.includes(' ap ') || lower.endsWith(' ap') || lower.includes('an phu')) {
    return 'KCN_AN_PHU'
  }
  if (lower.includes('hòa hiệp') || lower.includes('hoa hiep') || lower.includes(' hh ') || lower.includes('hh1')) {
    return 'KCN_HOA_HIEP_1'
  }
  if (lower.includes('sông cầu') || lower.includes('song cau') || lower.includes('đông bắc') || lower.includes('dbsc') || lower.includes('kv1') || lower.includes('kv2')) {
    return 'KCN_ONG_BAC_SONG_CAU_KV1'
  }
  return ''
}

// Tự động dự đoán mức độ nghiêm trọng
function detectSeverity(text) {
  const lower = (text || '').toLowerCase()
  if (lower.includes('khẩn') || lower.includes('nguy hiểm') || lower.includes('cháy') || lower.includes('vỡ ống') || lower.includes('tràn') || lower.includes('sụt lún')) {
    return 'HIGH'
  }
  if (lower.includes('nhẹ') || lower.includes('theo dõi') || lower.includes('nhỏ')) {
    return 'LOW'
  }
  return 'MEDIUM'
}

// ==========================================================
// 1. Nút nổi "⚡ Tạo sự cố" xuất hiện ngay khi bôi đen chữ trên Zalo
// ==========================================================
let floatingBtn = null
let lastSelectedText = ''

function getOrCreateFloatingBtn() {
  if (floatingBtn) return floatingBtn
  floatingBtn = document.createElement('div')
  floatingBtn.id = 'zalo-incident-floating-btn'
  floatingBtn.innerHTML = '<span>⚡</span> <span>Tạo sự cố hệ thống</span>'
  floatingBtn.style.display = 'none'
  document.body.appendChild(floatingBtn)

  floatingBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const textToUse = lastSelectedText || (window.getSelection() ? window.getSelection().toString() : '').trim()
    if (textToUse) {
      showIncidentModal(textToUse)
      floatingBtn.style.display = 'none'
    }
  })
  return floatingBtn
}

document.addEventListener('mouseup', (e) => {
  if (e.target.closest('#zalo-incident-quick-modal') || e.target.closest('#zalo-incident-floating-btn')) {
    return
  }

  setTimeout(() => {
    const sel = window.getSelection()
    const text = (sel ? sel.toString() : '').trim()
    const btn = getOrCreateFloatingBtn()

    if (text && text.length >= 2) {
      lastSelectedText = text
      try {
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        if (rect && rect.width > 0) {
          btn.style.display = 'flex'
          btn.style.top = `${Math.max(10, window.scrollY + rect.top - 42)}px`
          btn.style.left = `${Math.max(10, window.scrollX + rect.left + rect.width / 2 - 80)}px`
          return
        }
      } catch (err) {
        // Bỏ qua nếu range không hợp lệ
      }
    }
    btn.style.display = 'none'
  }, 80)
})

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#zalo-incident-floating-btn') && !e.target.closest('#zalo-incident-quick-modal')) {
    if (floatingBtn) floatingBtn.style.display = 'none'
  }
})

// ==========================================================
// 2. Tự động chèn mục vào Menu chuột phải riêng của Zalo
// ==========================================================
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === 1) {
        const txt = node.innerText || ''
        const isMenu = txt.includes('Copy nội dung') || txt.includes('Trả lời') || txt.includes('Ghim tin nhắn')
        if (isMenu && !node.querySelector('.zi-injected-item')) {
          injectIntoZaloMenu(node)
        }
      }
    }
  }
})

observer.observe(document.body, { childList: true, subtree: true })

function injectIntoZaloMenu(menuContainer) {
  const item = document.createElement('div')
  item.className = 'zi-injected-item'
  item.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    cursor: pointer;
    font-weight: 600;
    color: #0f172a;
    font-size: 13px;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    border-bottom: 1px solid #e2e8f0;
    user-select: none;
    transition: background 0.15s ease;
  `
  item.innerHTML = '<span>⚡</span> <span>Tạo sự cố hệ thống</span>'
  item.onmouseenter = () => { item.style.background = '#e2e8f0' }
  item.onmouseleave = () => { item.style.background = '#f8fafc' }

  item.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    menuContainer.style.display = 'none'
    const selText = (window.getSelection() ? window.getSelection().toString() : '').trim() || lastSelectedText
    showIncidentModal(selText)
  }

  menuContainer.appendChild(item)
}

// ==========================================================
// 3. Modal hiển thị tiếp nhận sự cố
function stripZaloReactions(str) {
  if (!str) return ''
  return str
    .replace(/\/-(?:strong|heart|break|rose|fade|kiss|hug|like|dislike|haha|sad|wow|angry|cry|shy|sun|flag|bomb|star|clap|ok)/gi, '')
    .replace(/(?:\:-[()a-zA-Z]+|:>[a-zA-Z()]*|:o\b|:\(\(|:\)|:\(|;\)|:D|:-D)/g, '')
    .replace(/\b\d{1,2}:\d{2}\b/g, '')
    .replace(/[\s\u00a0\u200b]+/g, ' ')
    .trim()
}

// ==========================================================
// 3. Modal hiển thị tiếp nhận sự cố
// ==========================================================
function showIncidentModal(rawText) {
  const existing = document.getElementById('zalo-incident-quick-modal')
  if (existing) existing.remove()

  const sanitized = stripZaloReactions(rawText)
  const detectedPark = detectPark(sanitized)
  const detectedSev = detectSeverity(sanitized)
  const trimmed = sanitized.trim()
  
  // Trích xuất tiêu đề thông minh: không lấy quá dài hoặc cắt ở dấu phẩy
  let cleanTitle = trimmed
  const match = trimmed.split(/[,;.]/)
  if (match && match[0] && match[0].trim().length > 10) {
    cleanTitle = match[0].trim()
  }
  if (cleanTitle.length > 65) {
    cleanTitle = cleanTitle.substring(0, 62) + '...'
  }
  if (!cleanTitle) cleanTitle = 'Sự cố kỹ thuật từ Zalo'

  const modal = document.createElement('div')
  modal.id = 'zalo-incident-quick-modal'
  modal.innerHTML = `
    <div class="zi-card">
      <div class="zi-header">
        <div class="zi-header-title">
          <span class="zi-badge-dot"></span>
          <strong>Tiếp nhận Báo cáo hiện trường từ Zalo</strong>
        </div>
        <button type="button" class="zi-close-btn" id="zi-btn-close" aria-label="Đóng">&times;</button>
      </div>

      <div class="zi-body">
        <div class="zi-field">
          <label for="zi-title">Tiêu đề báo cáo / Vấn đề phát sinh:</label>
          <input type="text" id="zi-title" value="${escapeHtml(cleanTitle)}" placeholder="Nhập tóm tắt vấn đề..." />
        </div>

        <div class="zi-row">
          <div class="zi-field">
            <label for="zi-park">Khu công nghiệp (bắt buộc):</label>
            <select id="zi-park">
              <option value="" ${!detectedPark ? 'selected' : ''}>Chưa xác định KCN</option>
              <option value="KCN_AN_PHU" ${detectedPark === 'KCN_AN_PHU' ? 'selected' : ''}>KCN An Phú</option>
              <option value="KCN_HOA_HIEP_1" ${detectedPark === 'KCN_HOA_HIEP_1' ? 'selected' : ''}>KCN Hòa Hiệp 1</option>
              <option value="KCN_ONG_BAC_SONG_CAU_KV1" ${detectedPark === 'KCN_ONG_BAC_SONG_CAU_KV1' ? 'selected' : ''}>KCN Đông Bắc Sông Cầu</option>
            </select>
          </div>

          <div class="zi-field">
            <label for="zi-severity">Mức độ ưu tiên:</label>
            <select id="zi-severity">
              <option value="LOW" ${detectedSev === 'LOW' ? 'selected' : ''}>🟢 Thấp (Theo dõi)</option>
              <option value="MEDIUM" ${detectedSev === 'MEDIUM' ? 'selected' : ''}>🟡 Trung bình</option>
              <option value="HIGH" ${detectedSev === 'HIGH' ? 'selected' : ''}>🟠 Mức độ cao (Cần xử lý)</option>
              <option value="CRITICAL">🔴 Khẩn cấp / Nguy hiểm</option>
            </select>
          </div>
        </div>

        <div class="zi-field">
          <label for="zi-desc">Vị trí cụ thể & Nội dung tin nhắn:</label>
          <textarea id="zi-desc" rows="3" placeholder="Mô tả chi tiết vị trí hoặc tình trạng...">${escapeHtml(trimmed)}</textarea>
        </div>

        <div class="zi-field">
          <label for="zi-reporter">Người báo cáo (ghi chú Zalo):</label>
          <input type="text" id="zi-reporter" placeholder="Ví dụ: Anh Nam - Tổ kỹ thuật KCN Hòa Hiệp" />
        </div>

        <div id="zi-feedback" class="zi-feedback" style="display: none;"></div>
      </div>

      <div class="zi-footer">
        <button type="button" id="zi-btn-cancel" class="zi-btn zi-btn-cancel">Hủy bỏ</button>
        <button type="button" id="zi-btn-submit" class="zi-btn zi-btn-submit">
          <span>Lưu lên Dashboard</span>
          <span class="zi-arrow">➔</span>
        </button>
      </div>
    </div>
  `
  document.body.appendChild(modal)

  // Đóng modal
  const closeModal = () => modal.remove()
  modal.querySelector('#zi-btn-close').onclick = closeModal
  modal.querySelector('#zi-btn-cancel').onclick = closeModal
  modal.onclick = (e) => {
    if (e.target === modal) closeModal()
  }

  // Xử lý nút gửi
  const submitBtn = modal.querySelector('#zi-btn-submit')
  const feedback = modal.querySelector('#zi-feedback')

  submitBtn.onclick = async () => {
    const titleVal = (modal.querySelector('#zi-title').value || '').trim()
    const parkVal = modal.querySelector('#zi-park').value
    const sevVal = modal.querySelector('#zi-severity').value
    const descVal = (modal.querySelector('#zi-desc').value || '').trim()
    const reporterVal = (modal.querySelector('#zi-reporter').value || '').trim()

    if (!titleVal) {
      showFeedback(feedback, 'Vui lòng nhập tiêu đề báo cáo', 'error')
      return
    }
    if (!parkVal) {
      showFeedback(feedback, 'Chưa xác định được KCN. Hãy chọn đúng KCN trước khi lưu.', 'error')
      return
    }

    submitBtn.disabled = true
    submitBtn.innerHTML = '<span>Đang gửi...</span>'

    // Lấy cấu hình URL & API Key
    const storage = chrome.storage.local || chrome.storage.sync
    storage.get(['apiUrl', 'apiKey'], (cfg) => {
      const apiUrl = (cfg && cfg.apiUrl) || 'http://localhost:3000/api/v1'
      const apiKey = (cfg && cfg.apiKey) || ''
      if (!apiKey) {
        showFeedback(feedback, 'Chưa cấu hình khóa API trong tiện ích.', 'error')
        submitBtn.disabled = false
        submitBtn.innerHTML = '<span>Thử lại</span>'
        return
      }

      chrome.runtime.sendMessage(
        {
          action: 'SUBMIT_INCIDENT_API',
          apiUrl,
          apiKey,
          payload: {
            title: titleVal,
            parkCode: parkVal,
            severity: sevVal,
            content: descVal || titleVal,
            locationDetail: modal.querySelector('#zi-park option:checked')?.textContent?.trim() || '',
            rawReporter: reporterVal,
            reporterName: reporterVal || 'Chưa xác định',
            source: 'ZALO_WEB_EXTENSION',
          },
        },
        (res) => {
          if (res && res.success) {
            showFeedback(
              feedback,
              `✅ Đã tiếp nhận: ${res.data.reportCode || res.data.incidentCode || ''} (${res.data.parkName || parkVal})!`,
              'success',
            )
            submitBtn.innerHTML = '<span>Đã xong ✓</span>'
            setTimeout(() => {
              closeModal()
            }, 1400)
          } else {
            showFeedback(feedback, `❌ ${res?.message || 'Không thể tiếp nhận báo cáo'}`, 'error')
            submitBtn.disabled = false
            submitBtn.innerHTML = '<span>Thử lại</span>'
          }
        },
      )
    })
  }
}

function showFeedback(el, msg, type) {
  el.style.display = 'block'
  el.className = `zi-feedback zi-feedback-${type}`
  el.innerText = msg
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
