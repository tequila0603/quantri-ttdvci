import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePremierHtml } from '../src/premier-source.js'

const fixture = `
<h4>Thời gian: Ngày 03 tháng 09 năm 2026 - 14:05:00</h4>
<select class="station-select"><option value="a">KCN An Phú</option><option value="b">KCN Hòa Hiệp 1</option></select>
<table class="table table-single">
  <thead>
    <tr><th>Thời gian</th><th>Điểm quan trắc</th><th>pH</th><th>COD (mg/L)</th><th>TSS (mg/L)</th><th>Amoni (mg/L)</th><th>Nhiệt độ (oC)</th><th>Lưu lượng đầu vào (m3/h)</th><th>Lưu lượng đầu ra (m3/h)</th><th>Lưu lượng đầu ra trong ngày (m3/ngày)</th><th>Lưu lượng đầu vào trong ngày (m3/ngày)</th></tr>
    <tr><th></th><th></th><th class="header-type" data-name="pH">[6 - 9]</th><th class="header-type" data-name="COD">[&lt; 67.5]</th><th class="header-type" data-name="TSS">[&lt; 45]</th><th class="header-type" data-name="NH4">[&lt; 4.5]</th><th class="header-type" data-name="Temp">[&lt; 40]</th><th data-name="Flow_In">Không giới hạn</th><th data-name="Flow_Out">Không giới hạn</th><th></th><th></th></tr>
  </thead>
  <tbody>
    <tr><td rowspan="2">2026-09-03</td><td>KCN An Phú</td><td>8.01</td><td>29.29</td><td>0.36</td><td>0.35</td><td>32.28</td><td>16.51</td><td>0</td><td>59.22</td><td>51.8</td></tr>
    <tr><td>KCN Hòa Hiệp 1</td><td>7.97</td><td>33.48</td><td>23.08</td><td>0.27</td><td>27.85</td><td>9.69</td><td>7.16</td><td>101.41</td><td>137.28</td></tr>
  </tbody>
</table>
<table class="table table-bordered"><tbody><tr>
  <td><div class="type-name-wrapper"><div class="name">pH</div><div class="value"><span class="value-text" data-name="pH">8.06</span><span></span></div><div class="limit" data-typename="pH">[6 - 9]</div></div></td>
  <td><div class="type-name-wrapper"><div class="name">COD</div><div class="value"><span class="value-text" data-name="COD">29.29</span><span>(mg/L)</span></div><div class="limit" data-typename="COD">[&lt; 67.5]</div></div></td>
  <td><div class="type-name-wrapper"><div class="name">TSS</div><div class="value"><span class="value-text" data-name="TSS">0.36</span><span>(mg/L)</span></div><div class="limit" data-typename="TSS">[&lt; 45]</div></div></td>
</tr></tbody></table>`

test('parsePremierHtml maps public station rows and current values', () => {
  const parsed = parsePremierHtml(fixture, 'https://premier.vn/bqlkktpy/cong-bo', new Date('2026-09-03T07:10:00.000Z'))
  assert.equal(parsed.stations.length, 2)
  assert.equal(parsed.history.length, 2)
  assert.equal(parsed.history[1]?.stationName, 'KCN Hòa Hiệp 1')
  assert.equal(parsed.history[0]?.metrics.find((metric) => metric.code === 'PH')?.value, 8.01)
  assert.equal(parsed.current[0]?.stationName, 'KCN An Phú')
  assert.equal(parsed.current[0]?.metrics.find((metric) => metric.code === 'PH')?.value, 8.06)
  assert.equal(parsed.history[0]?.metrics.find((metric) => metric.code === 'COD')?.status, 'NORMAL')
})
