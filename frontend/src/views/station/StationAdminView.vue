<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  listStationAdmin,
  saveStationAdmin,
  stationError,
  type StationAdmin,
  type StationAdminData
} from '@/api/serviceStation'
import { locale, t } from '@/i18n'
const S = (zh: string, en: string) => (locale.value === 'en' ? en : zh)
const data = ref<StationAdminData | null>(null),
  draft = ref<StationAdmin | null>(null),
  selected = ref(''),
  newId = ref(''),
  error = ref(''),
  message = ref(''),
  loading = ref(false),
  saving = ref(false),
  locationChecked = ref(false)
const previewUrl = computed(() => (draft.value ? '/station/' + draft.value.station_id : ''))
const anchorLabel = computed(
  () => data.value?.anchors.find((a) => a.key === draft.value?.anchor_key)?.label || ''
)
const guideLabel = computed(
  () =>
    data.value?.guides.find((g) => g.guide_id === draft.value?.guide_id)?.name ||
    S('自动选取已上架接待员', 'First published guide')
)
function choose(id: string) {
  const row = data.value?.stations.find((s) => s.station_id === id)
  if (row) {
    draft.value = JSON.parse(JSON.stringify(row))
    selected.value = id
    locationChecked.value = false
    error.value = ''
    message.value = ''
  }
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await listStationAdmin()
    choose(selected.value || data.value.stations[0]?.station_id || '')
  } catch (e) {
    error.value = stationError(e)
  } finally {
    loading.value = false
  }
}
function add() {
  if (!/^[a-z0-9-]{1,60}$/.test(newId.value)) {
    error.value = S(
      '编号仅支持小写字母、数字和短横线。',
      'Use lowercase letters, numbers and hyphens for the ID.'
    )
    return
  }
  if (data.value?.stations.some((s) => s.station_id === newId.value)) {
    choose(newId.value)
    return
  }
  draft.value = {
    station_id: newId.value,
    name: '新的数字人服务站',
    name_en: 'Digital Service Station',
    location: '请填写设备位置',
    location_en: 'Configure the station location',
    anchor_key: 'gate:east',
    guide_id: 0,
    default_language: 'zh',
    welcome: '您好，我是本站数字接待员，可以为您咨询和规划游览。',
    welcome_en: 'Welcome. I can answer questions and plan a walk from this station.',
    idle_seconds: 120,
    volume: 0.7,
    enabled: true,
    demo: true,
    revision: 0,
    announcements: [],
    facilities: [],
    last_seen: null,
    updated_at: ''
  }
  selected.value = ''
  error.value = ''
  message.value = ''
  locationChecked.value = false
  newId.value = ''
}
async function save() {
  if (!draft.value || saving.value) return
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    const saved = await saveStationAdmin(draft.value.station_id, {
      ...draft.value,
      location_checked: locationChecked.value
    })
    selected.value = saved.station_id
    await load()
    message.value = S(
      '已发布。设备结束当前接待后会使用新配置；请在右侧预览已发布页面。',
      'Published. The terminal will load this configuration after the current visit. Preview the published page on the right.'
    )
  } catch (e) {
    error.value = stationError(e)
  } finally {
    saving.value = false
  }
}
function addFacility() {
  if (draft.value)
    draft.value.facilities.push({
      key: 'facility-' + Date.now(),
      name: '',
      name_en: '',
      kind: 'service',
      anchor_key: draft.value.anchor_key,
      verified: false,
      status: 'unknown',
      source: ''
    })
}
function online(value: string | null) {
  return !!value && Date.now() - Date.parse(value + 'Z') < 90000
}
onMounted(load)
</script>
<template>
  <main class="station-admin">
    <header>
      <div>
        <span>{{ S('固定终端 · 统一维护', 'FIXED TERMINALS · CENTRAL MANAGEMENT') }}</span>
        <h1>{{ S('服务站管理', 'Service stations') }}</h1>
        <p>
          {{
            S(
              '配置固定位置、接待员和公开服务资料。',
              'Manage fixed locations, receptionists and public information.'
            )
          }}
        </p>
      </div>
      <button @click="load" :disabled="loading">{{ S('刷新状态', 'Refresh status') }}</button>
    </header>
    <p v-if="error" class="admin-error" role="alert">{{ t(error) }}</p>
    <p v-if="message" class="admin-success" role="status">{{ message }}</p>
    <div class="station-admin-grid">
      <aside>
        <h2>{{ S('设备与点位', 'Devices and locations') }}</h2>
        <button
          v-for="row in data?.stations"
          :key="row.station_id"
          :aria-pressed="draft?.station_id === row.station_id"
          @click="choose(row.station_id)"
        >
          <strong>{{ locale === 'en' ? row.name_en : row.name }}</strong
          ><span
            ><i :class="{ online: online(row.last_seen) }"></i
            >{{
              online(row.last_seen)
                ? S('近期在线', 'Recently online')
                : S('未检测到连接', 'No recent connection')
            }}
            · {{ row.enabled ? S('已启用', 'Enabled') : S('已停用', 'Disabled') }}</span
          ><small>{{ row.station_id }}</small></button
        ><label
          >{{ S('新服务站编号', 'New station ID')
          }}<input v-model="newId" placeholder="summer-palace-north" maxlength="60" /></label
        ><button class="station-admin-add" @click="add">
          ＋ {{ S('新增点位', 'Add location') }}
        </button>
      </aside>
      <form v-if="draft" @submit.prevent="save">
        <section>
          <h2>{{ S('接待与位置', 'Reception and location') }}</h2>
          <div class="admin-fields">
            <label
              >{{ S('中文名称', 'Chinese name')
              }}<input v-model="draft.name" required maxlength="80" /></label
            ><label
              >{{ S('英文名称', 'English name')
              }}<input v-model="draft.name_en" required maxlength="120" /></label
            ><label
              >{{ S('中文位置说明', 'Chinese location')
              }}<input v-model="draft.location" required maxlength="160" /></label
            ><label
              >{{ S('英文位置说明', 'English location')
              }}<input v-model="draft.location_en" required maxlength="240" /></label
            ><label
              >{{ S('步行起点', 'Walking origin')
              }}<select v-model="draft.anchor_key">
                <option v-for="a in data?.anchors" :key="a.key" :value="a.key">
                  {{ t(a.label) }}
                </option>
              </select></label
            ><label
              >{{ S('默认数字接待员', 'Default receptionist')
              }}<select v-model.number="draft.guide_id">
                <option :value="0">{{ S('自动选取已上架接待员', 'First published guide') }}</option>
                <option v-for="g in data?.guides" :key="g.guide_id" :value="g.guide_id">
                  {{ t(g.name) }}
                </option>
              </select></label
            >
          </div>
          <p class="admin-note">
            {{
              S(
                '起点来自现有园内步行路网，须核实设备与接入点的实际关系；若位置不匹配，请先补充路网数据。',
                'Origins use the existing pedestrian network. Verify the physical device connection; extend the network before using a different location.'
              )
            }}
          </p>
          <div class="admin-checks">
            <label
              ><input type="checkbox" v-model="draft.demo" />{{
                S('示范点位（前台显示示范标识）', 'Demonstration location (labelled publicly)')
              }}</label
            ><label
              ><input type="checkbox" v-model="locationChecked" />{{
                S(
                  '已现场核实设备位置与步行接入点',
                  'Physical location and walking access have been checked'
                )
              }}</label
            ><label
              ><input type="checkbox" v-model="draft.enabled" />{{
                S('启用此服务站', 'Enable this station')
              }}</label
            >
          </div>
        </section>
        <section>
          <h2>{{ S('屏幕与会话', 'Screen and session') }}</h2>
          <div class="admin-fields">
            <label
              >{{ S('默认语言', 'Default language')
              }}<select v-model="draft.default_language">
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select></label
            ><label
              >{{ S('无人操作复位秒数', 'Idle timeout (seconds)')
              }}<input
                type="number"
                v-model.number="draft.idle_seconds"
                min="60"
                max="600"
                required /></label
            ><label
              >{{ S('本地语音音量（0—1）', 'Local speech volume (0–1)')
              }}<input
                type="number"
                v-model.number="draft.volume"
                min="0"
                max="1"
                step=".1"
                required /></label
            ><label
              >{{ S('服务站编号', 'Station ID')
              }}<input :value="draft.station_id" readonly /></label
            ><label
              >{{ S('中文欢迎语', 'Chinese welcome')
              }}<textarea v-model="draft.welcome" required maxlength="500" /></label
            ><label
              >{{ S('英文欢迎语', 'English welcome')
              }}<textarea v-model="draft.welcome_en" required maxlength="800" />
            </label>
          </div>
          <p class="admin-note">
            {{
              S(
                '无人操作前会先提醒，并允许继续使用；正在讲解或计算时不会自动复位。',
                'Visitors receive a warning and can extend their visit. Audio playback and active calculations do not trigger idle reset.'
              )
            }}
          </p>
        </section>
        <section>
          <div class="admin-section-heading">
            <h2>{{ S('公开公告', 'Public notices') }}</h2>
            <button
              type="button"
              @click="draft.announcements.push({ text: '', text_en: '', expires_at: '' })"
              :disabled="draft.announcements.length >= 8"
            >
              ＋ {{ S('增加公告', 'Add notice') }}
            </button>
          </div>
          <div v-for="(notice, index) in draft.announcements" :key="index" class="admin-entry">
            <label
              >{{ S('中文公告', 'Chinese notice')
              }}<textarea v-model="notice.text" maxlength="500" required /></label
            ><label
              >{{ S('英文公告', 'English notice')
              }}<textarea v-model="notice.text_en" maxlength="800" required /></label
            ><label
              >{{ S('有效期（可选，ISO日期时间）', 'Expires at (optional ISO date/time)')
              }}<input v-model="notice.expires_at" placeholder="2026-12-31T10:00:00Z" /></label
            ><button type="button" @click="draft.announcements.splice(index, 1)">
              {{ S('移除此公告', 'Remove notice') }}
            </button>
          </div>
          <p v-if="!draft.announcements.length" class="admin-note">
            {{
              S(
                '暂无公告。可发布经核实的开放调整、活动与服务提醒。',
                'No notices. Publish verified access changes, activities and service updates here.'
              )
            }}
          </p>
        </section>
        <section>
          <div class="admin-section-heading">
            <h2>{{ S('设施与服务位置', 'Facilities and services') }}</h2>
            <button type="button" @click="addFacility" :disabled="draft.facilities.length >= 40">
              ＋ {{ S('增加设施', 'Add facility') }}
            </button>
          </div>
          <div v-for="(f, index) in draft.facilities" :key="index" class="admin-entry">
            <div class="admin-fields">
              <label
                >{{ S('设施编号', 'Facility ID')
                }}<input v-model="f.key" required pattern="[a-z0-9-]{1,40}" /></label
              ><label
                >{{ S('类别', 'Type')
                }}<select v-model="f.kind">
                  <option value="toilet">{{ S('卫生间', 'Restroom') }}</option>
                  <option value="water">{{ S('饮水', 'Drinking water') }}</option>
                  <option value="service">{{ S('服务台', 'Service desk') }}</option>
                  <option value="rest">{{ S('休息点', 'Rest area') }}</option>
                </select></label
              ><label
                >{{ S('中文名称', 'Chinese name')
                }}<input v-model="f.name" required maxlength="80" /></label
              ><label
                >{{ S('英文名称', 'English name')
                }}<input v-model="f.name_en" required maxlength="120" /></label
              ><label
                >{{ S('步行接入点', 'Walking access point')
                }}<select v-model="f.anchor_key">
                  <option v-for="a in data?.anchors" :key="a.key" :value="a.key">
                    {{ t(a.label) }}
                  </option>
                </select></label
              ><label
                >{{ S('状态', 'Status')
                }}<select v-model="f.status">
                  <option value="unknown">
                    {{ S('开放状态待确认', 'Opening status unconfirmed') }}
                  </option>
                  <option value="open">{{ S('开放', 'Open') }}</option>
                  <option value="closed">{{ S('暂不可用', 'Unavailable') }}</option>
                </select></label
              >
            </div>
            <label
              >{{ S('资料来源／核实记录', 'Source / verification record')
              }}<input v-model="f.source" required maxlength="200" /></label
            ><label class="admin-checkbox"
              ><input type="checkbox" v-model="f.verified" />{{
                S('位置已核实，允许前台展示', 'Location verified; publish on the terminal')
              }}</label
            ><button type="button" @click="draft.facilities.splice(index, 1)">
              {{ S('移除此设施', 'Remove facility') }}
            </button>
          </div>
          <p class="admin-note">
            {{
              S(
                '仅展示勾选“位置已核实”的设施。不可通行的设施不提供路线，不根据建筑名称推测位置。',
                'Only verified facilities appear publicly. Unavailable facilities do not provide directions; locations are never inferred from building names.'
              )
            }}
          </p>
        </section>
        <div class="admin-save">
          <span>{{ S('当前版本', 'Current revision') }} {{ draft.revision || '—' }}</span
          ><button type="submit" :disabled="saving">
            {{ saving ? S('正在发布…', 'Publishing…') : S('保存并发布配置', 'Save and publish') }}
          </button>
        </div>
      </form>
      <aside v-if="draft" class="admin-preview">
        <span>{{ S('接待信息预览', 'RECEPTION PREVIEW') }}</span>
        <h2>{{ locale === 'en' ? draft.name_en : draft.name }}</h2>
        <p>{{ locale === 'en' ? draft.welcome_en : draft.welcome }}</p>
        <dl>
          <dt>{{ S('固定起点', 'Fixed origin') }}</dt>
          <dd>{{ t(anchorLabel) }}</dd>
          <dt>{{ S('数字接待员', 'Receptionist') }}</dt>
          <dd>{{ t(guideLabel) }}</dd>
          <dt>{{ S('无人操作复位', 'Idle reset') }}</dt>
          <dd>{{ draft.idle_seconds }} s</dd>
        </dl>
        <a v-if="selected" :href="previewUrl" target="_blank" rel="noopener noreferrer"
          >{{ S('打开已发布的服务站页面', 'Open the published terminal') }} ↗</a
        >
        <p class="admin-note">
          {{
            S(
              '此处展示未保存的接待文案；完整页面使用已发布配置。',
              'This preview shows unsaved reception text. The full terminal uses published configuration.'
            )
          }}
        </p>
      </aside>
    </div>
  </main>
