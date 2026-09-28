import re

with open(r'C:\Users\tequila\Documents\ChatGPT\Work\my-project\backend\src\routes\field-report-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the parkRow query
park_query_old = r'''    const parkRes = await options\.database\.query<\{\s*id: string; code: string; name: string\s*\}>\(\s*SELECT id::text, code, name FROM core\.industrial_parks\s*WHERE code = \\s*OR \(\ = 'KCN_DONG_BAC_SONG_CAU_KV1' AND code = 'KCN_ONG_BAC_SONG_CAU_KV1'\)\s*OR \(\ = 'KCN_ONG_BAC_SONG_CAU_KV1' AND code = 'KCN_DONG_BAC_SONG_CAU_KV1'\)\s*OR \(\ IN \('', 'CHUA_XAC_DINH', 'Chưa xác định'\) AND code = 'KCN_AN_PHU'\)\s*LIMIT 1,\s*\[cleanPark\],\s*\)\s*const parkRow = parkRes\.rows\[0\]'''

park_query_new = r'''    const parkRow = await FieldReportRepository.findIndustrialParkByCode(cleanPark)'''
content = re.sub(park_query_old, park_query_new, content, flags=re.MULTILINE)

# Replace the existingRes query
existing_query_old = r'''    // Check duplicate by SHA-256 fingerprint\s*const existingRes = await options\.database\.query<\{\s*id: string\s*report_code: string\s*title: string\s*reporter_name: string\s*location_detail: string\s*status: string\s*created_at: string\s*\}>\(\s*SELECT id::text, report_code, title, reporter_name, location_detail, status, created_at::text\s*FROM maintenance\.field_reports\s*WHERE source_fingerprint = \\s*LIMIT 1,\s*\[fingerprint\],\s*\)\s*const existing = existingRes\.rows\[0\]'''

existing_query_new = r'''    // Check duplicate by SHA-256 fingerprint
    const existing = await FieldReportRepository.findByFingerprint(fingerprint)'''
content = re.sub(existing_query_old, existing_query_new, content, flags=re.MULTILINE)

# Add import
if "import { FieldReportRepository }" not in content:
    content = content.replace("import type { EventHub } from '../realtime/event-hub.js'", "import type { EventHub } from '../realtime/event-hub.js'\nimport { FieldReportRepository } from '../repositories/field-report.repo.js'")

with open(r'C:\Users\tequila\Documents\ChatGPT\Work\my-project\backend\src\routes\field-report-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replaced successfully")