</template>
<style scoped>
.station-admin {
  font-family: var(--app-font-family);
  color: #1f2937;
  padding: 25px;
  line-height: 1.7;
}
.station-admin header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 25px;
  background: white;
  padding: 26px 30px;
  border-radius: 23px;
  margin-bottom: 25px;
}
.station-admin header span,
.admin-preview > span {
  font-size: 12px;
  letter-spacing: 0.1em;
  color: #4f46e5;
}
.station-admin h1 {
  font-size: 30px;
  margin: 5px 0;
}
.station-admin header p {
  font-size: 16px;
  color: #64748b;
  margin: 0;
}
.station-admin h2 {
  font-size: 20px;
  margin: 0 0 18px;
}
.station-admin button,
.station-admin input,
.station-admin textarea,
.station-admin select {
  font: inherit;
}
.station-admin button {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 11px;
  padding: 9px 16px;
  color: #4b5563;
  cursor: pointer;
  min-height: 43px;
}
.station-admin button:disabled {
  opacity: 0.5;
}
.station-admin-grid {
  display: grid;
  grid-template-columns: 235px minmax(0, 1fr) 250px;
  gap: 20px;
  align-items: start;
}
.station-admin aside,
.station-admin section {
  background: white;
  padding: 22px;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
}
.station-admin aside > button {
  display: block;
  width: 100%;
  text-align: left;
  margin: 12px 0;
  padding: 14px;
}
.station-admin aside > button[aria-pressed='true'] {
  background: #eef2ff;
  border-color: #c7d2fe;
}
.station-admin aside strong,
.station-admin aside span,
.station-admin aside small {
  display: block;
}
.station-admin aside strong {
  font-size: 17px;
  font-weight: 500;
}
.station-admin aside span {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}
.station-admin aside small {
  font-size: 11px;
  color: #64748b;
}
.station-admin aside i {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f8fafc;
  margin-right: 5px;
}
.station-admin aside i.online {
  background: #f8fafc;
}
.station-admin form > section {
  margin-bottom: 20px;
}
.station-admin label {
  display: block;
  font-size: 15px;
  color: #4b5563;
  margin-bottom: 15px;
}
.station-admin label > input:not([type='checkbox']),
.station-admin label > select,
.station-admin textarea {
  display: block;
  width: 100%;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  border-radius: 10px;
  padding: 10px 12px;
  margin-top: 6px;
  color: #4b5563;
  min-width: 0;
}
.station-admin textarea {
  min-height: 95px;
  resize: vertical;
}
.admin-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 20px;
}
.admin-note {
  font-size: 13px;
  color: #64748b;
  margin: 12px 0 0;
  line-height: 1.8;
}
.admin-checks label,
.admin-checkbox {
  display: flex !important;
  gap: 9px;
  align-items: center;
}
.station-admin input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: #4f46e5;
}
.admin-section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 18px;
}
.admin-section-heading h2 {
  margin: 0;
}
.admin-entry {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 13px;
  padding: 18px;
  margin-bottom: 17px;
}
.admin-save {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  position: sticky;
  bottom: 10px;
  padding: 18px;
  background: #ffffff;
  border-radius: 15px;
  box-shadow: 0 3px 25px #1e293b12;
}
.admin-save span {
  color: #64748b;
  font-size: 14px;
}
.admin-save button {
  background: #4f46e5;
  color: white;
  border-color: #c7d2fe;
}
.admin-preview {
  position: sticky;
  top: 20px;
}
.admin-preview h2 {
  margin-top: 15px;
}
.admin-preview p {
  font-size: 15px;
  color: #64748b;
}
.admin-preview dt {
  font-size: 12px;
  color: #64748b;
  margin-top: 16px;
}
.admin-preview dd {
  margin: 3px 0 0;
  font-size: 16px;
  color: #4b5563;
}
.admin-preview a {
  display: block;
  padding: 13px;
  background: #eef2ff;
  border-radius: 10px;
  color: #4f46e5;
  font-size: 14px;
  text-decoration: none;
}
.admin-error,
.admin-success {
  padding: 14px 22px;
  border-radius: 12px;
  background: #f8fafc;
  color: #b18b62;
  font-size: 16px;
}
.admin-success {
  background: #f8fafc;
  color: #4b5563;
}
@media (max-width: 1450px) {
  .station-admin-grid {
    grid-template-columns: 210px minmax(0, 1fr);
  }
  .admin-preview {
    grid-column: 2;
    position: static;
  }
}
@media (max-width: 900px) {
  .station-admin {
    padding: 15px;
  }
  .station-admin-grid {
    grid-template-columns: 1fr;
  }
  .admin-preview {
    grid-column: auto;
  }
  .admin-fields {
    grid-template-columns: 1fr;
  }
  .station-admin header {
    flex-direction: column;
    align-items: start;
  }
}
</style>
